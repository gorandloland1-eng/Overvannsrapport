// @ts-nocheck
export default function StationSection({
  stationBoxRef,
  stationSearch,
  setStationSearch,
  stationDropdownOpen,
  setStationDropdownOpen,
  filteredStations,
  selectedStationId,
  setSelectedStationId,
  selectedStation,
}) {
  return (
    <section>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Weather station
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
              ? `${selectedStation.name}${selectedStation.municipality ? ` (${selectedStation.municipality})` : ""}`
              : "Search for weather station..."
          }
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-slate-700"
        />

        <button
          type="button"
          onClick={() => setStationDropdownOpen((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                  {station.name}
                  {station.municipality ? ` (${station.municipality})` : ""}
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
  );
}