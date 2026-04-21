import { useState } from "react";

type LatLng = { lat: number; lng: number };

interface Matrikkel {
  gnr: number;
  bnr: number;
  kommunenummer: string;
}

export function usePropertyState() {
  const [propertyBoundary, setPropertyBoundary] = useState<object | null>(null);
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null);
  const [propertyMatrikkel, setPropertyMatrikkel] = useState<Matrikkel | null>(null);
  const [clickedCoord, setClickedCoord] = useState<LatLng | null>(null);
  const [mouseCoord, setMouseCoord] = useState<LatLng | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertyError, setPropertyError] = useState("");
  const [municipalityNumber, setMunicipalityNumber] = useState("");
  const [cadastralNumber, setCadastralNumber] = useState("");
  const [propertyNumber, setPropertyNumber] = useState("");
  const [matrikkelLoading, setMatrikkelLoading] = useState(false);

  function resetProperty() {
    setPropertyBoundary(null);
    setPropertyAddress(null);
    setPropertyMatrikkel(null);
    setClickedCoord(null);
    setPropertyError("");
    setMunicipalityNumber("");
    setCadastralNumber("");
    setPropertyNumber("");
  }

  return {
    propertyBoundary, setPropertyBoundary,
    propertyAddress, setPropertyAddress,
    propertyMatrikkel, setPropertyMatrikkel,
    clickedCoord, setClickedCoord,
    mouseCoord, setMouseCoord,
    propertyLoading, setPropertyLoading,
    propertyError, setPropertyError,
    municipalityNumber, setMunicipalityNumber,
    cadastralNumber, setCadastralNumber,
    propertyNumber, setPropertyNumber,
    matrikkelLoading, setMatrikkelLoading,
    resetProperty,
  };
}