// @ts-nocheck
import html2canvas from "html2canvas";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export async function takeMapScreenshot(
  mapContainer: HTMLElement,
  userId: string
): Promise<string> {
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