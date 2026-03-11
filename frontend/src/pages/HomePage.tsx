// @ts-nocheck

import {
  MapContainer,
  TileLayer,
  useMapEvents,
  CircleMarker,
} from "react-leaflet";
import logo from "../assets/logo.png";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../firebase"; // sørg for at auth eksporteres fra firebase-fila deres

type WeatherStation = {
  id: string;
  name: string;
  municipality?: string;
  county?: string;
};

type IvfResponse = {
  station_id: string;
  station_name: string;
  durations: number[];
  return_periods: number[];
  ls_ha: Record<string, Record<string, number>>;
  mm: Record<string, Record<string, number>>;
};

// --- typer og dblclick-handler ---
type LatLng = { lat: number; lng: number };

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    dblclick(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  // ekstra sikkerhet (i tillegg til MapContainer-prop)
  useEffect(() => {
    map.doubleClickZoom.disable();
  }, [map]);

  return null;
}

export default function HomePage() {
  const [projectName, setProjectName] = useState("");
  const { user } = useAuth();

  // Dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const [darkMode, setDarkMode] = useState(false);
  const [selectedWeatherStation, setSelectedWeatherStation] = useState("");
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [stationSearch, setStationSearch] = useState("");
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const stationBoxRef = useRef<HTMLDivElement | null>(null);

  const [rightPanelView, setRightPanelView] = useState<"map" | "ivf">("map");

  const [ivfData, setIvfData] = useState<IvfResponse | null>(null);
  const [ivfLoading, setIvfLoading] = useState(false);
  const [ivfError, setIvfError] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Hent værstasjoner fra backend til dropdown
  useEffect(() => {
    async function fetchStations() {
      try {
        // prøv først router med prefix /ivf
        let res = await fetch("http://localhost:8000/ivf/stations");

        // fallback hvis routeren er mountet uten prefix
        if (!res.ok) {
          res = await fetch("http://localhost:8000/stations");
        }

        if (!res.ok) throw new Error("Kunne ikke hente værstasjoner");

        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          setWeatherStations(data);
          setSelectedWeatherStation(data[0].id);
        }
      } catch (err) {
        console.error("Feil ved henting av værstasjoner:", err);
      }
    }

    fetchStations();
  }, []);

  const filteredWeatherStations = weatherStations.filter((station) =>
    `${station.name} ${station.municipality ?? ""} ${station.county ?? ""}`
      .toLowerCase()
      .includes(stationSearch.toLowerCase())
  );

  const selectedStation = weatherStations.find(
    (station) => station.id === selectedWeatherStation
  );

  // Hent IVF-data for valgt værstasjon
  useEffect(() => {
  async function fetchIvf() {
    if (!selectedWeatherStation) return;

    setIvfLoading(true);
    setIvfError("");

    try {
      const res = await fetch(
        `http://localhost:8000/ivf/${selectedWeatherStation}`
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Kunne ikke hente IVF-data");
      }

      const data = await res.json();
      setIvfData(data);
    } catch (err) {
      setIvfError(
        err instanceof Error ? err.message : "Feil ved henting av IVF-data"
      );
      setIvfData(null);
    } finally {
      setIvfLoading(false);
    }
  }

  fetchIvf();
}, [selectedWeatherStation]);

  // Klikk utenfor for å lukke menyer
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;

      if (menuOpen) {
        const clickedMenu = menuRef.current?.contains(target);
        const clickedButton = buttonRef.current?.contains(target);

        if (!clickedMenu && !clickedButton) setMenuOpen(false);
      }

      if (stationDropdownOpen) {
        const clickedStationBox = stationBoxRef.current?.contains(target);
        if (!clickedStationBox) {
          setStationDropdownOpen(false);
        }
      }
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen, stationDropdownOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await signOut(auth);
  }

  // --- state for to punkt + resultat ---
  const [pointA, setPointA] = useState<LatLng | null>(null);
  const [pointB, setPointB] = useState<LatLng | null>(null);

  const [hoyde, setHoyde] = useState<number | null>(null);
  const [lengde, setLengde] = useState<number | null>(null);
  const [konsentrasjonstid, setKonsentrasjonstid] = useState<number | null>(
    null
  );

  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainError, setTerrainError] = useState("");

  // --- infiltrasjon state ---
  const [jordtyper, setJordtyper] = useState<
    { id: string; navn: string; k_m_s: number; beskrivelse: string }[]
  >([]);
  const [infiltrasjonMetode, setInfiltrasjonMetode] = useState<"altA" | "altB">("altB");
  const [valgtJordtype, setValgtJordtype] = useState("");
  const [arealBunn, setArealBunn] = useState("");
  const [arealSide, setArealSide] = useState("");
  const [qInfManuell, setQInfManuell] = useState("");

  // --- hent jordtyper fra backend ---
  useEffect(() => {
    fetch("http://localhost:8000/calculation/jordtyper")
      .then((r) => r.json())
      .then((data) => setJordtyper(data))
      .catch(() => {});
  }, []);

  // --- API-kall til FastAPI ---
  async function fetchTerrain(a: LatLng, b: LatLng) {
    setTerrainLoading(true);
    setTerrainError("");

    try {
      const res = await fetch("http://localhost:8000/calculate-terrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat1: a.lat,
          lng1: a.lng,
          lat2: b.lat,
          lng2: b.lng,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setLengde(typeof data.lengde_m === "number" ? data.lengde_m : null);
      setHoyde(
        typeof data.hoydeforskjell_m === "number" ? data.hoydeforskjell_m : null
      );
      setKonsentrasjonstid(
        typeof data.konsentrasjonstid_min === "number"
          ? data.konsentrasjonstid_min
          : null
      );
    } catch (e: unknown) {
      setTerrainError(
        e instanceof Error ? e.message : "Kunne ikke hente terrengdata"
      );
      setLengde(null);
      setHoyde(null);
      setKonsentrasjonstid(null);
    } finally {
      setTerrainLoading(false);
    }
  }

  // --- 2-dobbelklikk logikk ---
  function handleMapPick(lat: number, lng: number) {
    // 1. punkt eller ny runde (hvis begge var satt)
    if (!pointA || (pointA && pointB)) {
      setPointA({ lat, lng });
      setPointB(null);

      setHoyde(null);
      setLengde(null);
      setKonsentrasjonstid(null);
      setTerrainError("");
      return;
    }

    // 2. punkt
    const b = { lat, lng };
    setPointB(b);
    fetchTerrain(pointA, b);
  }

  return (
    <div className="min-h-dvh w-full bg-[#F6F8FF] dark:bg-slate-950">
      <header className="sticky top-0 z-[9999] w-full bg-[#213F53] dark:bg-slate-950">
        <div className="flex h-16 w-full items-center justify-between px-5">
          {/* Left */}
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <img
                src={logo}
                alt="Trygt Overvann logo"
                className="h-10 w-auto object-contain"
              />
            </div>

            <div className="text-lg font-semibold text-white">
              Trygt Overvann AS
            </div>
          </div>

          {/* Center (Prosjektnavn) */}
          <div className="flex flex-1 justify-center px-4">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-10 w-full max-w-xl rounded-full bg-white px-5 text-sm text-slate-900 shadow-md outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/20 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700 text-center"
              placeholder="Prosjektnavn"
              aria-label="Prosjektnavn"
            />
          </div>

          {/* Right (Profile + dropdown) */}
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white text-white hover:bg-white/10 transition"
              aria-label="Profilmeny"
              aria-expanded={menuOpen}
            >
              <svg width="35" height="35" viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                  <clipPath id="avatarClip">
                    <circle cx="12" cy="12" r="10.2" />
                  </clipPath>
                </defs>

                <g clipPath="url(#avatarClip)" transform="translate(0,3)">
                  <rect
                    x="0"
                    y="18.5"
                    width="24"
                    height="6"
                    fill="currentColor"
                  />
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path
                    d="M4.2 19.2c1.4-4.2 5.1-6.5 7.8-6.5s6.4 2.3 7.8 6.5"
                    fill="currentColor"
                  />
                </g>
              </svg>
            </button>

            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-3 z-[9999] w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full 
  bg-white text-black border border-slate-950
  dark:bg-slate-700 dark:text-white dark:border-slate-600
  text-sm font-semibold"
                  >
                    {user?.displayName
                      ? user.displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                      : user?.email?.charAt(0).toUpperCase()}
                  </div>

                  {/* Navn */}
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {user?.displayName || "Bruker"}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    // senere: navigate("/profil")
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      {/* icon */}
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                      >
                        <path
                          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M4 20c2-3.5 5-5 8-5s6 1.5 8 5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Profil</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    // senere: navigate("/filer")
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                      >
                        <path
                          d="M4 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Filer</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>

                {/* Dark mode row */}
                <div className="px-4 py-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                      >
                        <path
                          d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Mørk modus</span>
                  </div>

                  <button
                    onClick={() => setDarkMode((v) => !v)}
                    className={`relative h-6 w-10 rounded-full transition ${
                      darkMode ? "bg-slate-200/30" : "bg-slate-200"
                    }`}
                    aria-label="Toggle mørk modus"
                    type="button"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                        darkMode ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                      >
                        <path
                          d="M10 17l5-5-5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M15 12H3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M21 3v18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">Logg ut</span>
                  </div>
                  <span className="text-slate-400">›</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="h-[calc(100dvh-4rem)] bg-[#F6F8FF] dark:bg-slate-950">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[320px_1fr]">
          {/* Left panel */}
          <aside className="order-2 border-t border-slate-200 bg-[#F6F8FF] p-4 lg:order-1 lg:border-r lg:border-t-0 dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-5">
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Eiendoms-ID
                </label>
                <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
              </section>

              <section>
                <div className="grid grid-cols-3 gap-3">
                  <input className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
                  <input className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
                  <input className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  (F.eks. gårdsnr, bruksnr, postnr – kobles dynamisk senere)
                </div>
              </section>

              {/* Værstasjon */}
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Værstasjon
                </label>

                <div className="relative" ref={stationBoxRef}>
                  <input
                    type="text"
                    value={stationSearch}
                    onChange={(e) => {
                      setStationSearch(e.target.value);
                      setStationDropdownOpen(true);
                    }}
                    onFocus={() => setStationDropdownOpen(true)}
                    placeholder={
                      selectedStation
                        ? `${selectedStation.name}${
                            selectedStation.municipality
                              ? ` (${selectedStation.municipality})`
                              : ""
                          }`
                        : "Søk etter værstasjon..."
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-slate-700"
                  />

                  <button
                    type="button"
                    onClick={() => setStationDropdownOpen((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label="Åpne værstasjoner"
                  >
                    ▾
                  </button>

                  {stationDropdownOpen && (
                    <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {filteredWeatherStations.length > 0 ? (
                        filteredWeatherStations.map((station) => (
                          <button
                            key={station.id}
                            type="button"
                            onClick={() => {
                              setSelectedWeatherStation(station.id);
                              setStationSearch("");
                              setStationDropdownOpen(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800 ${
                              selectedWeatherStation === station.id
                                ? "bg-slate-100 dark:bg-slate-800"
                                : ""
                            }`}
                          >
                            {station.name}
                            {station.municipality
                              ? ` (${station.municipality})`
                              : ""}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                          Ingen værstasjoner funnet
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Høyde og Lengde (read-only, koblet til API) */}
              <section>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Høyde
                    </label>
                    <input
                      className="h-10 w-full rounded-full border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      value={
                        terrainLoading
                          ? "Henter..."
                          : hoyde !== null
                          ? `${hoyde.toFixed(1)} m`
                          : ""
                      }
                      placeholder=""
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Lengde
                    </label>
                    <input
                      className="h-10 w-full rounded-full border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      value={
                        terrainLoading
                          ? "Henter..."
                          : lengde !== null
                          ? `${lengde.toFixed(1)} m`
                          : ""
                      }
                      placeholder=""
                      readOnly
                    />
                  </div>
                </div>

                {terrainError && (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {terrainError}
                  </div>
                )}

                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Dobbeltklikk to punkter i kartet for å beregne lengde og
                  høydeforskjell.
                </div>

                {konsentrasjonstid !== null && !terrainLoading && (
                  <div className="mt-3 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                    Konsentrasjonstid:{" "}
                    <span className="font-semibold">
                      {konsentrasjonstid.toFixed(2)} min
                    </span>
                  </div>
                )}
              </section>

              {/* Infiltrasjon */}
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Infiltrasjonskapasitet
                </label>

                {/* Toggle Alt B / Alt A */}
                <div className="mb-3 flex overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setInfiltrasjonMetode("altB")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      infiltrasjonMetode === "altB"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    Direkte Q_inf
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfiltrasjonMetode("altA")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      infiltrasjonMetode === "altA"
                        ? "bg-[#213F53] text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    Jordtype
                  </button>
                </div>

                {infiltrasjonMetode === "altB" && (
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Q_inf [l/s]
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={qInfManuell}
                      onChange={(e) => setQInfManuell(e.target.value)}
                      placeholder="0.0"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                )}

                {infiltrasjonMetode === "altA" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Jordtype
                      </label>
                      <select
                        value={valgtJordtype}
                        onChange={(e) => setValgtJordtype(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                      >
                        <option value="">Velg jordtype...</option>
                        {jordtyper.map((jt) => (
                          <option key={jt.id} value={jt.id}>
                            {jt.navn} — {jt.beskrivelse} (k = {jt.k_m_s} m/s)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                          A_bunn [m²]
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={arealBunn}
                          onChange={(e) => setArealBunn(e.target.value)}
                          placeholder="0.0"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                          A_side [m²]
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={arealSide}
                          onChange={(e) => setArealSide(e.target.value)}
                          placeholder="0.0"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                        />
                      </div>
                    </div>

                    {/* Live Q_inf preview */}
                    {valgtJordtype && arealBunn && arealSide && (() => {
                      const jt = jordtyper.find((j) => j.id === valgtJordtype);
                      if (!jt) return null;
                      const qInf =
                        jt.k_m_s *
                        (parseFloat(arealBunn) * 0.5 + parseFloat(arealSide) * 1.0) *
                        1000;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                          Q_inf:{" "}
                          <span className="font-semibold">{qInf.toFixed(4)} l/s</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </section>

              <section>
                <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
              </section>
            </div>
          </aside>

          {/* Right panel */}
          <section className="order-1 h-full lg:order-2 flex flex-col">
            {/* Picker */}
            <div className="flex gap-2 border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setRightPanelView("map")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  rightPanelView === "map"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Kart
              </button>

              <button
                type="button"
                onClick={() => setRightPanelView("ivf")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  rightPanelView === "ivf"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                IVF-tabell
              </button>
            </div>

            <div className="flex-1">
              {rightPanelView === "map" && (
                <div className="h-full w-full">
                  <MapContainer
                    center={[60.3913, 5.3221]}
                    zoom={13}
                    className="h-full w-full"
                    doubleClickZoom={false}
                  >
                    {/* fanger dobbeltklikk */}
                    <MapClickHandler onPick={handleMapPick} />

                    {/* “pinpoint” der du dobbeltklikker */}
                    {pointA && (
                      <CircleMarker
                        center={[pointA.lat, pointA.lng]}
                        radius={7}
                      />
                    )}
                    {pointB && (
                      <CircleMarker
                        center={[pointB.lat, pointB.lng]}
                        radius={7}
                      />
                    )}

                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url={
                        darkMode
                          ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                          : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      }
                    />
                  </MapContainer>
                </div>
              )}

              {rightPanelView === "ivf" && (
                <div className="h-full overflow-auto bg-white p-4 dark:bg-slate-950">
                  <div className="mb-4">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      IVF-tabell
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {ivfData?.station_name ||
                        selectedStation?.name ||
                        "Ingen værstasjon valgt"}
                    </div>
                  </div>

                  {ivfLoading && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Laster IVF-data...
                    </div>
                  )}

                  {ivfError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      {ivfError}
                    </div>
                  )}

                  {!ivfLoading && !ivfError && ivfData && (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="min-w-full border-collapse text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                            <th className="border border-slate-200 px-3 py-2 text-left font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                              Varighet (min)
                            </th>
                            {ivfData.return_periods.map((period) => (
                              <th
                                key={period}
                                className="border border-slate-200 px-3 py-2 text-left font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                              >
                                {period} år
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ivfData.durations.map((duration) => (
                            <tr
                              key={duration}
                              className="bg-white dark:bg-slate-950"
                            >
                              <td className="border border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-700 dark:text-slate-100">
                                {duration}
                              </td>
                              {ivfData.return_periods.map((period) => (
                                <td
                                  key={`${duration}-${period}`}
                                  className="border border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-700 dark:text-slate-100"
                                >
                                  {ivfData.ls_ha[String(duration)]?.[
                                    String(period)
                                  ] ?? "-"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!ivfLoading && !ivfError && !ivfData && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Ingen IVF-data tilgjengelig.
                    </div>
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