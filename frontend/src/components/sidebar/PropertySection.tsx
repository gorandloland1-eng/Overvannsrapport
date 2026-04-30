import { useRef, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AddressSearchResult } from "../../api/property";

type Props = {
  municipalityNumber: string;
  cadastralNumber: string;
  propertyNumber: string;
  setMunicipalityNumber: (v: string) => void;
  setCadastralNumber: (v: string) => void;
  setPropertyNumber: (v: string) => void;
  onLookup: () => void;
  loading: boolean;
  address: string | null;
  matrikkel: { gnr: number; bnr: number; kommunenummer: string } | null;
  error: string;
  propertyLoading: boolean;
  validationErrors?: {
    municipalityNumber?: string;
    cadastralNumber?: string;
    propertyNumber?: string;
  };

  lookupMode: "matrikkel" | "adresse";
  setLookupMode: (v: "matrikkel" | "adresse") => void;
  addressSearch: string;
  setAddressSearch: (v: string) => void;
  addressResults: AddressSearchResult[];
  addressLoading: boolean;
  addressDropdownOpen: boolean;
  setAddressDropdownOpen: (v: boolean) => void;
  onAddressSelect: (address: AddressSearchResult) => void;
};

type Step = "knr" | "gnr" | "bnr" | "done";

type StepMeta = {
  placeholder: string;
  label: string;
  maxLength?: number;
};

const STEP_META: Record<Step, StepMeta> = {
  knr: { placeholder: "Kommunenummer", label: "Kommunenr.", maxLength: 4 },
  gnr: { placeholder: "Gårdsnummer", label: "Gårdsnr." },
  bnr: { placeholder: "Bruksnummer", label: "Bruksnr." },
  done: { placeholder: "", label: "" },
};

function getStep(knr: string, gnr: string, bnr: string): Step {
  if (!knr) return "knr";
  if (!gnr) return "gnr";
  if (!bnr) return "bnr";
  return "done";
}

