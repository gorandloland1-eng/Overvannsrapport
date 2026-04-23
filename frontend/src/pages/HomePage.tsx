// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Map, Table2 } from "lucide-react";

// --- API --- //
import { fetchPropertyByPoint, fetchPropertyByMatrikkel } from "../api/property";
import { fetchTerrain } from "../api/terrain";
import { fetchWeatherStations, fetchIvfData } from "../api/ivf";
import type { IvfResponse, WeatherStation } from "../api/ivf";

// --- Components --- //
import Header from "../components/layout/Header";
import PropertyMap from "../components/map/PropertyMap";
import IvfPanel from "../components/map/IvfPanel";
import Sidebar from "../components/sidebar/Sidebar";

// --- Custom hooks --- //
import { useFormState } from "../hooks/useFormState";
import { usePropertyState } from "../hooks/usePropertyState";
import { useTerrainState } from "../hooks/useTerrainState";
import { useGeneratePdf } from "../hooks/useGeneratePdf";

export default function HomePage() {
  const { user } = useAuth();

  // --- Hooks ---
  const { form, setField, resetForm } = useFormState();
  const { pdfSaving, pdfError, handleGeneratePdf } = useGeneratePdf();

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

  // --- Refs ---
  const mapRef = useRef(null);
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

  // --- Derived ---
  const selectedStation = weatherStations.find((s) => s.id === selectedStationId);

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

  const pdfOptions = {
    userId: user.uid,
    mapRef,
    setMapLayer,
    projectName: form.projectName,
    elevation, length, concentrationTime,
    area: form.area,
    returnPeriod: form.returnPeriod,
    climateFactor: form.climateFactor,
    maxDischarge: form.maxDischarge,
    infiltrationMethod: form.infiltrationMethod,
    manualQInf: form.manualQInf,
    selectedSoilType: form.selectedSoilType,
    bottomArea: form.bottomArea,
    sideArea: form.sideArea,
    soilTypes,
    propertyAddress,
    propertyMatrikkel,
    selectedStationId,
    selectedStation,
  };

  // --- Render ---
  return (
    <div className="min-h-dvh w-full bg-[#F6F8FF] dark:bg-slate-950">
      <Header darkMode={darkMode} onToggleDarkMode={() => setDarkMode((v) => !v)} />

      <main className="h-[calc(100dvh-4rem)]">
        <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr]">

          <Sidebar
            form={form}
            setField={setField}
            municipalityNumber={municipalityNumber}
            cadastralNumber={cadastralNumber}
            propertyNumber={propertyNumber}
            setMunicipalityNumber={setMunicipalityNumber}
            setCadastralNumber={setCadastralNumber}
            setPropertyNumber={setPropertyNumber}
            handleMatrikkelLookup={handleMatrikkelLookup}
            matrikkelLoading={matrikkelLoading}
            propertyAddress={propertyAddress}
            propertyMatrikkel={propertyMatrikkel}
            propertyError={propertyError}
            weatherStations={weatherStations}
            selectedStationId={selectedStationId}
            setSelectedStationId={setSelectedStationId}
            stationSearch={stationSearch}
            setStationSearch={setStationSearch}
            stationDropdownOpen={stationDropdownOpen}
            setStationDropdownOpen={setStationDropdownOpen}
            elevation={elevation}
            length={length}
            concentrationTime={concentrationTime}
            terrainLoading={terrainLoading}
            terrainError={terrainError}
            soilTypes={soilTypes}
            handleGeneratePdf={() => handleGeneratePdf(pdfOptions)}
            pdfSaving={pdfSaving}
            pdfError={pdfError}
            handleReset={handleReset}
          />

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