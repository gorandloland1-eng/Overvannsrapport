import { MapContainer, TileLayer } from "react-leaflet";
import logo from "../assets/logo.png";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../firebase"; // sørg for at auth eksporteres fra firebase-fila deres

type WeatherStation = {
  id: string;
  name: string;
};

const WEATHER_STATIONS: WeatherStation[] = [
  { id: "sn18700", name: "Oslo - Blindern" },
  { id: "sn50540", name: "Bergen - Florida" },
  { id: "sn76920", name: "Trondheim - Voll" },
];

export default function HomePage() {
  const [projectName, setProjectName] = useState("");
  const { user } = useAuth();

  // Dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

const [darkMode, setDarkMode] = useState(false);

useEffect(() => {
  document.documentElement.classList.toggle("dark", darkMode);
}, [darkMode]);

  // Klikk utenfor for å lukke meny
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuOpen) return;

      const target = e.target as Node;
      const clickedMenu = menuRef.current?.contains(target);
      const clickedButton = buttonRef.current?.contains(target);

      if (!clickedMenu && !clickedButton) setMenuOpen(false);
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await signOut(auth);
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
                  <rect x="0" y="18.5" width="24" height="6" fill="currentColor" />
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

  <div className="flex h-9 w-9 items-center justify-center rounded-full 
  bg-white text-black border border-slate-950
  dark:bg-slate-700 dark:text-white dark:border-slate-600
  text-sm font-semibold">
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
                    // senere: navigate("/filer")
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800"
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

                {/* Dark mode row */}
                <div className="px-4 py-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
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
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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

              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Værstasjon
                </label>
                <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700">
                  {WEATHER_STATIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </section>

              <section className="h-80 rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />

              <section>
                <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700" />
              </section>
            </div>
          </aside>

          {/* Map */}
          <section className="order-1 h-full lg:order-2">
            <div className="h-full w-full">
              <MapContainer
                center={[60.3913, 5.3221]}
                zoom={13}
                className="h-full w-full"
              >
               <TileLayer
  attribution='&copy; OpenStreetMap contributors'
  url={
    darkMode
      ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
/>
              </MapContainer>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}