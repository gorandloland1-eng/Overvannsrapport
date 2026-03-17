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
import { auth, db, storage } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { Map, Table2 } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

type LatLng = { lat: number; lng: number };

function MapClickHandler({
  onPick,
  onSingleClick,
  onCancelSingleClick,
  onMouseMove,
}: {
  onPick: (lat: number, lng: number) => void;
  onSingleClick: (lat: number, lng: number) => void;
  onCancelSingleClick: () => void;
  onMouseMove: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onSingleClick(e.latlng.lat, e.latlng.lng);
    },
    dblclick(e) {
      onCancelSingleClick();
      onPick(e.latlng.lat, e.latlng.lng);
    },
    mousemove(e) {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    map.doubleClickZoom.disable();
  }, [map]);

  return null;
}

function MapLayerToggle({
  layer,
  onChange,
}: {
  layer: "kart" | "terreng" | "satellitt";
  onChange: (layer: "kart" | "terreng" | "satellitt") => void;
}) {
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
  const [info, setInfo] = useState({
    ratio: 0,
    barWidth: 80,
    barLabel: "100 m",
  });

  useEffect(() => {
    function update() {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const metersPerPixel =
        (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) /
        Math.pow(2, zoom);

      const ratio = Math.round(metersPerPixel / (0.0254 / 96));

      const maxMeters = metersPerPixel * 80;
      const exp = Math.floor(Math.log10(maxMeters));
      const d = Math.pow(10, exp);
      const barMeters =
        maxMeters >= 5 * d ? 5 * d : maxMeters >= 2 * d ? 2 * d : d;
      const barLabel =
        barMeters >= 1000 ? `${barMeters / 1000} km` : `${barMeters} m`;
      const barWidth = Math.round(barMeters / metersPerPixel);

      setInfo({ ratio, barWidth, barLabel });
    }

    map.on("zoomend moveend", update);
    update();
    return () => {
      map.off("zoomend moveend", update);
    };
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
        <span className="text-[10px] font-medium text-slate-600">
          {info.barLabel}
        </span>
      </div>
      <div className="border-l border-slate-300 pl-3 text-[10px] font-semibold text-slate-600">
        1 : {info.ratio.toLocaleString("no-NO")}
      </div>
    </div>
  );
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
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad));

  const easting =
    k0 *
      n *
      (aTerm +
        ((1 - t + c) * Math.pow(aTerm, 3)) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(aTerm, 5)) /
          120) +
    500000;

  let northing =
    k0 *
    (m +
      n *
        tanLat *
        ((aTerm * aTerm) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * Math.pow(aTerm, 4)) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * ep2) *
            Math.pow(aTerm, 6)) /
            720));

  if (lat < 0) northing += 10000000;

  return {
    northing: Math.round(northing),
    easting: Math.round(easting - 500000),
  };
}

