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
type RightPanelView = "map" | "ivf";
type MapLayer = "kart" | "terreng" | "satellitt";

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStation(
  centroid: { lat: number; lng: number } | null,
  stations: WeatherStation[]
) {
  if (!centroid || !stations.length) return null;

  return (
    stations
      .filter((station) => station.lat != null && station.lon != null)
      .map((station) => ({
        station,
        distance: distanceKm(
          centroid.lat,
          centroid.lng,
          Number(station.lat),
          Number(station.lon)
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.station ?? null
  );
}

export default function HomePage({
  darkMode,
  setDarkMode,
}: {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}) {
  const { user } = useAuth();

  // --- Refs --- //
  const mapRef = useRef(null);

  // --- Form / PDF --- //
  const { form, setField, resetForm } = useFormState();
  const { pdfSaving, pdfError, handleGeneratePdf } = useGeneratePdf();

  // --- Property state --- //
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

  // --- Terrain state --- //
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
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>("map");
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");
  const [mapLayer, setMapLayer] = useState<MapLayer>("kart");

  // --- Weather / IVF state --- //
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [ivfData, setIvfData] = useState<IvfResponse | null>(null);
  const [ivfLoading, setIvfLoading] = useState(false);
  const [ivfError, setIvfError] = useState("");

  // --- Calculation data --- //
  const [soilTypes, setSoilTypes] = useState([]);

  const selectedStation = weatherStations.find(
    (station) => station.id === selectedStationId
  );

  useEffect(() => {
    fetchWeatherStations()
      .then((data) => {
        if (!data.length) return;

        setWeatherStations(data);
        setSelectedStationId(data[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedStationId) return;

    setIvfLoading(true);
    setIvfError("");

    fetchIvfData(selectedStationId)
      .then(setIvfData)
      .catch((error) => setIvfError(error.message))
      .finally(() => setIvfLoading(false));
  }, [selectedStationId]);

  useEffect(() => {
    fetch("http://localhost:8000/calculation/jordtyper")
      .then((response) => response.json())
      .then(setSoilTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const timeout = setTimeout(() => {
      mapRef.current?.invalidateSize?.({ pan: false });
    }, 100);

    return () => clearTimeout(timeout);
  }, [mobileTab, rightPanelView]);

  function resetTerrainResult() {
    setElevation(null);
    setLength(null);
    setConcentrationTime(null);
    setTerrainError("");
  }

  function handleMapPick(lat: number, lng: number) {
    if (!pointA || pointB) {
      setPointA({ lat, lng });
      setPointB(null);
      resetTerrainResult();
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
      .catch((error) => {
        setTerrainError(error.message);
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

      const nearestStation = findNearestStation(data.centroid, weatherStations);

      if (nearestStation) {
        setSelectedStationId(nearestStation.id);
        setStationSearch("");
        setStationDropdownOpen(false);
      }

      setRightPanelView("map");
      setMobileTab("map");

      if (data.warnings?.length > 0) {
        setPropertyError(data.warnings.join(" "));
      }
    } catch (error) {
      setPropertyError(
        error instanceof Error ? error.message : "Could not look up property."
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

  function handleShowMap() {
    setRightPanelView("map");
    setMobileTab("map");
  }

  function handleShowIvf() {
    setRightPanelView("ivf");
    setMobileTab("ivf");
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

  const sidebarProps = {
    form,
    setField,
    municipalityNumber,
    cadastralNumber,
    propertyNumber,
    setMunicipalityNumber,
    setCadastralNumber,
    setPropertyNumber,
    handleMatrikkelLookup,
    matrikkelLoading,
    propertyAddress,
    propertyMatrikkel,
    propertyError,
    propertyLoading,
    weatherStations,
    selectedStationId,
    setSelectedStationId,
    stationSearch,
    setStationSearch,
    stationDropdownOpen,
    setStationDropdownOpen,
    elevation,
    length,
    concentrationTime,
    terrainLoading,
    terrainError,
    soilTypes,
    handleGeneratePdf: () => handleGeneratePdf(pdfOptions),
    pdfSaving,
    pdfError,
    handleReset,
  };

  const mapProps = {
    mapRef,
    mapLayer,
    setMapLayer,
    propertyBoundary,
    pointA,
    pointB,
    mouseCoord,
    clickedCoord,
    onPick: handleMapPick,
    onSingleClick: (lat: number, lng: number) => setClickedCoord({ lat, lng }),
    onCancelSingleClick: () => setClickedCoord(null),
    onMouseMove: (lat: number, lng: number) => setMouseCoord({ lat, lng }),
  };

  const ivfPanelProps = {
    ivfData,
    ivfLoading,
    ivfError,
    selectedStation,
  };

  function PanelToggle({ className = "" }: { className?: string }) {
    return (
      <div
        className={`flex overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 ${className}`}
      >
        <button
          type="button"
          onClick={handleShowMap}
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
          onClick={handleShowIvf}
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

  function MobileTabButton({
    tab,
    icon,
    label,
  }: {
    tab: MobileTab;
    icon: React.ReactNode;
    label: string;
  }) {
    const active = mobileTab === tab;

    return (
      <button
        type="button"
        onClick={() => setMobileTab(tab)}
        className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
          active
            ? "border-b-2 border-[#213F53] text-[#213F53] dark:border-sky-400 dark:text-sky-400"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <div className="h-dvh w-full overflow-hidden bg-[#F6F8FF] dark:bg-slate-950">
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((value) => !value)}
      />

      <main className="h-[calc(100dvh-4rem)] min-h-0 overflow-hidden">
        <div className="hidden h-full min-h-0 min-w-0 xl:grid xl:grid-cols-[320px_minmax(0,1fr)] xl:overflow-hidden">
          <Sidebar {...sidebarProps} />

          <section className="relative h-full min-h-0 min-w-0 overflow-hidden">
            <div className="absolute left-16 top-3 z-[2000]">
              <PanelToggle />
            </div>

            <div
              className={
                rightPanelView === "map"
                  ? "h-full min-h-0 w-full min-w-0"
                  : "hidden"
              }
            >
              <PropertyMap {...mapProps} />
            </div>

            <div
              className={
                rightPanelView === "ivf"
                  ? "h-full min-h-0 w-full overflow-auto"
                  : "hidden"
              }
            >
              <IvfPanel {...ivfPanelProps} />
            </div>
          </section>
        </div>

        <div className="flex h-full min-h-0 flex-col xl:hidden">
          <div className="flex shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <MobileTabButton tab="map" icon={<Map size={15} />} label="Kart" />
            <MobileTabButton
              tab="ivf"
              icon={<Table2 size={15} />}
              label="IVF"
            />
            <MobileTabButton
              tab="sidebar"
              icon={<SlidersHorizontal size={15} />}
              label="Innstillinger"
            />
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className={`absolute inset-0 ${
                mobileTab === "map"
                  ? "z-10"
                  : "pointer-events-none z-0 opacity-0"
              }`}
            >
              <PropertyMap {...mapProps} />
            </div>

            {mobileTab === "ivf" && (
              <div className="absolute inset-0 z-10 overflow-auto">
                <IvfPanel {...ivfPanelProps} />
              </div>
            )}

            {mobileTab === "sidebar" && (
              <div className="absolute inset-0 z-10 overflow-auto">
                <Sidebar {...sidebarProps} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}