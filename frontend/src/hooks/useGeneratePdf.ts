import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

export function useGeneratePdf() {
  const navigate = useNavigate();
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");

  async function handleGeneratePdf(opts: GeneratePdfOptions) {
    setPdfSaving(true);
    setPdfError("");
    try {
      const qInf = opts.infiltrationMethod === "direct"
        ? Number(opts.manualQInf || 0)
        : (() => {
            const st = opts.soilTypes.find((j) => j.id === opts.selectedSoilType);
            if (!st) return 0;
            return st.k_m_s * (Number(opts.bottomArea || 0) * 0.5 + Number(opts.sideArea || 0) * 1.0) * 1000;
          })();

      // Ta screenshot av alle 3 kartlag
      const screenshotUrls: { kart?: string; terreng?: string; satellitt?: string } = {};

      if (opts.mapRef.current) {
        const container = opts.mapRef.current.getContainer();
        const layers: Array<{ key: "kart" | "terreng" | "satellitt"; filename: string }> = [
          { key: "kart", filename: "kart.png" },
          { key: "terreng", filename: "terreng.png" },
          { key: "satellitt", filename: "satellitt.png" },
        ];

        for (const layer of layers) {
          try {
            opts.setMapLayer(layer.key);
            await new Promise((resolve) => setTimeout(resolve, 2500));
            screenshotUrls[layer.key] = await uploadMapScreenshotToFirebase(
              container,
              opts.projectName,
              layer.filename
            );
          } catch (e) {
            console.warn(`Screenshot feilet for ${layer.key}:`, e);
          }
        }

        // Sett tilbake til kart
        opts.setMapLayer("kart");
      }

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

      await savePdfReport({
        userId: opts.userId,
        projectName: opts.projectName,
        pdfUrl: response.firebase_url,
        screenshotUrls,
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

      navigate("/filer");
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Something went wrong generating the PDF");
    } finally {
      setPdfSaving(false);
    }
  }

  return { pdfSaving, pdfError, setPdfError, handleGeneratePdf };
}