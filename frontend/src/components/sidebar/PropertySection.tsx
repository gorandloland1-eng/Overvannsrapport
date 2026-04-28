import { useRef, useEffect, useState } from "react";

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
  matrikkel: {
    gnr: number;
    bnr: number;
    kommunenummer: string;
  } | null;
  error: string;
  propertyLoading: boolean;
};

type Step = "knr" | "gnr" | "bnr" | "done";

function getStep(
  municipalityNumber: string,
  cadastralNumber: string,
  propertyNumber: string
): Step {
  if (!municipalityNumber) return "knr";
  if (!cadastralNumber) return "gnr";
  if (!propertyNumber) return "bnr";
  return "done";
}

const STEP_META: Record<Step, { placeholder: string; label: string; maxLength?: number; type?: string }> = {
  knr: { placeholder: "Kommunenummer (4 siffer)", label: "Kommunenr.", maxLength: 4 },
  gnr: { placeholder: "Gårdsnummer", label: "Gårdsnr.", type: "number" },
  bnr: { placeholder: "Bruksnummer", label: "Bruksnr.", type: "number" },
  done: { placeholder: "", label: "" },
};

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
}: Props) {
  const step = getStep(municipalityNumber, cadastralNumber, propertyNumber);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  // Clear local input when step advances
  useEffect(() => {
    setInputValue("");
    if (step !== "done") {
      inputRef.current?.focus();
    }
  }, [step]);

  const confirm = (value: string) => {
    if (!value.trim()) return;
    if (step === "knr") setMunicipalityNumber(value.trim());
    else if (step === "gnr") setCadastralNumber(value.trim());
    else if (step === "bnr") {
      setPropertyNumber(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      confirm(inputValue);
    }
  };

  const handleReset = () => {
    setMunicipalityNumber("");
    setCadastralNumber("");
    setPropertyNumber("");
  };

  const chips = [
    { id: "knr", value: municipalityNumber, label: "Knr" },
    { id: "gnr", value: cadastralNumber, label: "Gnr" },
    { id: "bnr", value: propertyNumber, label: "Bnr" },
  ];

  const meta = STEP_META[step];

  return (
    <section>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Property ID
      </label>

      {/* Guided single input */}
      {step !== "done" && (
        <div className="relative">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={meta.placeholder}
            maxLength={meta.maxLength}
            type={meta.type ?? "text"}
            autoFocus
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-24 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={() => confirm(inputValue)}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Neste →
            </button>
          )}
        </div>
      )}

      {/* Chips row */}
      <div className="mt-2 flex items-center gap-2">
        {chips.map((chip) => (
          <div
            key={chip.id}
            className={[
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
              chip.value
                ? "border-[#213F53] bg-[#213F53]/10 text-[#213F53] dark:border-[#4a90b8] dark:bg-[#213F53]/20 dark:text-[#4a90b8]"
                : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500",
            ].join(" ")}
          >
            <span className="opacity-60">{chip.label}:</span>
            <span>{chip.value || "—"}</span>
          </div>
        ))}

        {/* Reset button — only shown once at least one chip is filled */}
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

      {/* Lookup button — only when all three are filled */}
      {step === "done" && (
        <button
          type="button"
          onClick={onLookup}
          disabled={loading}
          className="h-9 w-full rounded-xl bg-[#213F53] text-sm font-medium text-white transition hover:bg-[#1a3244] disabled:opacity-50"
        >
          {loading ? "Looking up..." : "Look up property"}
        </button>
      )}

      {/* Results */}
      {(address || matrikkel) && !propertyLoading && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
            Nearest address
          </div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {address ?? "No address found"}
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
        <p className="mt-2 text-xs text-slate-400">Fetching property data...</p>
      )}

      {error && !propertyLoading && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{error}</p>
      )}
    </section>
  );
}