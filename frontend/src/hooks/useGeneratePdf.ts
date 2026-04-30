import { useState } from "react";
import { generatePdf } from "../api/pdf";
import { savePdfReport, uploadMapScreenshotToFirebase } from "../api/firebase";
import type { WeatherStation } from "../api/ivf";

type LatLng = { lat: number; lng: number };
type MapLayerKey = "kart" | "terreng" | "satellitt";

interface GeneratePdfOptions {
  userId: string;
  mapRef: React.MutableRefObject<any>;
  isDesktopViewport: boolean;
  mapLayer: MapLayerKey;
  setMapLayer: (layer: MapLayerKey) => void;
  propertyBoundary: any | null;
  pointA: LatLng | null;
  pointB: LatLng | null;
  mouseCoord: LatLng | null;
  clickedCoord: LatLng | null;
  projectName: string;
  elevation: number | null;
  length: number | null;
  concentrationTime: number | null;
  area: string;
  returnPeriod: string;
  climateFactor: string;
  maxDischarge: string;
  runoffCoefficient?: string;
  runoffAfterCoefficient?: string;
  runoffAfterDischarge?: string;
  runoffAdditionalDischarge?: string;
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
  key: MapLayerKey;
  filename: string;
  attribution: string;
  url: string;
  maxNativeZoom: number;
}> = [
  {
    key: "kart",
    filename: "kart.png",
    attribution: "© Kartverket (CC BY 4.0)",
    url: "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
    maxNativeZoom: 18,
  },
  {
    key: "terreng",
    filename: "terreng.png",
    attribution: "© Kartverket (CC BY 4.0)",
    url: "https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png",
    maxNativeZoom: 18,
  },
  {
    key: "satellitt",
    filename: "satellitt.png",
    attribution: "© Esri",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 18,
  },
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function getMapDebug(map: any, container: HTMLElement) {
  const center = map?.getCenter?.();
  const zoom = map?.getZoom?.();
  const rect = container.getBoundingClientRect();

  return (
    `center=${center ? `${center.lat.toFixed(6)},${center.lng.toFixed(6)}` : "n/a"}, ` +
    `zoom=${zoom ?? "n/a"}, ` +
    `rect=${Math.round(rect.width)}x${Math.round(rect.height)}, ` +
    `offset=${container.offsetWidth}x${container.offsetHeight}`
  );
}

function latLngToUtm33(lat: number, lng: number) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const lon0 = (15 * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const aTerm = cosLat * (lonRad - lon0);
  const m =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad));
  const easting =
    k0 * n * (aTerm + ((1 - t + c) * Math.pow(aTerm, 3)) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(aTerm, 5)) / 120) + 500000;
  let northing =
    k0 * (m + n * tanLat * ((aTerm * aTerm) / 2 + ((5 - t + 9 * c + 4 * c * c) * Math.pow(aTerm, 4)) / 24 + ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * Math.pow(aTerm, 6)) / 720));
  if (lat < 0) northing += 10000000;
  return { northing: Math.round(northing), easting: Math.round(easting - 500000) };
}

function latLngToWorldPixel(lat: number, lng: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clampedSinLat = Math.min(Math.max(sinLat, -0.9999), 0.9999);
  const scale = 256 * 2 ** zoom;

  return {
    x: ((lng + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + clampedSinLat) / (1 - clampedSinLat)) /
          (4 * Math.PI)) *
      scale,
  };
}

