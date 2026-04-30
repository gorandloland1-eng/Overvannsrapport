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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureLayerAsBlob(
  container: HTMLElement,
  setMapLayer: (layer: "kart" | "terreng" | "satellitt") => void,
  mapRef: React.MutableRefObject<any>,
  layerKey: "kart" | "terreng" | "satellitt",
  delayMs = 2500
): Promise<Blob | null> {
  return new Promise((resolve) => {
    // Lagre posisjon FØR lagbytte
    const center = mapRef.current?.getCenter?.();
    const zoom = mapRef.current?.getZoom?.();

    setMapLayer(layerKey);

    setTimeout(async () => {
      try {
        // Gjenopprett posisjon uten animasjon
        mapRef.current?.invalidateSize?.({ pan: false, animate: false });
        if (center && zoom !== undefined) {
          mapRef.current?.setView?.(center, zoom, { animate: false, duration: 0 });
        }
      } catch {}

      await wait(500);

      try {
        const canvas = await html2canvas(container, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false,
          backgroundColor: "#ffffff",
          ignoreElements: (el) =>
            el.classList.contains("leaflet-control-container"),
        });

        console.log(`[Screenshot] Canvas ${layerKey}: ${canvas.width}x${canvas.height}`);
        canvas.toBlob((blob) => {
          resolve(blob ?? null);
        }, "image/png");
      } catch (e) {
        console.warn(`[Screenshot] Feilet for "${layerKey}":`, e);
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

      // Hent leaflet-container direkte fra DOM – har alltid riktige dimensjoner
      const container = document.querySelector(".leaflet-container") as HTMLElement | null;

      if (container) {
        console.log(`[Screenshot] leaflet-container: ${container.offsetWidth}x${container.offsetHeight}`);

        for (const layer of MAP_LAYERS) {
          try {
            console.log(`[Screenshot] Capture ${layer.key}...`);
            const blob = await captureLayerAsBlob(
              container,
              opts.setMapLayer,
              opts.mapRef,
              layer.key
            );

            if (blob) {
              const url = await uploadMapScreenshotToFirebase(
                blob,
                opts.projectName,
                layer.filename
              );
              console.log(`[Screenshot] Lastet opp ${layer.key}:`, url);
              screenshotUrls[layer.key] = url;
              mapImageUrls.push(url);
            } else {
              console.warn(`[Screenshot] Blob null for ${layer.key}`);
            }
          } catch (e) {
            console.error(`[Screenshot] Feil for ${layer.key}:`, e);
          }
        }

        opts.setMapLayer("kart");
        console.log("[Screenshot] Ferdig. mapImageUrls:", mapImageUrls);
      } else {
        console.warn("[Screenshot] Fant ikke .leaflet-container i DOM");
      }

      // --- Generate PDFs ---
      const response = await generatePdf({
        project_name: opts.projectName,
        height: opts.elevation ?? 0,
        length: opts.length ?? 0,
        time_of_concentration: opts.concentrationTime ?? 0,
        areal: Number(opts.area),
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

      console.log("[PDF] Ferdig. mapImageUrls:", mapImageUrls);
      setPdfSuccess(true);
    } catch (e) {
      console.error("[PDF] Feil:", e);
      setPdfError(
        e instanceof Error ? e.message : "Noe gikk galt under generering av PDF"
      );
    } finally {
      setPdfSaving(false);
    }
  }

  return { pdfSaving, pdfError, setPdfError, pdfSuccess, resetPdfSuccess, handleGeneratePdf };
}