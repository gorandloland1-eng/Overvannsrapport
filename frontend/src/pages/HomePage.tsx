// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Map, Table2 } from "lucide-react";
import { fetchPropertyByPoint, fetchPropertyByMatrikkel } from "../api/property";
import { fetchTerrain } from "../api/terrain";
import { fetchWeatherStations, fetchIvfData } from "../api/ivf";
import type { IvfResponse, WeatherStation } from "../api/ivf";
import { uploadMapScreenshot, savePdfReport } from "../api/firebase";
import { generatePdf } from "../api/pdf";
import Header from "../components/layout/Header";
import PropertyMap from "../components/map/PropertyMap";
import IvfPanel from "../components/map/IvfPanel";
import { useFormState } from "../hooks/useFormState";
import { usePropertyState } from "../hooks/usePropertyState";
import { useTerrainState } from "../hooks/useTerrainState";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- Hooks ---
  const { form, setField, resetForm } = useFormState();
  const {
    propertyBoundary, setPropertyBoundary,
    propertyAddress, setPropertyAddress,
    propertyMatrikkel, setPropertyMatrikkel,
    clickedCoord, setClickedCoord,
    mouseCoord, setMouseCoord,
    propertyLoading, setPropertyLoading,
    propertyError, setPropertyError,
    municipalityNumber, setMunicipalityNumber,
    cadastralNumber, setCadastralNumber,
    propertyNumber, setPropertyNumber,
    matrikkelLoading, setMatrikkelLoading,
    resetProperty,
  } = usePropertyState();
  const {
    pointA, setPointA,
    pointB, setPointB,
    elevation, setElevation,
    length, setLength,
    concentrationTime, setConcentrationTime,
    terrainLoading, setTerrainLoading,
    terrainError, setTerrainError,
    resetTerrain,
  } = useTerrainState();

  // --- UI state ---
  const [darkMode, setDarkMode] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<"map" | "ivf">("map");
  const [mapLayer, setMapLayer] = useState<"kart" | "terreng" | "satellitt">("kart");

  // --- Weather / IVF ---
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [ivfData, setIvfData] = useState<IvfResponse | null>(null);
  const [ivfLoading, setIvfLoading] = useState(false);
  const [ivfError, setIvfError] = useState("");

  // --- Other ---
  const [soilTypes, setSoilTypes] = useState([]);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");

  // --- Refs ---
  const mapRef = useRef(null);
  const singleClickTimer = useRef(null);
  const stationBoxRef = useRef(null);

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
      if (stationDropdownOpen && !stationBoxRef.current?.contains(e.target))
        setStationDropdownOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [stationDropdownOpen]);

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
    setPointB({ lat, lng });
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
      setPropertyAddress(data.adresse ?? null);
      setPropertyBoundary(data.polygon ?? null);
      setPropertyMatrikkel({
        gnr: data.gardsnummer,
        bnr: data.bruksnummer,
        kommunenummer: data.kommunenummer,
      });
      if (data.bounds && mapRef.current) {
        mapRef.current.fitBounds(
          [[data.bounds.south, data.bounds.west], [data.bounds.north, data.bounds.east]],
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
    resetForm();
    resetProperty();
    resetTerrain();
  }

  async function handleGeneratePdf() {
    setPdfSaving(true);
    setPdfError("");
    try {
      const qInf = form.infiltrationMethod === "direct"
        ? Number(form.manualQInf || 0)
        : (() => {
            const st = soilTypes.find((j) => j.id === form.selectedSoilType);
            if (!st) return 0;
            return st.k_m_s * (Number(form.bottomArea || 0) * 0.5 + Number(form.sideArea || 0) * 1.0) * 1000;
          })();

      let screenshotUrl: string | null = null;
      if (mapRef.current) {
        try {
          screenshotUrl = await uploadMapScreenshot(mapRef.current.getContainer(), user.uid);
        } catch (e) {
          console.warn("Screenshot feilet, fortsetter uten:", e);
        }
      }

      const response = await generatePdf({
        project_name: form.projectName,
        height: elevation ?? 0,
        length: length ?? 0,
        time_of_concentration: concentrationTime ?? 0,
        areal: Number(form.area),
        returperiode: Number(form.returnPeriod),
        klimafaktor: Number(form.climateFactor),
        maks_paslipp: Number(form.maxDischarge),
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
        projectName: form.projectName,
        pdfUrl: response.firebase_url,
        screenshotUrl,
        data: {
          area: form.area,
          returnPeriod: form.returnPeriod,
          climateFactor: form.climateFactor,
          maxDischarge: form.maxDischarge,
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
      <Header darkMode={darkMode} onToggleDarkMode={() => setDarkMode((v) => !v)} />
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
                  value={form.projectName}
                  onChange={(e) => setField("projectName", e.target.value)}
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
                {terrainError && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{terrainError}</div>}
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Double-click two points on the map to calculate length and elevation difference.
                </div>
                {concentrationTime !== null && !terrainLoading && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                    Concentration time: <span className="font-semibold">{concentrationTime.toFixed(2)} min</span>
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
                    onClick={() => setField("infiltrationMethod", "direct")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      form.infiltrationMethod === "direct"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    Direct Q_inf
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("infiltrationMethod", "soiltype")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      form.infiltrationMethod === "soiltype"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    Soil type
                  </button>
                </div>
                {form.infiltrationMethod === "direct" && (
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Q_inf [l/s]</label>
                    <input
                      type="number"
                      min="0"
                      value={form.manualQInf}
                      onChange={(e) => setField("manualQInf", e.target.value)}
                      placeholder="0.0"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                )}
                {form.infiltrationMethod === "soiltype" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Soil type</label>
                      <select
                        value={form.selectedSoilType}
                        onChange={(e) => setField("selectedSoilType", e.target.value)}
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
                          value={form.bottomArea}
                          onChange={(e) => setField("bottomArea", e.target.value)}
                          placeholder="0.0"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">A_side [m²]</label>
                        <input
                          type="number"
                          min="0"
                          value={form.sideArea}
                          onChange={(e) => setField("sideArea", e.target.value)}
                          placeholder="0.0"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                        />
                      </div>
                    </div>
                    {form.selectedSoilType && form.bottomArea && form.sideArea && (() => {
                      const jt = soilTypes.find((j) => j.id === form.selectedSoilType);
                      if (!jt) return null;
                      const qInf = jt.k_m_s * (parseFloat(form.bottomArea) * 0.5 + parseFloat(form.sideArea) * 1.0) * 1000;
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
                      value={form.area}
                      onChange={(e) => setField("area", e.target.value)}
                      placeholder="200"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Return period</label>
                    <select
                      value={form.returnPeriod}
                      onChange={(e) => setField("returnPeriod", e.target.value)}
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
                      value={form.climateFactor}
                      onChange={(e) => setField("climateFactor", e.target.value)}
                      placeholder="1.0"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Max discharge</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.maxDischarge}
                      onChange={(e) => setField("maxDischarge", e.target.value)}
                      placeholder="0.0"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                </div>
                {pdfError && <div className="mt-3 text-xs text-red-600 dark:text-red-400">{pdfError}</div>}
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
                    className={`flex items-center justify-center px-4 py-2 transition ${rightPanelView === "map" ? "bg-[#213F53] text-white" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                    aria-label="Map view"
                    title="Map"
                  >
                    <Map size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelView("ivf")}
                    className={`flex items-center justify-center px-4 py-2 transition ${rightPanelView === "ivf" ? "bg-[#213F53] text-white" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                    aria-label="IVF table"
                    title="IVF table"
                  >
                    <Table2 size={18} />
                  </button>
                </div>
              </div>

              {rightPanelView === "map" && (
                <PropertyMap
                  mapRef={mapRef}
                  mapLayer={mapLayer}
                  setMapLayer={setMapLayer}
                  propertyBoundary={propertyBoundary}
                  pointA={pointA}
                  pointB={pointB}
                  mouseCoord={mouseCoord}
                  clickedCoord={clickedCoord}
                  onPick={handleMapPick}
                  onSingleClick={handleMapSingleClick}
                  onCancelSingleClick={cancelSingleClick}
                  onMouseMove={(lat, lng) => setMouseCoord({ lat, lng })}
                />
              )}
              {rightPanelView === "ivf" && (
                <IvfPanel
                  ivfData={ivfData}
                  ivfLoading={ivfLoading}
                  ivfError={ivfError}
                  selectedStation={selectedStation}
                />
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}