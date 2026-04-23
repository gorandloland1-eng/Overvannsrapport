// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import { Map, Table2 } from "lucide-react";
import type { IvfResponse, WeatherStation } from "../../api/ivf";

type LatLng = { lat: number; lng: number };

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
    k0 * n * (aTerm + ((1 - t + c) * Math.pow(aTerm, 3)) / 6 +
      ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(aTerm, 5)) / 120) + 500000;
  let northing =
    k0 * (m + n * tanLat * ((aTerm * aTerm) / 2 +
      ((5 - t + 9 * c + 4 * c * c) * Math.pow(aTerm, 4)) / 24 +
      ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * Math.pow(aTerm, 6)) / 720));
  if (lat < 0) northing += 10000000;
  return { northing: Math.round(northing), easting: Math.round(easting - 500000) };
}

function MapClickHandler({ onPick, onSingleClick, onCancelSingleClick, onMouseMove }) {
  const map = useMapEvents({
    click(e) {
      // Ignorer klikk fra UI-elementer
      if (e.originalEvent?.target?.closest?.(".leaflet-control-container")) return;
      onSingleClick(e.latlng.lat, e.latlng.lng);
    },
    dblclick(e) { onCancelSingleClick(); onPick(e.latlng.lat, e.latlng.lng); },
    mousemove(e) { onMouseMove(e.latlng.lat, e.latlng.lng); },
  });
  useEffect(() => { map.doubleClickZoom.disable(); }, [map]);
  return null;
}

function MapLayerToggle({ layer, onChange }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);

  return (
    <div
      ref={ref}
      className="absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2 rounded-xl bg-white/35 p-2 backdrop-blur-sm dark:bg-slate-900/30"
    >
      <button type="button" onClick={() => onChange("kart")}
        className={`h-14 w-16 overflow-hidden rounded-lg border-2 shadow transition ${layer === "kart" ? "border-black ring-2 ring-white/90" : "border-gray-600 bg-white/85 opacity-90 hover:opacity-100"}`}
        title="Kart">
        <img src="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/12/1164/2154.png" alt="Kartlag" className="h-full w-full object-cover" />
      </button>
      <button type="button" onClick={() => onChange("terreng")}
        className={`h-14 w-16 overflow-hidden rounded-lg border-2 shadow transition ${layer === "terreng" ? "border-black ring-2 ring-white/90" : "border-gray-600 bg-white/85 opacity-90 hover:opacity-100"}`}
        title="Terreng">
        <img src="https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/12/1164/2154.png" alt="Terrenglag" className="h-full w-full object-cover" />
      </button>
      <button type="button" onClick={() => onChange("satellitt")}
        className={`h-14 w-16 overflow-hidden rounded-lg border-2 shadow transition ${layer === "satellitt" ? "border-black ring-2 ring-white/90" : "border-gray-600 bg-white/85 opacity-90 hover:opacity-100"}`}
        title="Satellitt">
        <img src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1164/2154" alt="Satellittlag" className="h-full w-full object-cover" />
      </button>
    </div>
  );
}

function MapScale() {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState({ ratio: 0, barWidth: 80, barLabel: "100 m" });

  useEffect(() => {
    function update() {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const metersPerPixel = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom);
      const ratio = Math.round(metersPerPixel / (0.0254 / 96));
      const maxMeters = metersPerPixel * 80;
      const exp = Math.floor(Math.log10(maxMeters));
      const d = Math.pow(10, exp);
      const barMeters = maxMeters >= 5 * d ? 5 * d : maxMeters >= 2 * d ? 2 * d : d;
      const barLabel = barMeters >= 1000 ? `${barMeters / 1000} km` : `${barMeters} m`;
      const barWidth = Math.round(barMeters / metersPerPixel);
      setInfo({ ratio, barWidth, barLabel });
    }
    map.on("zoomend moveend", update);
    update();
    return () => { map.off("zoomend moveend", update); };
  }, [map]);

  useEffect(() => {
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);

  return (
    <div ref={ref} className="absolute bottom-3 left-1/2 z-1000 flex select-none items-center gap-3 rounded-lg border border-white/40 bg-white/80 px-3 py-1.5 shadow backdrop-blur-sm" style={{ transform: "translateX(-50%)" }}>
      <div className="flex flex-col items-center gap-0.5">
        <div className="border-b-2 border-l-2 border-r-2 border-slate-600" style={{ width: info.barWidth, height: 6 }} />
        <span className="text-[10px] font-medium text-slate-600">{info.barLabel}</span>
      </div>
      <div className="border-l border-slate-300 pl-3 text-[10px] font-semibold text-slate-600">
        1 : {info.ratio.toLocaleString("no-NO")}
      </div>
    </div>
  );
}

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

