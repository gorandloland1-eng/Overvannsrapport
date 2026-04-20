// @ts-nocheck
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  CircleMarker,
  GeoJSON,
  useMap,
} from "react-leaflet";
import logo from "../assets/logo.png";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { Map, Table2 } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { fetchPropertyByPoint, fetchPropertyByMatrikkel } from "../api/property";
import { fetchTerrain } from "../api/terrain";
import { fetchWeatherStations, fetchIvfData } from "../api/ivf";
import { generatePdf } from "../api/pdf";
import type { IvfResponse, WeatherStation } from "../api/ivf";

type LatLng = { lat: number; lng: number };

function MapClickHandler({ onPick, onSingleClick, onCancelSingleClick, onMouseMove }) {
  const map = useMapEvents({
    click(e) { onSingleClick(e.latlng.lat, e.latlng.lng); },
    dblclick(e) { onCancelSingleClick(); onPick(e.latlng.lat, e.latlng.lng); },
    mousemove(e) { onMouseMove(e.latlng.lat, e.latlng.lng); },
  });
  useEffect(() => { map.doubleClickZoom.disable(); }, [map]);
  return null;
}

function MapLayerToggle({ layer, onChange }) {
  return (
    <div className="absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2 rounded-xl bg-white/35 p-2 backdrop-blur-sm dark:bg-slate-900/30">
      <button
        type="button"
        onClick={() => onChange("kart")}
        className={`h-14 w-16 overflow-hidden rounded-lg border-2 shadow transition ${
          layer === "kart"
            ? "border-black ring-2 ring-white/90"
            : "border-gray-600 bg-white/85 opacity-90 hover:opacity-100"
        }`}
        title="Kart"
      >
        <img
          src="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/12/1164/2154.png"
          alt="Kartlag"
          className="h-full w-full object-cover"
        />
      </button>
      <button
        type="button"
        onClick={() => onChange("terreng")}
        className={`h-14 w-16 overflow-hidden rounded-lg border-2 shadow transition ${
          layer === "terreng"
            ? "border-black ring-2 ring-white/90"
            : "border-gray-600 bg-white/85 opacity-90 hover:opacity-100"
        }`}
        title="Terreng"
      >
        <img
          src="https://a.tile.opentopomap.org/12/1164/2154.png"
          alt="Terrenglag"
          className="h-full w-full object-cover"
        />
      </button>
      <button
        type="button"
        onClick={() => onChange("satellitt")}
        className={`h-14 w-16 overflow-hidden rounded-lg border-2 shadow transition ${
          layer === "satellitt"
            ? "border-black ring-2 ring-white/90"
            : "border-gray-600 bg-white/85 opacity-90 hover:opacity-100"
        }`}
        title="Satellitt"
      >
        <img
          src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1164/2154"
          alt="Satellittlag"
          className="h-full w-full object-cover"
        />
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

function MapController({ mapRef }: { mapRef: React.MutableRefObject<any> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
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
    k0 *
      n *
      (aTerm +
        ((1 - t + c) * Math.pow(aTerm, 3)) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(aTerm, 5)) / 120) +
    500000;
  let northing =
    k0 *
    (m +
      n *
        tanLat *
        ((aTerm * aTerm) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * Math.pow(aTerm, 4)) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * Math.pow(aTerm, 6)) / 720));
  if (lat < 0) northing += 10000000;
  return { northing: Math.round(northing), easting: Math.round(easting - 500000) };
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // UI state
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<"map" | "ivf">("map");
  const [mapLayer, setMapLayer] = useState<"kart" | "terreng" | "satellitt">("kart");
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const mapRef = useRef(null);

  // Project
  const [projectName, setProjectName] = useState("");

  // Property
  const [propertyBoundary, setPropertyBoundary] = useState<object | null>(null);
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null);
  const [propertyMatrikkel, setPropertyMatrikkel] = useState<{
    gnr: number; bnr: number; kommunenummer: string;
  } | null>(null);
  const [clickedCoord, setClickedCoord] = useState<LatLng | null>(null);
  const [mouseCoord, setMouseCoord] = useState<LatLng | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertyError, setPropertyError] = useState("");

  // Manual matrikkel lookup
  const [municipalityNumber, setMunicipalityNumber] = useState("");
  const [cadastralNumber, setCadastralNumber] = useState("");
  const [propertyNumber, setPropertyNumber] = useState("");
  const [matrikkelLoading, setMatrikkelLoading] = useState(false);

  // Terrain
  const [pointA, setPointA] = useState<LatLng | null>(null);
  const [pointB, setPointB] = useState<LatLng | null>(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [length, setLength] = useState<number | null>(null);
  const [concentrationTime, setConcentrationTime] = useState<number | null>(null);
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainError, setTerrainError] = useState("");

  // Weather / IVF
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [ivfData, setIvfData] = useState<IvfResponse | null>(null);
  const [ivfLoading, setIvfLoading] = useState(false);
  const [ivfError, setIvfError] = useState("");
  const stationBoxRef = useRef(null);

  // Calculation inputs
  const [area, setArea] = useState("200");
  const [returnPeriod, setReturnPeriod] = useState("5");
  const [climateFactor, setClimateFactor] = useState("1.0");
  const [maxDischarge, setMaxDischarge] = useState("0.0");
  const [infiltrationMethod, setInfiltrationMethod] = useState<"direct" | "soiltype">("direct");
  const [selectedSoilType, setSelectedSoilType] = useState("");
  const [bottomArea, setBottomArea] = useState("");
  const [sideArea, setSideArea] = useState("");
  const [manualQInf, setManualQInf] = useState("");
  const [soilTypes, setSoilTypes] = useState([]);

  // PDF
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const singleClickTimer = useRef(null);

  // --- Effects ---
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    fetchWeatherStations()
      .then((data) => {
        if (data.length > 0) {
          setWeatherStations(data);
          setSelectedStationId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedStationId) return;
    setIvfLoading(true);
    setIvfError("");
    fetchIvfData(selectedStationId)
      .then(setIvfData)
      .catch((e) => setIvfError(e.message))
      .finally(() => setIvfLoading(false));
  }, [selectedStationId]);

  useEffect(() => {
    fetch("http://localhost:8000/calculation/jordtyper")
      .then((r) => r.json())
      .then(setSoilTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuOpen && !menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target))
        setMenuOpen(false);
      if (stationDropdownOpen && !stationBoxRef.current?.contains(e.target))
        setStationDropdownOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen, stationDropdownOpen]);

  // --- Derived ---
  const selectedStation = weatherStations.find((s) => s.id === selectedStationId);
  const filteredStations = weatherStations.filter((s) =>
    `${s.name} ${s.municipality ?? ""} ${s.county ?? ""}`
      .toLowerCase()
      .includes(stationSearch.toLowerCase())
  );

  // --- Handlers ---
  function handleMapPick(lat: number, lng: number) {
    if (!pointA || (pointA && pointB)) {
      setPointA({ lat, lng });
      setPointB(null);
      setElevation(null);
      setLength(null);
      setConcentrationTime(null);
      setTerrainError("");
      return;
    }
    const b = { lat, lng };
    setPointB(b);
    setTerrainLoading(true);
    setTerrainError("");
    fetchTerrain(pointA.lat, pointA.lng, lat, lng)
      .then((data) => {
        setLength(data.lengde_m);
        setElevation(data.hoydeforskjell_m);
        setConcentrationTime(data.konsentrasjonstid_ivf_min);
      })
      .catch((e) => {
        setTerrainError(e.message);
        setLength(null);
        setElevation(null);
        setConcentrationTime(null);
      })
      .finally(() => setTerrainLoading(false));
  }

  function handleMapSingleClick(lat: number, lng: number) {
    if (singleClickTimer.current) clearTimeout(singleClickTimer.current);
    singleClickTimer.current = setTimeout(async () => {
      setPropertyLoading(true);
      setPropertyError("");
      setPropertyBoundary(null);
      setPropertyAddress(null);
      setPropertyMatrikkel(null);
      setClickedCoord({ lat, lng });
      try {
        const data = await fetchPropertyByPoint(lat, lng);
        setPropertyAddress(data.adresse ?? null);
        setPropertyBoundary(data.grense ?? null);
        if (data.matrikkel) {
          setPropertyMatrikkel(data.matrikkel);
          setMunicipalityNumber(data.matrikkel.kommunenummer);
          setCadastralNumber(String(data.matrikkel.gnr));
          setPropertyNumber(String(data.matrikkel.bnr));
        }
        if (data.warnings?.length > 0) setPropertyError(data.warnings.join(" "));
      } catch {
        setPropertyError("Could not fetch property data.");
      } finally {
        setPropertyLoading(false);
      }
    }, 300);
  }

  async function handleMatrikkelLookup() {
    if (!municipalityNumber || !cadastralNumber || !propertyNumber) return;
    setMatrikkelLoading(true);
    setPropertyError("");
    setPropertyBoundary(null);
    setPropertyAddress(null);
    setPropertyMatrikkel(null);
  
    try {
      const data = await fetchPropertyByMatrikkel(
        municipalityNumber,
        Number(cadastralNumber),
        Number(propertyNumber)
      );
  
      // Set address
      setPropertyAddress(data.adresse ?? null);
  
      // Set boundary (polygon as GeoJSON FeatureCollection)
      setPropertyBoundary(data.polygon ?? null);
  
      // Set matrikkel info
      setPropertyMatrikkel({
        gnr: data.gardsnummer,
        bnr: data.bruksnummer,
        kommunenummer: data.kommunenummer,
      });
  
      // Auto-zoom til eiendommen
      if (data.bounds && mapRef.current) {
        mapRef.current.fitBounds(
          [
            [data.bounds.south, data.bounds.west],
            [data.bounds.north, data.bounds.east],
          ],
          { padding: [40, 40] }
        );
      }
  
      if (data.warnings?.length > 0) setPropertyError(data.warnings.join(" "));
    } catch (e) {
      setPropertyError(e instanceof Error ? e.message : "Could not look up property.");
    } finally {
      setMatrikkelLoading(false);
    }
  }

  function cancelSingleClick() {
    if (singleClickTimer.current) clearTimeout(singleClickTimer.current);
  }

  function handleReset() {
    setProjectName("");
    setArea("200");
    setReturnPeriod("5");
    setClimateFactor("1.0");
    setMaxDischarge("0.0");
    setPointA(null);
    setPointB(null);
    setElevation(null);
    setLength(null);
    setConcentrationTime(null);
    setPropertyBoundary(null);
    setPropertyAddress(null);
    setPropertyMatrikkel(null);
    setClickedCoord(null);
    setPropertyError("");
    setMunicipalityNumber("");
    setCadastralNumber("");
    setPropertyNumber("");
    setSelectedSoilType("");
    setBottomArea("");
    setSideArea("");
    setManualQInf("");
    setInfiltrationMethod("direct");
    setPdfError("");
  }

  async function handleGeneratePdf() {
    setPdfSaving(true);
    setPdfError("");
    try {
      const qInf =
        infiltrationMethod === "direct"
          ? Number(manualQInf || 0)
          : (() => {
              const st = soilTypes.find((j) => j.id === selectedSoilType);
              if (!st) return 0;
              return st.k_m_s * (Number(bottomArea || 0) * 0.5 + Number(sideArea || 0) * 1.0) * 1000;
            })();

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

      await addDoc(collection(db, "pdfReports"), {
        userId: user.uid,
        projectName: projectName.trim() || "Unknown project",
        description: "Stormwater report",
        pdfUrl: response.firebase_url,
        createdAt: serverTimestamp(),
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

  // --- Render ---
  return (
    <div className="min-h-dvh w-full bg-[#F6F8FF] dark:bg-slate-950">
      <header className="sticky top-0 z-[9999] w-full bg-[#213F53] dark:bg-slate-950">
        <div className="flex h-16 w-full items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Trygt Overvann logo" className="h-10 w-auto cursor-pointer object-contain" />
            <div className="text-lg font-semibold text-white">Trygt Overvann AS</div>
          </Link>
          <div className="flex-1" />
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-white transition hover:opacity-90 ${
                user?.photoURL ? "" : "border-[3px] border-white hover:bg-white/10"
              }`}
              aria-label="Profile menu"
              aria-expanded={menuOpen}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <svg width="35" height="35" viewBox="0 0 24 24" aria-hidden="true">
                  <defs>
                    <clipPath id="avatarClip">
                      <circle cx="12" cy="12" r="10.2" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#avatarClip)" transform="translate(0,3)">
                    <rect x="0" y="18.5" width="24" height="6" fill="currentColor" />
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path d="M4.2 19.2c1.4-4.2 5.1-6.5 7.8-6.5s6.4 2.3 7.8 6.5" fill="currentColor" />
                  </g>
                </svg>
              )}
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-3 z-[9999] w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-semibold text-black dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                    ) : user?.displayName ? (
                      user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase()
                    ) : (
                      user?.email?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {user?.displayName || "User"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate("/profil"); }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" />
                        <path d="M4 20c2-3.5 5-5 8-5s6 1.5 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Profile</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); navigate("/filer"); }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path d="M4 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Files</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Dark mode</span>
                  </div>
                  <button
                    onClick={() => setDarkMode((v) => !v)}
                    className={`relative h-6 w-10 rounded-full transition ${darkMode ? "bg-slate-200/30" : "bg-slate-200"}`}
                    aria-label="Toggle dark mode"
                    type="button"
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${darkMode ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
                <button
                  onClick={async () => { setMenuOpen(false); await signOut(auth); }}
                  className="w-full border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium">Sign out</span>
                    </div>
                    <span className="text-slate-400">›</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="h-[calc(100dvh-4rem)] bg-[#F6F8FF] dark:bg-slate-950">
        <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr]">

          {/* Sidebar */}
          <aside className="order-2 overflow-y-auto border-t border-slate-200 bg-[#F6F8FF] p-4 lg:order-1 lg:border-r lg:border-t-0 dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-5">

              {/* Project name */}
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Project name
                </label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                  aria-label="Project name"
                />
              </section>

              {/* Property lookup */}
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Property ID
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={municipalityNumber}
                    onChange={(e) => setMunicipalityNumber(e.target.value)}
                    placeholder="Knr"
                    maxLength={4}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                  />
                  <input
                    value={cadastralNumber}
                    onChange={(e) => setCadastralNumber(e.target.value)}
                    placeholder="Gnr"
                    type="number"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                  />
                  <input
                    value={propertyNumber}
                    onChange={(e) => setPropertyNumber(e.target.value)}
                    placeholder="Bnr"
                    type="number"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleMatrikkelLookup}
                  disabled={matrikkelLoading || !municipalityNumber || !cadastralNumber || !propertyNumber}
                  className="mt-2 h-9 w-full rounded-xl bg-[#213F53] text-sm font-medium text-white transition hover:bg-[#1a3244] disabled:opacity-50"
                >
                  {matrikkelLoading ? "Looking up..." : "Look up property"}
                </button>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Or click the map to auto-fill
                </p>
                {(propertyAddress || propertyMatrikkel) && !propertyLoading && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">Nearest address</div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {propertyAddress ?? "No address found"}
                    </div>
                    {propertyMatrikkel && (
                      <div className="mt-2 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>Knr: <span className="font-semibold text-slate-700 dark:text-slate-200">{propertyMatrikkel.kommunenummer}</span></span>
                        <span>Gnr: <span className="font-semibold text-slate-700 dark:text-slate-200">{propertyMatrikkel.gnr}</span></span>
                        <span>Bnr: <span className="font-semibold text-slate-700 dark:text-slate-200">{propertyMatrikkel.bnr}</span></span>
                      </div>
                    )}
                  </div>
                )}
                {propertyLoading && <p className="mt-2 text-xs text-slate-400">Fetching property data...</p>}
                {propertyError && !propertyLoading && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{propertyError}</p>
                )}
              </section>

              {/* Weather station */}
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Weather station
                </label>
                <div className="relative" ref={stationBoxRef}>
                  <input
                    type="text"
                    value={stationSearch}
                    onChange={(e) => { setStationSearch(e.target.value); setStationDropdownOpen(true); }}
                    onFocus={() => setStationDropdownOpen(true)}
                    placeholder={
                      selectedStation
                        ? `${selectedStation.name}${selectedStation.municipality ? ` (${selectedStation.municipality})` : ""}`
                        : "Search for weather station..."
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setStationDropdownOpen((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label="Open weather stations"
                  >
                    ▾
                  </button>
                  {stationDropdownOpen && (
                    <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {filteredStations.length > 0 ? (
                        filteredStations.map((station) => (
                          <button
                            key={station.id}
                            type="button"
                            onClick={() => {
                              setSelectedStationId(station.id);
                              setStationSearch("");
                              setStationDropdownOpen(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800 ${
                              selectedStationId === station.id ? "bg-slate-100 dark:bg-slate-800" : ""
                            }`}
                          >
                            {station.name}{station.municipality ? ` (${station.municipality})` : ""}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                          No weather stations found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Terrain */}
              <section>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Elevation</label>
                    <input
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      value={terrainLoading ? "Fetching..." : elevation !== null ? `${elevation.toFixed(1)} m` : ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Length</label>
                    <input
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      value={terrainLoading ? "Fetching..." : length !== null ? `${length.toFixed(1)} m` : ""}
                      readOnly
                    />
                  </div>
                </div>
                {terrainError && (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400">{terrainError}</div>
                )}
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Double-click two points on the map to calculate length and elevation difference.
                </div>
                {concentrationTime !== null && !terrainLoading && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                    Concentration time:{" "}
                    <span className="font-semibold">{concentrationTime.toFixed(2)} min</span>
                  </div>
                )}
                {propertyLoading && (
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">Fetching property data...</div>
                )}
              </section>

              {/* Infiltration */}
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Infiltration capacity
                </label>
                <div className="mb-3 flex overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setInfiltrationMethod("direct")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      infiltrationMethod === "direct"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    Direct Q_inf
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfiltrationMethod("soiltype")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      infiltrationMethod === "soiltype"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    Soil type
                  </button>
                </div>
                {infiltrationMethod === "direct" && (
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Q_inf [l/s]</label>
                    <input
                      type="number"
                      min="0"
                      value={manualQInf}
                      onChange={(e) => setManualQInf(e.target.value)}
                      placeholder="0.0"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                )}
                {infiltrationMethod === "soiltype" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Soil type</label>
                      <select
                        value={selectedSoilType}
                        onChange={(e) => setSelectedSoilType(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                      >
                        <option value="">Select soil type...</option>
                        {soilTypes.map((jt) => (
                          <option key={jt.id} value={jt.id}>
                            {jt.navn} — {jt.beskrivelse} (k = {jt.k_m_s} m/s)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">A_bottom [m²]</label>
                        <input
                          type="number"
                          min="0"
                          value={bottomArea}
                          onChange={(e) => setBottomArea(e.target.value)}
                          placeholder="0.0"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">A_side [m²]</label>
                        <input
                          type="number"
                          min="0"
                          value={sideArea}
                          onChange={(e) => setSideArea(e.target.value)}
                          placeholder="0.0"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                        />
                      </div>
                    </div>
                    {selectedSoilType && bottomArea && sideArea && (() => {
                      const jt = soilTypes.find((j) => j.id === selectedSoilType);
                      if (!jt) return null;
                      const qInf = jt.k_m_s * (parseFloat(bottomArea) * 0.5 + parseFloat(sideArea) * 1.0) * 1000;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                          Q_inf: <span className="font-semibold">{qInf.toFixed(4)} l/s</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </section>

              {/* Calculation inputs */}
              <section>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Area</label>
                    <input
                      type="number"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="200"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Return period</label>
                    <select
                      value={returnPeriod}
                      onChange={(e) => setReturnPeriod(e.target.value)}
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    >
                      <option value="2">2 yr</option>
                      <option value="5">5 yr</option>
                      <option value="10">10 yr</option>
                      <option value="20">20 yr</option>
                      <option value="25">25 yr</option>
                      <option value="50">50 yr</option>
                      <option value="100">100 yr</option>
                      <option value="200">200 yr</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Climate factor</label>
                    <input
                      type="number"
                      step="0.1"
                      value={climateFactor}
                      onChange={(e) => setClimateFactor(e.target.value)}
                      placeholder="1.0"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Max discharge</label>
                    <input
                      type="number"
                      step="0.1"
                      value={maxDischarge}
                      onChange={(e) => setMaxDischarge(e.target.value)}
                      placeholder="0.0"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                </div>
                {pdfError && (
                  <div className="mt-3 text-xs text-red-600 dark:text-red-400">{pdfError}</div>
                )}
                <div className="space-y-3 pt-4">
                  <button
                    type="button"
                    onClick={handleGeneratePdf}
                    disabled={pdfSaving}
                    className="h-14 w-full rounded-[16px] bg-slate-300 text-base font-semibold text-black transition hover:bg-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                  >
                    {pdfSaving ? "Generating PDF..." : "Generate PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="h-12 w-full rounded-[16px] border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Reset
                  </button>
                </div>
              </section>

            </div>
          </aside>

          {/* Map / IVF panel */}
          <section className="order-1 flex h-full flex-col lg:order-2">
            <div className="relative flex-1">
              <div className="absolute left-16 top-3 z-[1000]">
                <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                  <button
                    type="button"
                    onClick={() => setRightPanelView("map")}
                    className={`flex items-center justify-center px-4 py-2 transition ${
                      rightPanelView === "map"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                    aria-label="Map view"
                    title="Map"
                  >
                    <Map size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelView("ivf")}
                    className={`flex items-center justify-center px-4 py-2 transition ${
                      rightPanelView === "ivf"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                    aria-label="IVF table"
                    title="IVF table"
                  >
                    <Table2 size={18} />
                  </button>
                </div>
              </div>

              {rightPanelView === "map" && (
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
                      onPick={handleMapPick}
                      onSingleClick={handleMapSingleClick}
                      onCancelSingleClick={cancelSingleClick}
                      onMouseMove={(lat, lng) => setMouseCoord({ lat, lng })}
                    />
                    <MapLayerToggle layer={mapLayer} onChange={setMapLayer} />
                    <MapScale />
                    <TileLayer
                      attribution={
                        mapLayer === "kart"
                          ? "Kartverket (CC BY 4.0)"
                          : mapLayer === "terreng"
                          ? "OpenTopoMap (CC-BY-SA)"
                          : "Esri, Maxar, Earthstar Geographics"
                      }
                      url={
                        mapLayer === "kart"
                          ? "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
                          : mapLayer === "terreng"
                          ? "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                          : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      }
                      maxZoom={20}
                      maxNativeZoom={mapLayer === "terreng" ? 17 : mapLayer === "kart" ? 18 : 19}
                    />
                    {propertyBoundary && console.log("GeoJSON data:", JSON.stringify(propertyBoundary).slice(0, 300))}
                      {propertyBoundary?.features?.length > 0 && (
                        <GeoJSON
                          key={JSON.stringify(propertyBoundary)}
                          data={propertyBoundary}
                          style={{ color: "#f59e0b", weight: 2, fillOpacity: 0.1, fillColor: "#f59e0b" }}
                        />
                      )}
                      {pointA?.lat != null && pointA?.lng != null && (
                        <CircleMarker center={[pointA.lat, pointA.lng]} radius={7} />
                      )}
                      {pointB?.lat != null && pointB?.lng != null && (
                        <CircleMarker center={[pointB.lat, pointB.lng]} radius={7} />
                      )}
                    <div className="pointer-events-none absolute bottom-3 left-3 z-[1001] rounded-md border border-[#d8c4b0] bg-white/95 px-3 py-1 text-[16px] font-medium leading-none tracking-wide text-black shadow">
                      {(() => {
                        const source = mouseCoord ?? clickedCoord;
                        if (!source) return "EU89 UTM33 -";
                        const utm = latLngToUtm33(source.lat, source.lng);
                        return `EU89 UTM33 ${utm.northing}N ${utm.easting}Ø`;
                      })()}
                    </div>
                  </MapContainer>
                </div>
              )}

              {rightPanelView === "ivf" && (
                <div className="h-full overflow-auto bg-white p-4 pt-20 dark:bg-slate-950">
                  <div className="mb-4">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">IVF table</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {ivfData?.station_name || selectedStation?.name || "No weather station selected"}
                    </div>
                    {ivfData?.first_year && ivfData?.last_year && (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Data from {ivfData.first_year} to {ivfData.last_year}
                      </div>
                    )}
                  </div>
                  {ivfLoading && <div className="text-sm text-slate-500 dark:text-slate-400">Loading IVF data...</div>}
                  {ivfError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      {ivfError}
                    </div>
                  )}
                  {!ivfLoading && !ivfError && ivfData && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-blue-100 dark:bg-slate-800">
                            <th className="border-r border-b border-slate-400 px-3 py-2"></th>
                            <th
                              colSpan={ivfData.durations.length}
                              className="border-b border-slate-400 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200"
                            >
                              Durations (minutes)
                            </th>
                          </tr>
                          <tr className="bg-blue-100 dark:bg-slate-800">
                            <th className="border-r border-b border-slate-400 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                              Return period (yr)
                            </th>
                            {ivfData.durations.map((d) => (
                              <th key={d} className="border-r border-b border-slate-400 px-2 py-2 text-center font-semibold text-slate-700 last:border-r-0 dark:text-slate-200">
                                {d}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ivfData.return_periods.map((period, i) => (
                            <tr key={period} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                              <td className="border-r border-b border-slate-300 px-3 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                {period}
                              </td>
                              {ivfData.durations.map((d) => (
                                <td key={`${period}-${d}`} className="border-r border-b border-slate-300 px-2 py-2 text-center text-slate-700 last:border-r-0 dark:border-slate-700 dark:text-slate-200">
                                  {ivfData.ls_ha[String(d)]?.[String(period)] ?? "-"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!ivfLoading && !ivfError && !ivfData && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No IVF data available.</div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}