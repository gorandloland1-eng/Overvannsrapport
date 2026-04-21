// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";

export default function MapScale() {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState({ ratio: 0, barWidth: 80, barLabel: "100 m" });

  useEffect(() => {
    function update() {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const metersPerPixel =
        (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom);
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
    <div
      ref={ref}
      className="absolute bottom-3 left-1/2 z-1000 flex select-none items-center gap-3 rounded-lg border border-white/40 bg-white/80 px-3 py-1.5 shadow backdrop-blur-sm"
      style={{ transform: "translateX(-50%)" }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="border-b-2 border-l-2 border-r-2 border-slate-600"
          style={{ width: info.barWidth, height: 6 }}
        />
        <span className="text-[10px] font-medium text-slate-600">{info.barLabel}</span>
      </div>
      <div className="border-l border-slate-300 pl-3 text-[10px] font-semibold text-slate-600">
        1 : {info.ratio.toLocaleString("no-NO")}
      </div>
    </div>
  );
}