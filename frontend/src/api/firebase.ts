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
    screenshotUrls: {
      kart: report.screenshotUrls?.kart ?? null,
      terreng: report.screenshotUrls?.terreng ?? null,
      satellitt: report.screenshotUrls?.satellitt ?? null,
    },
    createdAt: serverTimestamp(),
    data: report.data,
  });
}

// ---------------------------------------------------------------------------
// SCREENSHOTS
// ---------------------------------------------------------------------------

async function captureMapBlob(mapContainer: HTMLElement): Promise<Blob> {
  const html2canvas = (await import("html2canvas-pro")).default;

  // Patch oklab/oklch farger direkte på elementet FØR html2canvas kjøres
  const allElements = mapContainer.querySelectorAll("*");
  const patched: Array<{ el: HTMLElement; prop: string; original: string }> = [];

  allElements.forEach((node) => {
    const el = node as HTMLElement;
    try {
      const style = window.getComputedStyle(el);
      const props = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"];
      props.forEach((prop) => {
        const val = style[prop];
        if (val && (val.includes("oklab") || val.includes("oklch"))) {
          patched.push({ el, prop, original: el.style[prop] });
          el.style[prop] = prop.includes("background") ? "#ffffff" : "#000000";
        }
      });
    } catch (_) {}
  });

  const canvas = await html2canvas(mapContainer, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    ignoreElements: (element) =>
      element.classList.contains("leaflet-control-container"),
  });

  // Restore original styles
  patched.forEach(({ el, prop, original }) => {
    el.style[prop] = original;
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Failed to create blob"));
      resolve(blob);
    }, "image/png");
  });
}

export async function uploadMapScreenshotToFirebase(
  mapContainer: HTMLElement,
  projectName: string,
  filename: string
): Promise<string> {
  const blob = await captureMapBlob(mapContainer);
  const safeName = projectName.trim().replace(/[^a-zA-Z0-9_\-]/g, "_") || "unknown";
  const storageRef = ref(storage, `rapporter/${safeName}/screenshots/${filename}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function saveMapScreenshotLocally(
  mapContainer: HTMLElement,
  projectName: string
): Promise<string> {
  const blob = await captureMapBlob(mapContainer);

  const formData = new FormData();
  formData.append("project_name", projectName);
  formData.append("image", blob, "map.png");

  const res = await fetch("http://localhost:8000/uploads/screenshot", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error((await res.text()) || "Could not save screenshot locally");
  }

  const data = await res.json();
  return data.filepath;
}