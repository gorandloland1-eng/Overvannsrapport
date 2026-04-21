// @ts-nocheck
import { db, storage } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ---------------------------------------------------------------------------
// PDF REPORTS
// ---------------------------------------------------------------------------

export interface PdfReportData {
  userId: string;
  projectName: string;
  pdfUrl: string;
  screenshotUrl: string | null;
  data: {
    area: string;
    returnPeriod: string;
    climateFactor: string;
    maxDischarge: string;
    elevation: number | null;
    length: number | null;
    concentrationTime: number | null;
    selectedWeatherStationName: string;
    infiltration: number;
    address: string | null;
    gnr: number | null;
    bnr: number | null;
  };
}

export async function savePdfReport(report: PdfReportData): Promise<void> {
  await addDoc(collection(db, "pdfReports"), {
    userId: report.userId,
    projectName: report.projectName.trim() || "Unknown project",
    description: "Stormwater report",
    pdfUrl: report.pdfUrl,
    screenshotUrl: report.screenshotUrl,
    createdAt: serverTimestamp(),
    data: report.data,
  });
}

// ---------------------------------------------------------------------------
// SCREENSHOTS
// ---------------------------------------------------------------------------

export async function uploadMapScreenshot(
  mapContainer: HTMLElement,
  userId: string
): Promise<string> {
  const html2canvas = (await import("html2canvas")).default;

  const canvas = await html2canvas(mapContainer, {
    useCORS: true,
    allowTaint: true,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Failed to create blob"));
      const storageRef = ref(storage, `screenshots/${userId}/${Date.now()}.png`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      resolve(url);
    }, "image/png");
  });
}

async function handleGeneratePdf() {
  setPdfSaving(true);
  setPdfError("");
  try {
    const qInf = infiltrationMethod === "direct"
      ? Number(manualQInf || 0)
      : (() => {
          const st = soilTypes.find((j) => j.id === selectedSoilType);
          if (!st) return 0;
          return st.k_m_s * (Number(bottomArea || 0) * 0.5 + Number(sideArea || 0) * 1.0) * 1000;
        })();

    // Ta screenshot av kartet
    let screenshotUrl: string | null = null;
    if (mapRef.current) {
      try {
        screenshotUrl = await uploadMapScreenshot(mapRef.current.getContainer(), user.uid);
      } catch (e) {
        console.warn("Screenshot feilet, fortsetter uten:", e);
      }
    }

    const response = await generatePdf({
      project_name: projectName,
      height: elevation ?? 0,
      length: length ?? 0,
      time_of_concentration: concentrationTime ?? 0,
      areal: Number(area),
      returperiode: Number(returnPeriod),
      klimafaktor: Number(climateFactor),
      maks_paslipp: Number(maxDischarge),
      infiltrasjonskapasitet: qInf,
      eiendom_adresse: propertyAddress,
      eiendom_gnr: propertyMatrikkel?.gnr ?? null,
      eiendom_bnr: propertyMatrikkel?.bnr ?? null,
      phi: 0.9,
      selected_weather_station: selectedStationId,
      selected_weather_station_name: selectedStation?.name ?? "",
    });

    await savePdfReport({
      userId: user.uid,
      projectName,
      pdfUrl: response.firebase_url,
      screenshotUrl,
      data: {
        area, returnPeriod, climateFactor, maxDischarge,
        elevation, length, concentrationTime,
        selectedWeatherStationName: selectedStation?.name ?? "",
        infiltration: qInf,
        address: propertyAddress,
        gnr: propertyMatrikkel?.gnr ?? null,
        bnr: propertyMatrikkel?.bnr ?? null,
      },
    });

    navigate("/filer");
  } catch (e) {
    setPdfError(e instanceof Error ? e.message : "Something went wrong generating the PDF");
  } finally {
    setPdfSaving(false);
  }
}