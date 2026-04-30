import { useState } from "react";

export const defaultFormState = {
  projectName: "",
  area: "",
  returnPeriod: "5",
  climateFactor: "1.4",
  maxDischarge: "0.0",
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
