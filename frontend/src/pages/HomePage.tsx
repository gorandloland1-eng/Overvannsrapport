// @ts-nocheck
import {
  MapContainer, TileLayer, useMapEvents,
  CircleMarker, GeoJSON, useMap,
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

// --- Map subcomponents unchanged ---
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
  // ... unchanged
}

function MapScale() {
  // ... unchanged
}

function latLngToUtm33(lat, lng) {
  // ... unchanged
}

// ---------------------------------------------------------------------------

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

  // Project
  const [projectName, setProjectName] = useState("");

  // Property / map click
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

  // --- Handlers ---
  const selectedStation = weatherStations.find((s) => s.id === selectedStationId);
  const filteredStations = weatherStations.filter((s) =>
    `${s.name} ${s.municipality ?? ""} ${s.county ?? ""}`
      .toLowerCase()
      .includes(stationSearch.toLowerCase())
  );

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
          // Sync manual input fields
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
    try {
      const data = await fetchPropertyByMatrikkel(
        municipalityNumber,
        Number(cadastralNumber),
        Number(propertyNumber)
      );
      setPropertyAddress(data.adresse ?? null);
      setPropertyBoundary(data.grense ?? null);
      setPropertyMatrikkel({
        gnr: data.gardsnummer,
        bnr: data.bruksnummer,
        kommunenummer: data.kommunenummer,
      });
      if (data.warnings?.length > 0) setPropertyError(data.warnings.join(" "));
    } catch (e) {
      setPropertyError(e.message);
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
      {/* Header — unchanged */}
      <header>...</header>

      <main className="h-[calc(100dvh-4rem)] bg-[#F6F8FF] dark:bg-slate-950">
        <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr]">
          <aside className="order-2 overflow-y-auto border-t border-slate-200 bg-[#F6F8FF] p-4 lg:order-1 lg:border-r lg:border-t-0 dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-5">

              {/* Project name — unchanged */}
              <section>...</section>

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

                {/* Property result */}
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

              {/* Weather station, terrain, infiltration, calculation inputs, PDF button — all unchanged in structure, just variable names updated */}
              ...

            </div>
          </aside>

          {/* Map section — GeoJSON key and variable names updated */}
          <section className="order-1 flex h-full flex-col lg:order-2">
            <div className="relative flex-1">
              {rightPanelView === "map" && (
                <MapContainer center={[60.3913, 5.3221]} zoom={13} maxZoom={20} className="h-full w-full" doubleClickZoom={false}>
                  <MapClickHandler
                    onPick={handleMapPick}
                    onSingleClick={handleMapSingleClick}
                    onCancelSingleClick={cancelSingleClick}
                    onMouseMove={(lat, lng) => setMouseCoord({ lat, lng })}
                  />
                  <MapLayerToggle layer={mapLayer} onChange={setMapLayer} />
                  <MapScale />
                  <TileLayer />
                  {propertyBoundary && (
                    <GeoJSON
                      key={JSON.stringify(propertyBoundary)}
                      data={propertyBoundary}
                      style={{ color: "#f59e0b", weight: 2, fillOpacity: 0.1, fillColor: "#f59e0b" }}
                    />
                  )}
                  {pointA && <CircleMarker center={[pointA.lat, pointA.lng]} radius={7} />}
                  {pointB && <CircleMarker center={[pointB.lat, pointB.lng]} radius={7} />}
                  {/* UTM coordinate display */}
                  <div className="pointer-events-none absolute bottom-3 left-3 z-[1001] ...">
                    {(() => {
                      const source = mouseCoord ?? clickedCoord;
                      if (!source) return "EU89 UTM33 -";
                      const utm = latLngToUtm33(source.lat, source.lng);
                      return `EU89 UTM33 ${utm.northing}N ${utm.easting}Ø`;
                    })()}
                  </div>
                </MapContainer>
              )}
              {/* IVF table — unchanged */}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}