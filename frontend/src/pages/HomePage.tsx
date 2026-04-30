// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { Map, Table2, SlidersHorizontal } from "lucide-react";

import { fetchPropertyByMatrikkel } from "../api/property";
import { fetchTerrain } from "../api/terrain";
import { fetchWeatherStations, fetchIvfData } from "../api/ivf";
import type { IvfResponse, WeatherStation } from "../api/ivf";

import Header from "../components/layout/Header";
import PropertyMap from "../components/map/PropertyMap";
import IvfPanel from "../components/map/IvfPanel";
import Sidebar from "../components/sidebar/Sidebar";

import { useFormState } from "../hooks/useFormState";
import { usePropertyState } from "../hooks/usePropertyState";
import { useTerrainState } from "../hooks/useTerrainState";
import { useGeneratePdf } from "../hooks/useGeneratePdf";

type MobileTab = "map" | "ivf" | "sidebar";
type RightPanelView = "map" | "ivf";
type MapLayer = "kart" | "terreng" | "satellitt";

export type ValidationErrors = {
  projectName?: string;
  municipalityNumber?: string;
  cadastralNumber?: string;
  propertyNumber?: string;
  selectedStationId?: string;
  heightDifference?: string;
  concentrationTime?: string;
  area?: string;
  climateFactor?: string;
  infiltration?: string;
};

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

function sortStationsByDistance(
  origin: { lat: number; lng: number } | null,
  stations: WeatherStation[]
) {
  if (!origin) return stations;

  return [...stations].sort((a, b) => {
    const aHasCoords = a.lat != null && a.lon != null;
    const bHasCoords = b.lat != null && b.lon != null;

    if (!aHasCoords && !bHasCoords) {
      return a.name.localeCompare(b.name, "no");
    }

    if (!aHasCoords) return 1;
    if (!bHasCoords) return -1;

    const aDistance = distanceKm(
      origin.lat,
      origin.lng,
      Number(a.lat),
      Number(a.lon)
    );

    const bDistance = distanceKm(
      origin.lat,
      origin.lng,
      Number(b.lat),
      Number(b.lon)
    );

    return aDistance - bDistance;
  });
}