export default function PropertySection({
  municipalityNumber,
  cadastralNumber,
  propertyNumber,
  setMunicipalityNumber,
  setCadastralNumber,
  setPropertyNumber,
  onLookup,
  loading,
  address,
  matrikkel,
  error,
  propertyLoading,
  validationErrors = {},

  lookupMode,
  setLookupMode,
  addressSearch,
  setAddressSearch,
  addressResults,
  addressLoading,
  addressDropdownOpen,
  setAddressDropdownOpen,
  onAddressSelect,
}: Props) {
  const step = getStep(municipalityNumber, cadastralNumber, propertyNumber);
  const meta = STEP_META[step];
  const inputRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState("");

  const currentStepError =
    step === "knr"
      ? validationErrors.municipalityNumber
      : step === "gnr"
      ? validationErrors.cadastralNumber
      : step === "bnr"
      ? validationErrors.propertyNumber
      : undefined;

  const chips = [
    {
      id: "knr",
      value: municipalityNumber,
      label: "Knr",
      fieldError: validationErrors.municipalityNumber,
    },
    {
      id: "gnr",
      value: cadastralNumber,
      label: "Gnr",
      fieldError: validationErrors.cadastralNumber,
    },
    {
      id: "bnr",
      value: propertyNumber,
      label: "Bnr",
      fieldError: validationErrors.propertyNumber,
    },
  ];

  useEffect(() => {
    setInputValue("");
    if (lookupMode === "matrikkel" && step !== "done") {
      inputRef.current?.focus();
    }
  }, [step, lookupMode]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!addressDropdownOpen) return;

      const target = e.target as Node;
      if (!addressRef.current?.contains(target)) {
        setAddressDropdownOpen(false);
      }
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [addressDropdownOpen, setAddressDropdownOpen]);

  function handleInputChange(value: string) {
    setInputValue(value.replace(/\D/g, ""));
  }

  function confirm(value: string) {
    const v = value.trim();
    if (!v) return;

    if (step === "knr") setMunicipalityNumber(v);
    else if (step === "gnr") setCadastralNumber(v);
    else if (step === "bnr") setPropertyNumber(v);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && inputValue.trim()) {
      confirm(inputValue);
    }
  }

  function handleReset() {
    setMunicipalityNumber("");
    setCadastralNumber("");
    setPropertyNumber("");
  }

  return (
    <section className="relative z-[90]">
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Eiendoms-ID
      </label>

      <div className="mb-3 flex overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setLookupMode("matrikkel")}
          className={`flex-1 py-2 text-sm font-medium transition ${
            lookupMode === "matrikkel"
              ? "bg-[#213F53] text-white"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Eiendoms-ID
        </button>

        <button
          type="button"
          onClick={() => setLookupMode("adresse")}
          className={`flex-1 py-2 text-sm font-medium transition ${
            lookupMode === "adresse"
              ? "bg-[#213F53] text-white"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Adresse
        </button>
      </div>

      {lookupMode === "adresse" && (
        <div ref={addressRef} className="relative z-[90] mb-3">
          <input
            value={addressSearch}
            onChange={(e) => {
              setAddressSearch(e.target.value);
              setAddressDropdownOpen(true);
            }}
            onFocus={() => setAddressDropdownOpen(true)}
            placeholder="Søk etter adresse..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-slate-700"
          />

          <button
            type="button"
            onClick={() => setAddressDropdownOpen(!addressDropdownOpen)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200"
            aria-label="Åpne adresseforslag"
          >
            <ChevronDown
              size={18}
              strokeWidth={2.2}
              className={`transition-transform ${
                addressDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {addressDropdownOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {addressLoading && (
                <div className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                  Søker...
                </div>
              )}

              {!addressLoading && addressResults.length > 0 && (
                <>
                  {addressResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onAddressSelect(item)}
                      className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="font-medium">{item.adressetekst}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.kommunenavn ?? "Ukjent kommune"} · Knr{" "}
                        {item.kommunenummer} · Gnr {item.gardsnummer} · Bnr{" "}
                        {item.bruksnummer}
                      </div>
                    </button>
                  ))}
                </>
              )}

              {!addressLoading &&
                addressSearch.trim().length >= 2 &&
                addressResults.length === 0 && (
                  <div className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                    Ingen adresser funnet
                  </div>
                )}

              {!addressLoading && addressSearch.trim().length < 2 && (
                <div className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                  Skriv minst 2 tegn
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {lookupMode === "matrikkel" && (
        <>
          {step !== "done" && (
            <div className="relative mb-3">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={meta.placeholder}
                maxLength={meta.maxLength}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                className={`h-10 w-full rounded-xl border bg-white px-3 pr-10 text-sm outline-none focus:ring-4 dark:bg-slate-900 dark:text-slate-100 ${
                  currentStepError
                    ? "border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900/30"
                    : "border-slate-200 focus:border-slate-300 focus:ring-slate-200 dark:border-slate-700 dark:focus:ring-slate-700"
                }`}
              />

              {inputValue.trim() && (
                <button
                  type="button"
                  onClick={() => confirm(inputValue)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-slate-700 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                  aria-label="Neste felt"
                >
                  <ChevronRight size={18} strokeWidth={2.2} />
                </button>
              )}
            </div>
          )}

          <div className="mb-3 mt-2 flex items-center gap-2">
            {chips.map((chip) => (
              <div
                key={chip.id}
                className={[
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                  chip.fieldError && !chip.value
                    ? "border-red-400 bg-red-50 text-red-500 dark:border-red-500 dark:bg-red-900/20 dark:text-red-400"
                    : chip.value
                    ? "border-[#213F53] bg-[#213F53]/10 text-[#213F53] dark:border-[#4a90b8] dark:bg-[#213F53]/20 dark:text-[#4a90b8]"
                    : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500",
                ].join(" ")}
              >
                <span className="opacity-60">{chip.label}:</span>
                <span>{chip.value || "—"}</span>
              </div>
            ))}

            {(municipalityNumber || cadastralNumber || propertyNumber) && (
              <button
                type="button"
                onClick={handleReset}
                className="ml-auto rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              >
                Nullstill
              </button>
            )}
          </div>

          {currentStepError && (
            <p className="mb-2 text-xs text-red-500 dark:text-red-400">
              {currentStepError}
            </p>
          )}

          {step === "done" && (
            <button
              type="button"
              onClick={onLookup}
              disabled={loading}
              className="h-9 w-full rounded-xl bg-[#213F53] text-sm font-medium text-white transition hover:bg-[#1a3244] disabled:opacity-50"
            >
              {loading ? "Slår opp..." : "Slå opp eiendom"}
            </button>
          )}
        </>
      )}

      {(address || matrikkel) && !propertyLoading && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
            Nærmeste adresse
          </div>

          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {address ?? "Ingen adresse funnet"}
          </div>

          {matrikkel && (
            <div className="mt-2 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Knr:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {matrikkel.kommunenummer}
                </span>
              </span>
              <span>
                Gnr:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {matrikkel.gnr}
                </span>
              </span>
              <span>
                Bnr:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {matrikkel.bnr}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {propertyLoading && (
        <p className="mt-2 text-xs text-slate-400">Henter eiendomsdata...</p>
      )}

      {error && !propertyLoading && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}
    </section>
  );
}
