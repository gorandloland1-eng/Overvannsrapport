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
  calcPdfUrl?: string | null;
  mapImageUrls?: string[];
  screenshotUrls: {
    kart?: string;
    terreng?: string;
    satellitt?: string;
  } | null;
  data: {
    area: string;
    returnPeriod: string;
    climateFactor: string;
    maxDischarge: string;
    runoffCoefficient?: string;
    runoffAfterCoefficient?: string;
    runoffAfterDischarge?: string;
    runoffAdditionalDischarge?: string;
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
  const description = report.data.address
    ? `Rapport fra ${report.data.address}`
    : "Overvannsrapport";

  await addDoc(collection(db, "pdfReports"), {
    userId: report.userId,
    projectName: report.projectName.trim() || "Unknown project",
    description,
    pdfUrl: report.pdfUrl,
    calcPdfUrl: report.calcPdfUrl ?? null,
    mapImageUrls: report.mapImageUrls ?? [],
    screenshotUrls: {
      kart: report.screenshotUrls?.kart ?? null,
      terreng: report.screenshotUrls?.terreng ?? null,
      satellitt: report.screenshotUrls?.satellitt ?? null,
    },
    createdAt: serverTimestamp(),
    data: report.data,
  });
}

export async function uploadMapScreenshotToFirebase(
  blob: Blob,
  projectName: string,
  filename: string
): Promise<string> {
  if (blob.size === 0) {
    throw new Error(`Kartbildet "${filename}" er 0 bytes og ble ikke lastet opp.`);
  }

  const safeName = projectName.trim().replace(/[^a-zA-Z0-9_\-]/g, "_") || "unknown";
  const storageRef = ref(storage, `rapporter/${safeName}/screenshots/${filename}`);
  await uploadBytes(storageRef, blob, {
    contentType: "image/png",
    cacheControl: "public,max-age=3600",
  });
  return getDownloadURL(storageRef);
}