function resolveTileUrl(url: string, x: number, y: number, z: number) {
  return url
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{z}", String(z));
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function ringToPixels(
  ring: number[][],
  zoom: number,
  topLeft: { x: number; y: number }
) {
  return ring.map(([lng, lat]) => {
    const pixel = latLngToWorldPixel(lat, lng, zoom);
    return { x: pixel.x - topLeft.x, y: pixel.y - topLeft.y };
  });
}

function drawPolygonRings(
  ctx: CanvasRenderingContext2D,
  rings: number[][][],
  zoom: number,
  topLeft: { x: number; y: number }
) {
  if (!rings.length) return;

  ctx.beginPath();

  rings.forEach((ring) => {
    const pixels = ringToPixels(ring, zoom, topLeft);
    if (!pixels.length) return;

    ctx.moveTo(pixels[0].x, pixels[0].y);
    for (let i = 1; i < pixels.length; i += 1) {
      ctx.lineTo(pixels[i].x, pixels[i].y);
    }
    ctx.closePath();
  });

  ctx.fillStyle = "rgba(245, 158, 11, 0.5)";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.fill("evenodd");
  ctx.stroke();
}

function drawPropertyBoundary(
  ctx: CanvasRenderingContext2D,
  propertyBoundary: any,
  zoom: number,
  topLeft: { x: number; y: number }
) {
  const features = propertyBoundary?.features ?? [];

  features.forEach((feature: any) => {
    const geometry = feature?.geometry;
    const coords = geometry?.coordinates;
    if (!geometry?.type || !coords) return;

    if (geometry.type === "Polygon") {
      drawPolygonRings(ctx, coords, zoom, topLeft);
      return;
    }

    if (geometry.type === "MultiPolygon") {
      coords.forEach((polygon: number[][][]) => {
        drawPolygonRings(ctx, polygon, zoom, topLeft);
      });
    }
  });
}

function drawHeightPoint(
  ctx: CanvasRenderingContext2D,
  point: LatLng | null,
  zoom: number,
  topLeft: { x: number; y: number }
) {
  if (point?.lat == null || point?.lng == null) return;

  const pixel = latLngToWorldPixel(point.lat, point.lng, zoom);
  const x = pixel.x - topLeft.x;
  const y = pixel.y - topLeft.y;

  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(59, 130, 246, 0.18)";
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMapChrome(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  center: LatLng,
  zoom: number,
  utmSource: LatLng | null,
  layerKey: MapLayerKey
) {
  const metersPerPixel =
    (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** zoom;
  const ratio = Math.round(metersPerPixel / (0.0254 / 96));
  const maxMeters = metersPerPixel * 80;
  const exp = Math.floor(Math.log10(maxMeters));
  const d = 10 ** exp;
  const barMeters = maxMeters >= 5 * d ? 5 * d : maxMeters >= 2 * d ? 2 * d : d;
  const barLabel = barMeters >= 1000 ? `${barMeters / 1000} km` : `${barMeters} m`;
  const barWidth = Math.round(barMeters / metersPerPixel);

  ctx.save();
  ctx.font = "600 10px Arial, sans-serif";
  ctx.textBaseline = "middle";

  const scaleW = Math.max(190, barWidth + 112);
  const scaleH = 36;
  const scaleX = (width - scaleW) / 2;
  const scaleY = height - scaleH - 12;
  roundedRect(ctx, scaleX, scaleY, scaleW, scaleH, 8);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.stroke();

  const barX = scaleX + 16;
  const barY = scaleY + 11;
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX, barY + 6);
  ctx.lineTo(barX + barWidth, barY + 6);
  ctx.lineTo(barX + barWidth, barY);
  ctx.stroke();
  ctx.fillStyle = "#475569";
  ctx.textAlign = "center";
  ctx.fillText(barLabel, barX + barWidth / 2, scaleY + 25);
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(scaleX + barWidth + 40, scaleY + 8);
  ctx.lineTo(scaleX + barWidth + 40, scaleY + 28);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillText(`1 : ${ratio.toLocaleString("no-NO")}`, scaleX + barWidth + 52, scaleY + 18);

  const utmText = utmSource
    ? (() => {
        const utm = latLngToUtm33(utmSource.lat, utmSource.lng);
        return `EU89 UTM33 ${utm.northing}N ${utm.easting}Ø`;
      })()
    : "EU89 UTM33 -";

  ctx.font = "500 16px Arial, sans-serif";
  const utmW = ctx.measureText(utmText).width + 24;
  roundedRect(ctx, 12, height - 36, utmW, 24, 6);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.strokeStyle = "#d8c4b0";
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.fillText(utmText, 24, height - 24);

  const toggleX = width - 80;
  const toggleY = height / 2 - 90;
  roundedRect(ctx, toggleX - 8, toggleY - 8, 80, 196, 12);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fill();

  (["kart", "terreng", "satellitt"] as MapLayerKey[]).forEach((key, index) => {
    const y = toggleY + index * 64;
    roundedRect(ctx, toggleX, y, 64, 56, 8);
    ctx.fillStyle =
      key === "kart" ? "#dbeec5" : key === "terreng" ? "#f5f5db" : "#536b45";
    ctx.fill();
    ctx.strokeStyle = key === layerKey ? "#000000" : "#4b5563";
    ctx.lineWidth = key === layerKey ? 3 : 2;
    ctx.stroke();
  });

  ctx.restore();
}

async function drawTilesToCanvas(
  ctx: CanvasRenderingContext2D,
  layerConfig: (typeof MAP_LAYERS)[number],
  width: number,
  height: number,
  zoom: number,
  topLeft: { x: number; y: number }
) {
  const nativeZoom = Math.min(Math.round(zoom), layerConfig.maxNativeZoom);
  const zoomScale = 2 ** (zoom - nativeZoom);
  const nativeTopLeft = {
    x: topLeft.x / zoomScale,
    y: topLeft.y / zoomScale,
  };

  const startX = Math.floor(nativeTopLeft.x / 256);
  const startY = Math.floor(nativeTopLeft.y / 256);
  const endX = Math.ceil((nativeTopLeft.x + width / zoomScale) / 256);
  const endY = Math.ceil((nativeTopLeft.y + height / zoomScale) / 256);
  const tileCount = 2 ** nativeZoom;

  const jobs: Promise<void>[] = [];

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      if (y < 0 || y >= tileCount) continue;

      jobs.push(
        loadCanvasImage(resolveTileUrl(layerConfig.url, wrappedX, y, nativeZoom)).then((img) => {
          if (!img) return;

          const drawX = (x * 256 - nativeTopLeft.x) * zoomScale;
          const drawY = (y * 256 - nativeTopLeft.y) * zoomScale;
          const drawSize = 256 * zoomScale;
          ctx.drawImage(img, drawX, drawY, drawSize, drawSize);
        })
      );
    }
  }

  await Promise.all(jobs);
}

