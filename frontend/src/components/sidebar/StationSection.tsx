import { ChevronDown, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Station = {
  id: string;
  name: string;
  municipality?: string;
  county?: string;
  lat?: number | null;
  lon?: number | null;
};

type Props = {
  stations: Station[];
  selectedStationId: string;
  setSelectedStationId: (id: string) => void;

  search: string;
  setSearch: (v: string) => void;

  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;

  favoriteStationIds?: string[];
  toggleFavoriteStation?: (id: string) => void;

  error?: string;
};

export default function StationSection({
  stations,
  selectedStationId,
  setSelectedStationId,
  search,
  setSearch,
  dropdownOpen,
  setDropdownOpen,
  favoriteStationIds = [],
  toggleFavoriteStation,
  error,
}: Props) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedStation = stations.find((s) => s.id === selectedStationId);

  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const favoriteSet = useMemo(
    () => new Set(favoriteStationIds),
    [favoriteStationIds]
  );

  const filteredStations = useMemo(() => {
    return stations
      .filter((s) =>
        `${s.name} ${s.municipality ?? ""} ${s.county ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .filter((s) => (showOnlyFavorites ? favoriteSet.has(s.id) : true));
  }, [stations, search, showOnlyFavorites, favoriteSet]);

  const hasError = !!error && !selectedStationId;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!dropdownOpen) return;

      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target)) {
        setDropdownOpen(false);
      }
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [dropdownOpen, setDropdownOpen]);

  return (
    <section className="relative z-[80]">
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Værstasjon
      </label>

      <div ref={dropdownRef} className="relative z-[80]">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={
            selectedStation
              ? `${selectedStation.name}${
                  selectedStation.municipality
                    ? ` (${selectedStation.municipality})`
                    : ""
                }`
              : "Søk..."
          }
          className={`h-12 w-full rounded-[22px] border bg-white px-5 pr-12 text-base text-slate-900 outline-none focus:ring-4 dark:bg-slate-900 dark:text-slate-100 ${
            hasError
              ? "border-red-400 focus:border-red-400 focus:ring-red-100"
              : "border-slate-200 focus:border-slate-300 focus:ring-slate-200"
          }`}
        />

        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200"
          aria-label="Åpne nedtrekksliste for værstasjon"
        >
          <ChevronDown
            size={20}
            strokeWidth={2.2}
            className={`transition-transform ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowOnlyFavorites((v) => !v)}
              className={`flex w-full items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700 ${
                showOnlyFavorites
                  ? "text-yellow-500"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <Star
                size={16}
                fill={showOnlyFavorites ? "currentColor" : "none"}
              />
              {showOnlyFavorites
                ? "Viser kun favoritter"
                : "Vis kun favoritter"}
            </button>

            {filteredStations.length > 0 ? (
              filteredStations.map((station) => {
                const isFavorite = favoriteSet.has(station.id);

                return (
                  <div
                    key={station.id}
                    className={`flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      selectedStationId === station.id
                        ? "bg-slate-100 dark:bg-slate-800"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStationId(station.id);
                        setSearch("");
                        setDropdownOpen(false);
                      }}
                      className="flex-1 px-4 py-2 text-left text-sm dark:text-slate-100"
                    >
                      {station.name}
                      {station.municipality &&
                        ` (${station.municipality})`}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteStation?.(station.id);
                      }}
                      className={`mr-3 ${
                        isFavorite ? "text-yellow-500" : "text-slate-400"
                      }`}
                      aria-label={
                        isFavorite
                          ? "Fjern værstasjon fra favoritter"
                          : "Legg værstasjon til favoritter"
                      }
                    >
                      <Star
                        size={16}
                        fill={isFavorite ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                Ingen stasjoner funnet
              </div>
            )}
          </div>
        )}
      </div>

      {hasError && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </section>
  );
}