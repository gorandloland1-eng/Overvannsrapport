import { useState } from "react";
import html2canvas from "html2canvas-pro";
import { generatePdf } from "../api/pdf";
import { savePdfReport, uploadMapScreenshotToFirebase } from "../api/firebase";
import type { WeatherStation } from "../api/ivf";

interface GeneratePdfOptions {
  userId: string;
  mapRef: React.MutableRefObject<any>;
  setMapLayer: (layer: "kart" | "terreng" | "satellitt") => void;
  projectName: string;
  elevation: number | null;
  length: number | null;
  concentrationTime: number | null;
  area: string;
  returnPeriod: string;
  climateFactor: string;
  maxDischarge: string;
  infiltrationMethod: "direct" | "soiltype";
  manualQInf: string;
  selectedSoilType: string;
  bottomArea: string;
  sideArea: string;
  soilTypes: any[];
  propertyAddress: string | null;
  propertyMatrikkel: { gnr: number; bnr: number; kommunenummer: string } | null;
  selectedStationId: string;
  selectedStation: WeatherStation | undefined;
}

const MAP_LAYERS: Array<{
  key: "kart" | "terreng" | "satellitt";
  filename: string;
}> = [
  { key: "kart",      filename: "kart.png" },
  { key: "terreng",   filename: "terreng.png" },
  { key: "satellitt", filename: "satellitt.png" },
];

async function captureLayerAsBlob(
  container: HTMLElement,
  setMapLayer: (layer: "kart" | "terreng" | "satellitt") => void,
  layerKey: "kart" | "terreng" | "satellitt",
  delayMs = 2500
): Promise<Blob | null> {
  return new Promise((resolve) => {
    setMapLayer(layerKey);
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(container, {
          useCORS: true,
          allowTaint: true,        // <-- bytt fra false til true
          scale: 1,
          logging: false,
          backgroundColor: "#ffffff",
          ignoreElements: (el) =>
            el.classList.contains("leaflet-control-container"),
        });
        canvas.toBlob((blob) => resolve(blob ?? null), "image/png");
      } catch (e) {
        console.warn(`html2canvas-pro feilet for lag "${layerKey}":`, e);
        resolve(null);
      }
    }, delayMs);
  });
}

export function useGeneratePdf() {
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfSuccess, setPdfSuccess] = useState(false);

  function resetPdfSuccess() {
    setPdfSuccess(false);
  }

  async function handleGeneratePdf(opts: GeneratePdfOptions) {
    setPdfSaving(true);
    setPdfError("");
    setPdfSuccess(false);

    try {
      const qInf =
        opts.infiltrationMethod === "direct"
          ? Number(opts.manualQInf || 0)
          : (() => {
              const st = opts.soilTypes.find((j) => j.id === opts.selectedSoilType);
              if (!st) return 0;
              return (
                st.k_m_s *
                (Number(opts.bottomArea || 0) * 0.5 +
                  Number(opts.sideArea || 0) * 1.0) *
                1000
              );
            })();

      // --- Map screenshots ---
      const screenshotUrls: { kart?: string; terreng?: string; satellitt?: string } = {};
      const mapImageUrls: string[] = [];

      if (opts.mapRef.current) {
        const container: HTMLElement = opts.mapRef.current.getContainer();
        for (const layer of MAP_LAYERS) {
          try {
            const blob = await captureLayerAsBlob(container, opts.setMapLayer, layer.key);
            if (blob) {
              const url = await uploadMapScreenshotToFirebase(blob, opts.projectName, layer.filename);
              screenshotUrls[layer.key] = url;
              mapImageUrls.push(url);
            }
          } catch (e) {
            console.warn(`Screenshot feilet for ${layer.key}:`, e);
          }
        }
        opts.setMapLayer("kart");
      }

      const areaM2 = Number(opts.area) * 10000;

      // --- Generate PDFs ---
      const response = await generatePdf({
        project_name: opts.projectName,
        height: opts.elevation ?? 0,
        length: opts.length ?? 0,
        time_of_concentration: opts.concentrationTime ?? 0,
        areal: areaM2,
        returperiode: Number(opts.returnPeriod),
        klimafaktor: Number(opts.climateFactor),
        maks_paslipp: Number(opts.maxDischarge),
        infiltrasjonskapasitet: qInf,
        eiendom_adresse: opts.propertyAddress,
        eiendom_gnr: opts.propertyMatrikkel?.gnr ?? null,
        eiendom_bnr: opts.propertyMatrikkel?.bnr ?? null,
        phi: 0.9,
        selected_weather_station: opts.selectedStationId,
        selected_weather_station_name: opts.selectedStation?.name ?? "",
      });

      // --- Save to Firestore ---
      await savePdfReport({
        userId: opts.userId,
        projectName: opts.projectName,
        pdfUrl: response.firebase_url,
        calcPdfUrl: response.calc_firebase_url ?? null,
        screenshotUrls,
        mapImageUrls,
        data: {
          area: opts.area,
          returnPeriod: opts.returnPeriod,
          climateFactor: opts.climateFactor,
          maxDischarge: opts.maxDischarge,
          elevation: opts.elevation,
          length: opts.length,
          concentrationTime: opts.concentrationTime,
          selectedWeatherStationName: opts.selectedStation?.name ?? "",
          infiltration: qInf,
          address: opts.propertyAddress,
          gnr: opts.propertyMatrikkel?.gnr ?? null,
          bnr: opts.propertyMatrikkel?.bnr ?? null,
        },
      });

      setPdfSuccess(true);
    } catch (e) {
      setPdfError(
        e instanceof Error ? e.message : "Noe gikk galt under generering av PDF"
      );
    } finally {
      setPdfSaving(false);
    }
  }

  return { pdfSaving, pdfError, setPdfError, pdfSuccess, resetPdfSuccess, handleGeneratePdf };
}
