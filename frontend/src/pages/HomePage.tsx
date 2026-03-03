import { MapContainer, TileLayer } from "react-leaflet";
import logo from "../assets/logo.png";
import { useState } from "react";

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

  return (
    <div className="min-h-dvh w-full bg-[#F6F8FF]">
    <header className="sticky top-0 z-20 w-full bg-[#213F53]">
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

      <div className="text-lg font-semibold text-white">Trygt Overvann AS</div>
    </div>

    {/* Center */}
   <div className="flex flex-1 justify-center px-4">
  <input
    value={projectName}
    onChange={(e) => setProjectName(e.target.value)}
    className="h-10 w-full max-w-xl rounded-full bg-white px-5 text-sm text-slate-900 shadow-md outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/20 text-center"
    placeholder="Prosjektnavn"
    aria-label="Prosjektnavn"
  />
</div>

    {/* Right */}
<button
  className="flex h-10 w-10 items-center justify-center rounded-full border-3 border-white text-white hover:bg-white/10 transition"
  aria-label="Profil"
>
  <svg width="35" height="35" viewBox="0 0 24 24">
    <defs>
      {/* Klipp innholdet litt innenfor ringen */}
      <clipPath id="avatarClip">
        <circle cx="12" cy="12" r="10.2" />
      </clipPath>
    </defs>

    <g clipPath="url(#avatarClip)" transform="translate(0,3)">
      {/* Dette tetter bunnen så du aldri får blå “spalte” */}
      <rect x="0" y="18.5" width="24" height="6" fill="currentColor" />

      {/* Hodet */}
      <circle cx="12" cy="8" r="4" fill="currentColor" />

      {/* Skuldre */}
      <path
        d="M4.2 19.2c1.4-4.2 5.1-6.5 7.8-6.5s6.4 2.3 7.8 6.5"
        fill="currentColor"
      />
    </g>
  </svg>
</button>
  </div>
</header>

      {/* Main content */}
      <main className="h-[calc(100dvh-4rem)] bg-[#F6F8FF]">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[320px_1fr]">
          {/* Left panel */}
          <aside className="order-2 border-t border-slate-200 bg-[#F6F8FF] p-4 lg:order-1 lg:border-r lg:border-t-0">
            <div className="space-y-5">
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Eiendoms-ID
                </label>
                <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200" />
              </section>

              {/* Tre små felter (som “chips” i skjermbildet) */}
              <section>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200"
                    placeholder=""
                    aria-label="Felt 1"
                  />
                  <input
                    className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200"
                    placeholder=""
                    aria-label="Felt 2"
                  />
                  <input
                    className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200"
                    placeholder=""
                    aria-label="Felt 3"
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  (F.eks. gårdsnr, bruksnr, postnr – kobles dynamisk senere)
                </div>
              </section>

              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Værstasjon
                </label>
                <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200">
                  {WEATHER_STATIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </section>

              {/* “Stor boks” / resultatpanel */}
              <section className="h-80 rounded-2xl border border-slate-200 bg-slate-50" />

              {/* Ekstra input nederst (som skjermbildet antyder) */}
              <section>
                <input className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200" />
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
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </MapContainer>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}