function findNearestStation(
  centroid: { lat: number; lng: number } | null,
  stations: WeatherStation[]
) {
  if (!centroid || !stations.length) return null;

  return (
    stations
      .filter((s) => s.lat != null && s.lon != null)
      .map((s) => ({
        station: s,
        distance: distanceKm(
          centroid.lat,
          centroid.lng,
          Number(s.lat),
          Number(s.lon)
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
  const navigate = useNavigate();

  const mapRef = useRef(null);

  const { form, setField, resetForm } = useFormState();
  const {
    pdfSaving,
    pdfError,
    setPdfError,
    pdfSuccess,
    resetPdfSuccess,
    handleGeneratePdf,
  } = useGeneratePdf();

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
    elev1,
    setElev1,
    elev2,
    setElev2,
    heightDifference,
    setHeightDifference,
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

  const [rightPanelView, setRightPanelView] =
    useState<RightPanelView>("map");
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");
  const [mapLayer, setMapLayer] = useState<MapLayer>("kart");

  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [favoriteStationIds, setFavoriteStationIds] = useState<string[]>([]);
  const [stationSortOrigin, setStationSortOrigin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [ivfData, setIvfData] = useState<IvfResponse | null>(null);
  const [ivfLoading, setIvfLoading] = useState(false);
  const [ivfError, setIvfError] = useState("");

  const [soilTypes, setSoilTypes] = useState([]);
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors>({});

  const sortedWeatherStations = useMemo(() => {
    return sortStationsByDistance(stationSortOrigin, weatherStations);
  }, [stationSortOrigin, weatherStations]);

  const selectedStation = weatherStations.find(
    (s) => s.id === selectedStationId
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
    async function fetchFavorites() {
      if (!user?.uid) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.favoriteStationIds)) {
            setFavoriteStationIds(data.favoriteStationIds);
          }
        }
      } catch (e) {
        console.error("Kunne ikke hente favorittstasjoner:", e);
      }
    }

    fetchFavorites();
  }, [user?.uid]);

  async function toggleFavoriteStation(stationId: string) {
    if (!user?.uid) return;

    const nextFavorites = favoriteStationIds.includes(stationId)
      ? favoriteStationIds.filter((id) => id !== stationId)
      : [...favoriteStationIds, stationId];

    setFavoriteStationIds(nextFavorites);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        { favoriteStationIds: nextFavorites },
        { merge: true }
      );
    } catch (e) {
      console.error("Kunne ikke lagre favorittstasjon:", e);
      setFavoriteStationIds(favoriteStationIds);
    }
  }

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

    const timeout = setTimeout(() => {
      mapRef.current?.invalidateSize?.({ pan: false });
    }, 100);

    return () => clearTimeout(timeout);
  }, [mobileTab, rightPanelView]);

  function validate(): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!form.projectName.trim()) {
      errors.projectName = "Prosjektnavn er påkrevd";
    }

    if (!municipalityNumber.trim()) {
      errors.municipalityNumber = "Kommunenummer er påkrevd";
    }

    if (!cadastralNumber.trim()) {
      errors.cadastralNumber = "Gårdsnummer er påkrevd";
    }

    if (!propertyNumber.trim()) {
      errors.propertyNumber = "Bruksnummer er påkrevd";
    }

    if (!selectedStationId) {
      errors.selectedStationId = "Velg en værstasjon";
    }

    if (heightDifference === null) {
      errors.heightDifference =
        "Høydeforskjell mangler – dobbeltklikk to punkter i kartet";
    }

    if (concentrationTime === null) {
      errors.concentrationTime = "Konsentrasjonstid mangler";
    }

    if (!form.area || Number(form.area) <= 0) {
      errors.area = "Areal må være større enn 0";
    }

    if (!form.climateFactor || Number(form.climateFactor) <= 0) {
      errors.climateFactor = "Klimafaktor må være større enn 0";
    }

    if (form.infiltrationMethod === "soiltype") {
      if (!form.selectedSoilType) {
        errors.infiltration = "Velg jordtype";
      } else if (!form.bottomArea || !form.sideArea) {
        errors.infiltration = "Fyll ut A_bunn og A_sideflate";
      }
    }

    return errors;
  }

  function clearTerrainResult() {
    setElev1(null);
    setElev2(null);
    setHeightDifference(null);
    setLength(null);
    setConcentrationTime(null);
    setTerrainError("");
  }

  function handleMapPick(lat: number, lng: number) {
    if (!pointA || pointB) {
      setPointA({ lat, lng });
      setPointB(null);
      clearTerrainResult();
      return;
    }

    setPointB({ lat, lng });
    setTerrainLoading(true);
    setTerrainError("");

    fetchTerrain(pointA.lat, pointA.lng, lat, lng)
      .then((data) => {
        setElev1(data.elev1);
        setElev2(data.elev2);
        setHeightDifference(data.hoydeforskjell_m);
        setLength(data.lengde_m);
        setConcentrationTime(data.konsentrasjonstid_ivf_min);

        setValidationErrors((prev) => ({
          ...prev,
          heightDifference: undefined,
          concentrationTime: undefined,
        }));
      })
      .catch((e) => {
        setTerrainError(e.message);
        clearTerrainResult();
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

      if (data.centroid) {
        setStationSortOrigin(data.centroid);

        const nearestStation = findNearestStation(data.centroid, weatherStations);
        if (nearestStation) {
          setSelectedStationId(nearestStation.id);
          setStationSearch("");
          setStationDropdownOpen(false);
        }
      }

      setRightPanelView("map");
      setMobileTab("map");

      if (data.warnings?.length > 0) {
        setPropertyError(data.warnings.join(" "));
      }

      setValidationErrors((prev) => ({
        ...prev,
        municipalityNumber: undefined,
        cadastralNumber: undefined,
        propertyNumber: undefined,
        selectedStationId: undefined,
      }));
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
    setStationSortOrigin(null);
    setValidationErrors({});
    setPdfError("");
  }

  function handleTryGenerate() {
    const errors = validate();

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    handleGeneratePdf(pdfOptions);
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
    elev1,
    elev2,
    elevation: heightDifference,
    heightDifference,
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
    weatherStations: sortedWeatherStations,
    selectedStationId,
    setSelectedStationId,
    stationSearch,
    setStationSearch,
    stationDropdownOpen,
    setStationDropdownOpen,
    favoriteStationIds,
    toggleFavoriteStation,
    elev1,
    elev2,
    heightDifference,
    length,
    concentrationTime,
    terrainLoading,
    terrainError,
    soilTypes,
    handleGeneratePdf: handleTryGenerate,
    pdfSaving,
    pdfError,
    handleReset,
    validationErrors,
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
          aria-label="Kartvisning"
          title="Kart"
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
          aria-label="IVF-tabell"
          title="IVF-tabell"
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
        onToggleDarkMode={() => setDarkMode((v) => !v)}
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
            <MobileTabButton tab="ivf" icon={<Table2 size={15} />} label="IVF" />
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

      {pdfSuccess && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900">
            <div className="mb-5 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="#16a34a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <h2 className="mb-2 text-center text-xl font-bold text-slate-900 dark:text-slate-100">
              PDF opprettet!
            </h2>

            <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Rapporten er lagret og tilgjengelig under Mine filer.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  resetPdfSuccess();
                  navigate("/filer");
                }}
                className="w-full rounded-xl bg-[#213F53] py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Gå til Mine filer
              </button>

              <button
                onClick={() => {
                  resetPdfSuccess();
                  handleReset();
                }}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Opprett ny rapport
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}