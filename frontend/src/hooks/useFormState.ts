import { useState } from "react";

export const defaultFormState = {
  projectName: "",
  area: "",
  returnPeriod: "5",
  climateFactor: "1.4",
  maxDischarge: "0.0",
  runoffCoefficient: "",
  runoffAfterCoefficient: "",
  runoffAfterDischarge: "",
  runoffAdditionalDischarge: "",
  runoffInputs: {
    before: {
      roof: "",
      asphalt: "",
      paving: "",
      gravel: "",
      green: "",
    },
    after: {
      roof: "",
      asphalt: "",
      paving: "",
      gravel: "",
      green: "",
    },
    coefficients: {
      roof: "0.95",
      asphalt: "0.85",
      paving: "0.6",
      gravel: "0.4",
      green: "0.15",
    },
  },
  infiltrationMethod: "direct" as "direct" | "soiltype",
  selectedSoilType: "",
  bottomArea: "",
  sideArea: "",
  manualQInf: "",
  pdfError: "",
};

export type FormState = typeof defaultFormState;

export function useFormState() {
  const [form, setForm] = useState<FormState>(defaultFormState);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(defaultFormState);
  }

  return { form, setField, resetForm };
}