async function waitForLeafletToSettle(map: any, container: HTMLElement, timeoutMs = 5000) {
  map?.stop?.();
  map?.invalidateSize?.({ pan: false, animate: false });

  await nextFrame();
  await nextFrame();

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const tiles = Array.from(
      container.querySelectorAll<HTMLImageElement>(".leaflet-tile")
    ).filter((tile) => {
      const style = window.getComputedStyle(tile);
      return style.display !== "none" && style.visibility !== "hidden";
    });

    const pendingTiles = tiles.filter((tile) => {
      const style = window.getComputedStyle(tile);
      return (
        !tile.complete ||
        tile.naturalWidth === 0 ||
        style.opacity === "0" ||
        tile.classList.contains("leaflet-tile-loading")
      );
    });

    if (tiles.length > 0 && pendingTiles.length === 0) {
      await wait(150);
      return;
    }

    await wait(100);
  }

  console.warn(`[Screenshot] Tile wait timeout. ${getMapDebug(map, container)}`);
}

async function capturePrintMapAsBlob(
  sourceContainer: HTMLElement,
  sourceMap: any,
  opts: GeneratePdfOptions,
  layerKey: MapLayerKey
): Promise<Blob | null> {
  const layerConfig = MAP_LAYERS.find((layer) => layer.key === layerKey);
  if (!layerConfig) return null;

  try {
    const rect = sourceContainer.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(240, Math.round(rect.height));
    const center = sourceMap.getCenter();
    const zoom = sourceMap.getZoom();
    const centerPoint = latLngToWorldPixel(center.lat, center.lng, zoom);
    const topLeft = {
      x: centerPoint.x - width / 2,
      y: centerPoint.y - height / 2,
    };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Kunne ikke opprette canvas for kartbilde.");
    }

    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(0, 0, width, height);

    await drawTilesToCanvas(ctx, layerConfig, width, height, zoom, topLeft);
    drawPropertyBoundary(ctx, opts.propertyBoundary, zoom, topLeft);
    drawHeightPoint(ctx, opts.pointA, zoom, topLeft);
    drawHeightPoint(ctx, opts.pointB, zoom, topLeft);
    drawMapChrome(
      ctx,
      width,
      height,
      { lat: center.lat, lng: center.lng },
      zoom,
      opts.mouseCoord ?? opts.clickedCoord,
      layerKey
    );

    console.log(
      `[Screenshot] Canvas-export ${layerKey}: ${canvas.width}x${canvas.height}; ` +
        `source=${getMapDebug(sourceMap, sourceContainer)}`
    );

    return await canvasToPngBlob(canvas);
  } catch (e) {
    console.warn(`[Screenshot] Canvas-kart feilet for "${layerKey}":`, e);
    return null;
  }
}

