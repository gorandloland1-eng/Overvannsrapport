import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, X } from "lucide-react";
import type { IvfResponse } from "../../api/ivf";

type SurfaceKey = "roof" | "asphalt" | "paving" | "gravel" | "green";

type SurfaceRow = {
  key: SurfaceKey;
  label: string;
  coefficient: number;
};

const SURFACES: SurfaceRow[] = [
  { key: "roof", label: "Tak (tette flater)", coefficient: 0.95 },
  { key: "asphalt", label: "Asfalt / betong", coefficient: 0.85 },
  { key: "paving", label: "Belegningsstein / heller", coefficient: 0.6 },
  { key: "gravel", label: "Grus / komprimert jord", coefficient: 0.4 },
  { key: "green", label: "Grøntareal / naturlig mark", coefficient: 0.15 },
];

type RunoffScenarioInputs = Record<SurfaceKey, string>;

type RunoffInputs = {
  before: RunoffScenarioInputs;
  after: RunoffScenarioInputs;
};

type Props = {
  form: any;
  setField: (field: string, value: any) => void;
  ivfData: IvfResponse | null;
  concentrationTime: number | null;
};

function numberValue(value: string | number | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getNearestDuration(ivfData: IvfResponse | null, concentrationTime: number | null) {
  if (!ivfData?.durations?.length) return null;

  const target = Math.max(3, numberValue(concentrationTime));
  return ivfData.durations.reduce((best, duration) =>
    Math.abs(duration - target) < Math.abs(best - target) ? duration : best
  );
}

function getInitialInputs(form: any): RunoffInputs {
  const saved = form.runoffInputs ?? {};
  const before = saved.before ?? saved;
  const after = saved.after ?? saved.before ?? saved;

  return {
    before: {
      roof: before.roof ?? "",
      asphalt: before.asphalt ?? "",
      paving: before.paving ?? "",
      gravel: before.gravel ?? "",
      green: before.green ?? "",
    },
    after: {
      roof: after.roof ?? "",
      asphalt: after.asphalt ?? "",
      paving: after.paving ?? "",
      gravel: after.gravel ?? "",
      green: after.green ?? "",
    },
  };
}

function calculateScenario(
  scenarioInputs: RunoffScenarioInputs,
  intensity: number,
  climateFactor: number
) {
  const totalArea = SURFACES.reduce(
    (sum, surface) => sum + numberValue(scenarioInputs[surface.key]),
    0
  );

  const weightedArea = SURFACES.reduce(
    (sum, surface) =>
      sum + numberValue(scenarioInputs[surface.key]) * surface.coefficient,
    0
  );

  const runoffCoefficient = totalArea > 0 ? weightedArea / totalArea : 0;
  const qDim = runoffCoefficient * intensity * (totalArea / 10000) * climateFactor;

  return {
    totalArea,
    weightedArea,
    runoffCoefficient,
    qDim,
  };
}

export default function RunoffCoefficientSection({
  form,
  setField,
  ivfData,
  concentrationTime,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputs, setInputs] = useState<RunoffInputs>(() => getInitialInputs(form));
  const [manualIntensity, setManualIntensity] = useState("");

  const nearestDuration = useMemo(
    () => getNearestDuration(ivfData, concentrationTime),
    [ivfData, concentrationTime]
  );

  const ivfIntensity = useMemo(() => {
    if (!ivfData || nearestDuration == null) return null;
    return ivfData.ls_ha[String(nearestDuration)]?.[String(form.returnPeriod)] ?? null;
  }, [ivfData, nearestDuration, form.returnPeriod]);

  useEffect(() => {
    if (!modalOpen) return;
    setInputs(getInitialInputs(form));
    setManualIntensity(ivfIntensity != null ? String(ivfIntensity) : "");
  }, [modalOpen, form, ivfIntensity]);

  useEffect(() => {
    if (!modalOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen]);

  const totals = useMemo(() => {
    const intensity = numberValue(manualIntensity);
    const climateFactor = numberValue(form.climateFactor || 1);
    const before = calculateScenario(inputs.before, intensity, climateFactor);
    const after = calculateScenario(inputs.after, intensity, climateFactor);
    const additionalDischarge = Math.max(0, after.qDim - before.qDim);

    return {
      intensity,
      climateFactor,
      before,
      after,
      additionalDischarge,
    };
  }, [inputs, manualIntensity, form.climateFactor]);

  function setInput(scenario: keyof RunoffInputs, key: SurfaceKey, value: string) {
    setInputs((prev) => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        [key]: value,
      },
    }));
  }

  function applyCalculation() {
    const maxDischarge = totals.before.qDim > 0 ? totals.before.qDim.toFixed(1) : "0.0";
    const runoffCoefficient =
      totals.before.runoffCoefficient > 0
        ? totals.before.runoffCoefficient.toFixed(3)
        : "";
    const runoffAfterCoefficient =
      totals.after.runoffCoefficient > 0
        ? totals.after.runoffCoefficient.toFixed(3)
        : "";

    setField("runoffInputs", inputs);
    setField("runoffCoefficient", runoffCoefficient);
    setField("runoffAfterCoefficient", runoffAfterCoefficient);
    setField("runoffAfterDischarge", totals.after.qDim > 0 ? totals.after.qDim.toFixed(1) : "0.0");
    setField("runoffAdditionalDischarge", totals.additionalDischarge.toFixed(1));
    setField("maxDischarge", maxDischarge);
    setModalOpen(false);
  }

  return (
    <section className="relative z-20">
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Maks avrenning
      </label>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex h-12 w-full items-center justify-between rounded-[22px] border border-slate-200 bg-white px-5 text-left text-base text-slate-900 outline-none transition hover:bg-slate-50 focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:ring-slate-700"
      >
        <span>{form.maxDischarge || "0.0"} l/s</span>
        <Calculator size={18} className="text-slate-500 dark:text-slate-400" />
      </button>

      {form.runoffCoefficient && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          φm før: {form.runoffCoefficient}
          {form.runoffAfterCoefficient ? ` / φm etter: ${form.runoffAfterCoefficient}` : ""}
        </div>
      )}

      {modalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/45 px-4 py-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Avrenningsberegning
                </h2>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Q = φm × i × A × klimafaktor
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Lukk avrenningsberegning"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_80px] bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <div className="px-3 py-2">Arealtype</div>
                  <div className="px-3 py-2">Før (m²)</div>
                  <div className="px-3 py-2">Etter (m²)</div>
                  <div className="px-3 py-2">φ</div>
                </div>

                {SURFACES.map((surface) => (
                  <div
                    key={surface.key}
                    className="grid grid-cols-[minmax(0,1fr)_110px_110px_80px] items-center border-t border-slate-200 dark:border-slate-700"
                  >
                    <div className="px-3 py-2 text-sm text-slate-800 dark:text-slate-100">
                      {surface.label}
                    </div>
                    <div className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={inputs.before[surface.key]}
                        onChange={(e) => setInput("before", surface.key, e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-700"
                      />
                    </div>
                    <div className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={inputs.after[surface.key]}
                        onChange={(e) => setInput("after", surface.key, e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-700"
                      />
                    </div>
                    <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                      {surface.coefficient}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    Nedbørintensitet [l/(s·ha)]
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={manualIntensity}
                    onChange={(e) => setManualIntensity(e.target.value)}
                    placeholder="Fra IVF-tabell"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-700"
                  />
                  {ivfIntensity != null && nearestDuration != null && (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      IVF: {nearestDuration} min / {form.returnPeriod} år
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Totalt areal før / etter</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {totals.before.totalArea.toFixed(1)} / {totals.after.totalArea.toFixed(1)} m²
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Redusert areal før / etter</div>
                  <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {totals.before.weightedArea.toFixed(1)} / {totals.after.weightedArea.toFixed(1)} m²
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    φm før / etter
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {totals.before.runoffCoefficient.toFixed(3)} / {totals.after.runoffCoefficient.toFixed(3)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Q før / etter
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {totals.before.qDim.toFixed(1)} / {totals.after.qDim.toFixed(1)} l/s
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Meravrenning
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {totals.additionalDischarge.toFixed(1)} l/s
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={applyCalculation}
                  className="rounded-xl bg-[#213F53] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a3344]"
                >
                  Bruk verdi
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
