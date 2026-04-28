// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Map, Table2, SlidersHorizontal } from "lucide-react";

// --- API --- //
import { fetchPropertyByMatrikkel } from "../api/property";
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

type MobileTab = "map" | "ivf" | "sidebar";

export default function HomePage({
  darkMode,
  setDarkMode,
}: {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}) {
  const { user } = useAuth();

  // --- Hooks --- //
  const { form, setField, resetForm } = useFormState();
  const { pdfSaving, pdfError, handleGeneratePdf } = useGeneratePdf();

  const {
    propertyBoundary,
    setPropertyBoundary,
    propertyAddress,
    setPropertyAddress,
    propertyMatrikkel,
    setPropertyMatrikkel,
    clickedCoord,
    setClickedCoord,
    mouseCoord,
    setMouseCoord,
    propertyLoading,
    setPropertyLoading,
    propertyError,
    setPropertyError,
    municipalityNumber,
    setMunicipalityNumber,
    cadastralNumber,
    setCadastralNumber,
    propertyNumber,
    setPropertyNumber,
    matrikkelLoading,
    setMatrikkelLoading,
    resetProperty,
  } = usePropertyState();

  const {
    pointA,
    setPointA,
    pointB,
    setPointB,
    elevation,
    setElevation,
    length,
    setLength,
    concentrationTime,
    setConcentrationTime,
    terrainLoading,
    setTerrainLoading,
    terrainError,
    setTerrainError,
    resetTerrain,
  } = useTerrainState();

  // --- UI state --- //
  const [rightPanelView, setRightPanelView] = useState<"map" | "ivf">("map");
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");
  const [mapLayer, setMapLayer] = useState<"kart" | "terreng" | "satellitt">(
    "kart"
  );

  // --- Weather / IVF --- //
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [ivfData, setIvfData] = useState<IvfResponse | null>(null);
  const [ivfLoading, setIvfLoading] = useState(false);
  const [ivfError, setIvfError] = useState("");

  const [soilTypes, setSoilTypes] = useState([]);
  const mapRef = useRef(null);

  const selectedStation = weatherStations.find(
    (s) => s.id === selectedStationId
  );

  // --- Effects --- //
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
    if (!mapRef.current) return;

    setTimeout(() => {
      mapRef.current?.invalidateSize?.({ pan: false });
    }, 100);
  }, [mobileTab, rightPanelView]);

  // --- Handlers --- //
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

      setRightPanelView("map");
      setMobileTab("map");

      if (data.warnings?.length > 0) {
        setPropertyError(data.warnings.join(" "));
      }
    } catch (e) {
      setPropertyError(
        e instanceof Error ? e.message : "Could not look up property."
      );
    } finally {
      setMatrikkelLoading(false);
    }
  }

  function handleReset() {
    resetForm();
    resetProperty();
    resetTerrain();
  }

  const pdfOptions = {
    userId: user?.uid,
    mapRef,
    setMapLayer,
    projectName: form.projectName,
    elevation,
    length,
    concentrationTime,
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

  function PanelToggle({ className = "" }: { className?: string }) {
    return (
      <div
        className={`flex overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 ${className}`}
      >
        <button
          type="button"
          onClick={() => {
            setRightPanelView("map");
            setMobileTab("map");
          }}
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
          onClick={() => {
            setRightPanelView("ivf");
            setMobileTab("ivf");
          }}
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
    );
  }

  return (
    <div className="h-dvh w-full overflow-hidden bg-[#F6F8FF] dark:bg-slate-950">
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
      />

      <main className="h-[calc(100dvh-4rem)] min-h-0 overflow-hidden">
        {/* Desktop layout */}
        <div className="hidden h-full min-h-0 min-w-0 xl:grid xl:grid-cols-[320px_minmax(0,1fr)] xl:overflow-hidden">
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
            propertyLoading={propertyLoading}
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

          <section className="relative h-full min-h-0 min-w-0 overflow-hidden">
            <div className="absolute left-4 top-3 z-[1000]">
              <PanelToggle />
            </div>

            <div
              className={
                rightPanelView === "map"
                  ? "h-full min-h-0 w-full min-w-0"
                  : "hidden"
              }
            >
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
                onSingleClick={(lat, lng) => setClickedCoord({ lat, lng })}
                onCancelSingleClick={() => setClickedCoord(null)}
                onMouseMove={(lat, lng) => setMouseCoord({ lat, lng })}
              />
            </div>

            <div
              className={
                rightPanelView === "ivf"
                  ? "h-full min-h-0 w-full overflow-auto"
                  : "hidden"
              }
            >
              <IvfPanel
                ivfData={ivfData}
                ivfLoading={ivfLoading}
                ivfError={ivfError}
                selectedStation={selectedStation}
              />
            </div>
          </section>
        </div>

        {/* Mobile layout */}
        <div className="flex h-full min-h-0 flex-col xl:hidden">
          <div className="flex shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMobileTab("map")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
                mobileTab === "map"
                  ? "border-b-2 border-[#213F53] text-[#213F53] dark:border-sky-400 dark:text-sky-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Map size={15} /> Kart
            </button>

            <button
              type="button"
              onClick={() => setMobileTab("ivf")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
                mobileTab === "ivf"
                  ? "border-b-2 border-[#213F53] text-[#213F53] dark:border-sky-400 dark:text-sky-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Table2 size={15} /> IVF
            </button>

            <button
              type="button"
              onClick={() => setMobileTab("sidebar")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
                mobileTab === "sidebar"
                  ? "border-b-2 border-[#213F53] text-[#213F53] dark:border-sky-400 dark:text-sky-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <SlidersHorizontal size={15} /> Innstillinger
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className={`absolute inset-0 ${
                mobileTab === "map"
                  ? "z-10"
                  : "pointer-events-none z-0 opacity-0"
              }`}
            >
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
                onSingleClick={(lat, lng) => setClickedCoord({ lat, lng })}
                onCancelSingleClick={() => setClickedCoord(null)}
                onMouseMove={(lat, lng) => setMouseCoord({ lat, lng })}
              />
            </div>

            {mobileTab === "ivf" && (
              <div className="absolute inset-0 z-10 overflow-auto">
                <IvfPanel
                  ivfData={ivfData}
                  ivfLoading={ivfLoading}
                  ivfError={ivfError}
                  selectedStation={selectedStation}
                />
              </div>
            )}

            {mobileTab === "sidebar" && (
              <div className="absolute inset-0 z-10 overflow-auto">
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
                  propertyLoading={propertyLoading}
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
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}