export default function HomePage() {
  const [projectName, setProjectName] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const [areal, setAreal] = useState("200");
  const [returperiode, setReturperiode] = useState("5");
  const [klimafaktor, setKlimafaktor] = useState("1.0");
  const [maksPaslipp, setMaksPaslipp] = useState("0.0");

  const [pointA, setPointA] = useState<LatLng | null>(null);
  const [pointB, setPointB] = useState<LatLng | null>(null);

  const [hoyde, setHoyde] = useState<number | null>(null);
  const [lengde, setLengde] = useState<number | null>(null);
  const [konsentrasjonstid, setKonsentrasjonstid] = useState<number | null>(
    null
  );

  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainError, setTerrainError] = useState("");
  const [mapLayer, setMapLayer] = useState<"kart" | "terreng" | "satellitt">(
    "kart"
  );
  const [eiendomGrense, setEiendomGrense] = useState<object | null>(null);
  const [eiendomAdresse, setEiendomAdresse] = useState<string | null>(null);
  const [eiendomMatrikkel, setEiendomMatrikkel] = useState<{
    gnr: number;
    bnr: number;
    kommunenummer: string;
  } | null>(null);
  const [eiendomKoordinat, setEiendomKoordinat] = useState<LatLng | null>(null);
  const [mouseKoordinat, setMouseKoordinat] = useState<LatLng | null>(null);
  const [eiendomLoading, setEiendomLoading] = useState(false);
  const [eiendomError, setEiendomError] = useState("");
  const singleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [jordtyper, setJordtyper] = useState<
    { id: string; navn: string; k_m_s: number; beskrivelse: string }[]
  >([]);
  const [infiltrasjonMetode, setInfiltrasjonMetode] = useState<"altA" | "altB">(
    "altB"
  );
  const [valgtJordtype, setValgtJordtype] = useState("");
  const [arealBunn, setArealBunn] = useState("");
  const [arealSide, setArealSide] = useState("");
  const [qInfManuell, setQInfManuell] = useState("");

  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    async function fetchStations() {
      try {
        let res = await fetch("http://localhost:8000/ivf/stations");
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

  useEffect(() => {
    async function fetchIvf() {
      if (!selectedWeatherStation) return;

      setIvfLoading(true);
      setIvfError("");

      try {
        const res = await fetch(
          `http://localhost:8000/ivf/ivf/${selectedWeatherStation}`
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

  useEffect(() => {
    fetch("http://localhost:8000/calculation/jordtyper")
      .then((r) => r.json())
      .then((data) => setJordtyper(data))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await signOut(auth);
  }

  async function savePdfToFilesPage(pdfBlob: Blob) {
    if (!user) throw new Error("Bruker ikke innlogget");

    const safeProjectName = projectName.trim() || "Prosjektnavn";
    const fileName = `${safeProjectName}-${Date.now()}.pdf`;

    const fileRef = ref(storage, `pdfReports/${user.uid}/${fileName}`);
    await uploadBytes(fileRef, pdfBlob);

    const pdfUrl = await getDownloadURL(fileRef);

    await addDoc(collection(db, "pdfReports"), {
      userId: user.uid,
      projectName: safeProjectName,
      description: "PDF-rapport generert fra overvannsprosjekt",
      pdfUrl,
      createdAt: serverTimestamp(),
    });
  }

  async function handleGeneratePdf() {
    setPdfSaving(true);
    setPdfError("");

    try {
      const qInfCalculated =
        infiltrasjonMetode === "altB"
          ? Number(qInfManuell || 0)
          : (() => {
              const jt = jordtyper.find((j) => j.id === valgtJordtype);
              if (!jt) return 0;
              return (
                jt.k_m_s *
                (Number(arealBunn || 0) * 0.5 + Number(arealSide || 0) * 1.0) *
                1000
              );
            })();

      const payload = {
        projectName,
        selectedWeatherStation,
        selectedWeatherStationName: selectedStation?.name ?? "",
        areal: Number(areal || 0),
        returperiode: Number(returperiode || 0),
        klimafaktor: Number(klimafaktor || 0),
        maksPaslipp: Number(maksPaslipp || 0),
        hoyde,
        lengde,
        konsentrasjonstid,
        infiltrasjonMetode,
        valgtJordtype,
        arealBunn: Number(arealBunn || 0),
        arealSide: Number(arealSide || 0),
        qInf: qInfCalculated,
        eiendomAdresse,
        eiendomMatrikkel,
      };

      const res = await fetch("http://localhost:8000/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Kunne ikke generere PDF");
      }

      const pdfBlob = await res.blob();
      await savePdfToFilesPage(pdfBlob);
      navigate("/filer");
    } catch (e: unknown) {
      setPdfError(
        e instanceof Error ? e.message : "Noe gikk galt ved generering av PDF"
      );
    } finally {
      setPdfSaving(false);
    }
  }

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
        typeof data.konsentrasjonstid_ivf_min === "number"
          ? data.konsentrasjonstid_ivf_min
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

  function handleMapPick(lat: number, lng: number) {
    if (!pointA || (pointA && pointB)) {
      setPointA({ lat, lng });
      setPointB(null);

      setHoyde(null);
      setLengde(null);
      setKonsentrasjonstid(null);
      setTerrainError("");
      return;
    }

    const b = { lat, lng };
    setPointB(b);
    fetchTerrain(pointA, b);
  }

  function handleMapSingleClick(lat: number, lng: number) {
    if (singleClickTimer.current) clearTimeout(singleClickTimer.current);
    singleClickTimer.current = setTimeout(async () => {
      setEiendomLoading(true);
      setEiendomError("");
      setEiendomGrense(null);
      setEiendomAdresse(null);
      setEiendomMatrikkel(null);
      setEiendomKoordinat({ lat, lng });

      try {
        const res = await fetch(
          `http://localhost:8000/v1/eiendom/punkt?lat=${lat}&lng=${lng}`
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Kunne ikke hente eiendomsdata");
        }

        const data = await res.json();
        setEiendomAdresse(data.adresse ?? null);
        setEiendomGrense(data.grense ?? null);

        if (data.matrikkel) {
          setEiendomMatrikkel({
            gnr: data.matrikkel.gnr,
            bnr: data.matrikkel.bnr,
            kommunenummer: data.matrikkel.kommunenummer ?? "",
          });
        } else if (data.grense?.features?.length > 0) {
          const props = data.grense.features[0]?.properties ?? {};
          const fromKeys = (keys: string[]) => {
            for (const key of keys) {
              const value = props[key];
              const parsed = Number(value);
              if (Number.isFinite(parsed)) return parsed;
            }
            return null;
          };
          const gnr = fromKeys([
            "gardsnummer",
            "gårdsnummer",
            "gnr",
            "GARDSNUMMER",
            "GNR",
          ]);
          const bnr = fromKeys([
            "bruksnummer",
            "bnr",
            "BRUKSNUMMER",
            "BNR",
          ]);
          const kommunenummer =
            props.kommunenummer ??
            props.kommunenr ??
            props.knr ??
            props.KOMMUNENUMMER ??
            "";

          if (gnr !== null && bnr !== null) {
            setEiendomMatrikkel({
              gnr,
              bnr,
              kommunenummer: String(kommunenummer),
            });
          }
        }

        if (Array.isArray(data.warnings) && data.warnings.length > 0) {
          setEiendomError(data.warnings.join(" "));
        }
      } catch (_) {
        setEiendomError("Kunne ikke hente eiendomsdata.");
      } finally {
        setEiendomLoading(false);
      }
    }, 300);
  }

  function cancelSingleClick() {
    if (singleClickTimer.current) clearTimeout(singleClickTimer.current);
  }

  return (
    <div className="min-h-dvh w-full bg-[#F6F8FF] dark:bg-slate-950">
      <header className="sticky top-0 z-[9999] w-full bg-[#213F53] dark:bg-slate-950">
        <div className="flex h-16 w-full items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logo}
              alt="Trygt Overvann logo"
              className="h-10 w-auto cursor-pointer object-contain"
            />
            <div className="text-lg font-semibold text-white">
              Trygt Overvann AS
            </div>
          </Link>

          <div className="flex flex-1 justify-center px-4">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-10 w-full max-w-xl rounded-xl bg-white px-5 text-center text-sm text-slate-900 shadow-md outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/20 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
              placeholder="Prosjektnavn"
              aria-label="Prosjektnavn"
            />
          </div>

          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-white transition hover:opacity-90 ${
                user?.photoURL ? "" : "border-[3px] border-white hover:bg-white/10"
              }`}
              aria-label="Profilmeny"
              aria-expanded={menuOpen}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profilbilde"
                  className="h-full w-full object-cover"
                />
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
                    <path
                      d="M4.2 19.2c1.4-4.2 5.1-6.5 7.8-6.5s6.4 2.3 7.8 6.5"
                      fill="currentColor"
                    />
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
                      <img
                        src={user.photoURL}
                        alt="Profilbilde"
                        className="h-full w-full object-cover"
                      />
                    ) : user?.displayName ? (
                      user.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                    ) : (
                      user?.email?.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {user?.displayName || "Bruker"}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/profil");
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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
                    navigate("/filer");
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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

                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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
                  className="w-full border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                          <path
                            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16 17l5-5-5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M21 12H9"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="text-sm font-medium">Logg ut</span>
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
          <aside className="order-2 overflow-y-auto border-t border-slate-200 bg-[#F6F8FF] p-4 lg:order-1 lg:border-r lg:border-t-0 dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-5">
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Eiendoms-ID
                </label>
                <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
              </section>

              <section>
                <div className="grid grid-cols-3 gap-3">
                  <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
                  <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
                  <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  (F.eks. gårdsnr, bruksnr, postnr – kobles dynamisk senere)
                </div>
              </section>

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

              <section>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Høyde
                    </label>
                    <input
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                    Konsentrasjonstid:{" "}
                    <span className="font-semibold">
                      {konsentrasjonstid.toFixed(2)} min
                    </span>
                  </div>
                )}

                {eiendomLoading && (
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Henter eiendomsdata...
                  </div>
                )}

                {eiendomError && !eiendomLoading && (
                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    {eiendomError}
                  </div>
                )}

                {(eiendomAdresse || eiendomMatrikkel) && !eiendomLoading && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                      Nærmeste adresse
                    </div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {eiendomAdresse ?? "Ingen adresse funnet for punktet"}
                    </div>
                    {eiendomMatrikkel && (
                      <div className="mt-2 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Knr:{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {eiendomMatrikkel.kommunenummer}
                          </span>
                        </span>
                        <span>
                          Gnr:{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {eiendomMatrikkel.gnr}
                          </span>
                        </span>
                        <span>
                          Bnr:{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {eiendomMatrikkel.bnr}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Infiltrasjonskapasitet
                </label>

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

                    {valgtJordtype && arealBunn && arealSide && (() => {
                      const jt = jordtyper.find((j) => j.id === valgtJordtype);
                      if (!jt) return null;
                      const qInf =
                        jt.k_m_s *
                        (parseFloat(arealBunn) * 0.5 +
                          parseFloat(arealSide) * 1.0) *
                        1000;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                          Q_inf:{" "}
                          <span className="font-semibold">
                            {qInf.toFixed(4)} l/s
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </section>

              <section>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Areal
                    </label>
                    <input
                      type="number"
                      value={areal}
                      onChange={(e) => setAreal(e.target.value)}
                      placeholder="200"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Returperiode
                    </label>
                    <select
                      value={returperiode}
                      onChange={(e) => setReturperiode(e.target.value)}
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    >
                      <option value="2">2 år</option>
                      <option value="5">5 år</option>
                      <option value="10">10 år</option>
                      <option value="20">20 år</option>
                      <option value="25">25 år</option>
                      <option value="50">50 år</option>
                      <option value="100">100 år</option>
                      <option value="200">200 år</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Klimafaktor
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={klimafaktor}
                      onChange={(e) => setKlimafaktor(e.target.value)}
                      placeholder="1.0"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Maks påslipp
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={maksPaslipp}
                      onChange={(e) => setMaksPaslipp(e.target.value)}
                      placeholder="0.0"
                      className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
                    />
                  </div>
                </div>

                {pdfError && (
                  <div className="mt-3 text-xs text-red-600 dark:text-red-400">
                    {pdfError}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleGeneratePdf}
                    disabled={pdfSaving}
                    className="h-14 w-full rounded-[16px] bg-slate-300 text-base font-semibold text-black transition hover:bg-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                  >
                    {pdfSaving ? "Genererer PDF..." : "Generer PDF"}
                  </button>
                </div>
              </section>
            </div>
          </aside>

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
                    aria-label="Kartvisning"
                    title="Kart"
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
                    aria-label="IVF-tabell"
                    title="IVF-tabell"
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
                    <MapClickHandler
                      onPick={handleMapPick}
                      onSingleClick={handleMapSingleClick}
                      onCancelSingleClick={cancelSingleClick}
                      onMouseMove={(lat, lng) => setMouseKoordinat({ lat, lng })}
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
                      maxNativeZoom={
                        mapLayer === "terreng"
                          ? 17
                          : mapLayer === "kart"
                          ? 18
                          : 19
                      }
                    />

                    {eiendomGrense && (
                      <GeoJSON
                        key={JSON.stringify(eiendomGrense)}
                        data={eiendomGrense}
                        style={{
                          color: "#f59e0b",
                          weight: 2,
                          fillOpacity: 0.1,
                          fillColor: "#f59e0b",
                        }}
                      />
                    )}

                    {pointA && (
                      <CircleMarker center={[pointA.lat, pointA.lng]} radius={7} />
                    )}
                    {pointB && (
                      <CircleMarker center={[pointB.lat, pointB.lng]} radius={7} />
                    )}

                    <div className="pointer-events-none absolute bottom-3 left-3 z-[1001] rounded-md border border-[#d8c4b0] bg-white/95 px-3 py-1 text-[16px] font-medium leading-none tracking-wide text-black shadow">
                      {(() => {
                        const source = mouseKoordinat ?? eiendomKoordinat;
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
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-blue-100 dark:bg-slate-800">
                            <th className="border-r border-b border-slate-400 px-3 py-2"></th>
                            <th
                              colSpan={ivfData.durations.length}
                              className="border-b border-slate-400 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200"
                            >
                              Varigheter (minutter)
                            </th>
                          </tr>

                          <tr className="bg-blue-100 dark:bg-slate-800">
                            <th className="border-r border-b border-slate-400 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                              Gjentaksintervall (år)
                            </th>

                            {ivfData.durations.map((duration) => (
                              <th
                                key={duration}
                                className="border-r border-b border-slate-400 px-2 py-2 text-center font-semibold text-slate-700 last:border-r-0 dark:text-slate-200"
                              >
                                {duration}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {ivfData.return_periods.map((period, i) => (
                            <tr
                              key={period}
                              className={
                                i % 2 === 0
                                  ? "bg-white dark:bg-slate-950"
                                  : "bg-slate-50 dark:bg-slate-900"
                              }
                            >
                              <td className="border-r border-b border-slate-300 px-3 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                {period}
                              </td>

                              {ivfData.durations.map((duration) => (
                                <td
                                  key={`${period}-${duration}`}
                                  className="border-r border-b border-slate-300 px-2 py-2 text-center text-slate-700 last:border-r-0 dark:border-slate-700 dark:text-slate-200"
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