interface PropertyMapProps {
  mapRef: React.MutableRefObject<any>;
  mapLayer: "kart" | "terreng" | "satellitt";
  setMapLayer: (layer: "kart" | "terreng" | "satellitt") => void;
  propertyBoundary: object | null;
  pointA: LatLng | null;
  pointB: LatLng | null;
  mouseCoord: LatLng | null;
  clickedCoord: LatLng | null;
  onPick: (lat: number, lng: number) => void;
  onSingleClick: (lat: number, lng: number) => void;
  onCancelSingleClick: () => void;
  onMouseMove: (lat: number, lng: number) => void;
}

export default function PropertyMap({
  mapRef,
  mapLayer,
  setMapLayer,
  propertyBoundary,
  pointA,
  pointB,
  mouseCoord,
  clickedCoord,
  onPick,
  onSingleClick,
  onCancelSingleClick,
  onMouseMove,
}: PropertyMapProps) {
  const utmSource = mouseCoord ?? clickedCoord;

const [boundaryKey, setBoundaryKey] = useState<string | null>(null);

useEffect(() => {
  if (propertyBoundary) {
    setBoundaryKey((prev) => prev ?? Date.now().toString());
  } else {
    setBoundaryKey(null);
  }
}, [propertyBoundary]);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[60.3913, 5.3221]}
        zoom={13}
        maxZoom={20}
        className="h-full w-full"
        doubleClickZoom={false}
      >
        <MapController mapRef={mapRef} />
        <MapClickHandler
          onPick={onPick}
          onSingleClick={onSingleClick}
          onCancelSingleClick={onCancelSingleClick}
          onMouseMove={onMouseMove}
        />
        <MapLayerToggle layer={mapLayer} onChange={setMapLayer} />
        <MapScale />
        {mapLayer !== "terreng" && (
          <TileLayer
            attribution="© Kartverket (CC BY 4.0)"
            url={
              mapLayer === "kart"
                ? "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
                : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            }
            maxZoom={20}
            maxNativeZoom={18}
          />
        )}
        {mapLayer === "terreng" && (
          <TileLayer
            url="https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png"
            attribution="© Kartverket (CC BY 4.0)"
            maxZoom={20}
            maxNativeZoom={18}
          />
        )}
        {propertyBoundary?.features?.length > 0 && (
        <GeoJSON
            key={boundaryKey}
            data={propertyBoundary}
            style={{ color: "#f59e0b", weight: 3, fillOpacity: 0.5, fillColor: "#f59e0b" }}
        />
        )}
        {pointA?.lat != null && pointA?.lng != null && (
          <CircleMarker center={[pointA.lat, pointA.lng]} radius={7} />
        )}
        {pointB?.lat != null && pointB?.lng != null && (
          <CircleMarker center={[pointB.lat, pointB.lng]} radius={7} />
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1001] rounded-md border border-[#d8c4b0] bg-white/95 px-3 py-1 text-[16px] font-medium leading-none tracking-wide text-black shadow">
          {utmSource
            ? (() => { const utm = latLngToUtm33(utmSource.lat, utmSource.lng); return `EU89 UTM33 ${utm.northing}N ${utm.easting}Ø`; })()
            : "EU89 UTM33 -"}
        </div>
      </MapContainer>
    </div>
  );
}