function describeContainer(container: HTMLElement | null, isDesktopViewport: boolean) {
  if (!container) {
    return {
      ok: false,
      message: "Fant ikke aktiv Leaflet-kartcontainer.",
    };
  }

  const rect = container.getBoundingClientRect();
  const style = window.getComputedStyle(container);
  const details =
    `viewport=${window.innerWidth}x${window.innerHeight}, ` +
    `desktop=${isDesktopViewport}, ` +
    `rect=${Math.round(rect.width)}x${Math.round(rect.height)}, ` +
    `offset=${container.offsetWidth}x${container.offsetHeight}, ` +
    `display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}`;

  if (!isDesktopViewport) {
    return {
      ok: false,
      message: `Kartbilder kan foreløpig bare genereres i desktop-visning. ${details}`,
    };
  }

  if (
    rect.width < 50 ||
    rect.height < 50 ||
    container.offsetWidth < 50 ||
    container.offsetHeight < 50 ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  ) {
    return {
      ok: false,
      message: `Kartet er ikke synlig nok til screenshot. ${details}`,
    };
  }

  return {
    ok: true,
    message: details,
  };
}

async function canvasToPngBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });

  if (blob && blob.size > 0) return blob;

  const dataUrl = canvas.toDataURL("image/png");
  const [header, base64] = dataUrl.split(",");

  if (!header?.startsWith("data:image/png") || !base64) {
    throw new Error("Kunne ikke konvertere kartutsnitt til PNG.");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const fallbackBlob = new Blob([bytes], { type: "image/png" });

  if (fallbackBlob.size === 0) {
    throw new Error("Kartutsnittet ble 0 bytes etter PNG-konvertering.");
  }

  return fallbackBlob;
}

async function captureLayerAsBlob(
  container: HTMLElement,
  mapRef: React.MutableRefObject<any>,
  layerKey: MapLayerKey,
  opts: GeneratePdfOptions,
): Promise<Blob | null> {
  try {
    await waitForLeafletToSettle(mapRef.current, container);
  } catch (e) {
    console.warn(`[Screenshot] Kunne ikke stabilisere kartet for "${layerKey}":`, e);
  }

  const printBlob = await capturePrintMapAsBlob(
    container,
    mapRef.current,
    opts,
    layerKey
  );

  if (printBlob && printBlob.size > 0) {
    return printBlob;
  }

  return null;
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

      await nextFrame();
      await nextFrame();

      const container = opts.mapRef.current?.getContainer?.() as HTMLElement | null;
      const containerStatus = describeContainer(container, opts.isDesktopViewport);

      if (containerStatus.ok && container) {
        console.log(`[Screenshot] leaflet-container: ${containerStatus.message}`);
        const screenshotId = new Date()
          .toISOString()
          .replace(/[-:.TZ]/g, "")
          .slice(0, 14);

        for (const layer of MAP_LAYERS) {
          try {
            console.log(`[Screenshot] Capture layer ${layer.key}...`);
            await nextFrame();
            await nextFrame();

            const blob = await captureLayerAsBlob(
              container,
              opts.mapRef,
              layer.key,
              opts
            );

            if (blob && blob.size > 0) {
              const filename = `${screenshotId}_${layer.filename}`;
              const url = await uploadMapScreenshotToFirebase(
                blob,
                opts.projectName,
                filename
              );
              console.log(`[Screenshot] Lastet opp ${layer.key}:`, url);
              screenshotUrls[layer.key] = url;
              mapImageUrls.push(url);
            } else {
              console.warn(`[Screenshot] Blob tom/null for ${layer.key}`);
            }
          } catch (e) {
            console.error(`[Screenshot] Feil for ${layer.key}:`, e);
          }
        }

        console.log("[Screenshot] Ferdig. mapImageUrls:", mapImageUrls);

        if (mapImageUrls.length === 0) {
          throw new Error("Kunne ikke lage kartbilder til rapporten.");
        }
      } else {
        console.warn(`[Screenshot] ${containerStatus.message}`);
        throw new Error(containerStatus.message);
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
        phi: Number(opts.runoffCoefficient || 0.9),
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
          runoffCoefficient: opts.runoffCoefficient ?? "",
          runoffAfterCoefficient: opts.runoffAfterCoefficient ?? "",
          runoffAfterDischarge: opts.runoffAfterDischarge ?? "",
          runoffAdditionalDischarge: opts.runoffAdditionalDischarge ?? "",
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
