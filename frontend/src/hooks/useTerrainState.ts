import { useState } from "react";

type LatLng = { lat: number; lng: number };

export function useTerrainState() {
  const [pointA, setPointA] = useState<LatLng | null>(null);
  const [pointB, setPointB] = useState<LatLng | null>(null);

  const [elev1, setElev1] = useState<number | null>(null);
  const [elev2, setElev2] = useState<number | null>(null);
  const [heightDifference, setHeightDifference] = useState<number | null>(null);

  const [length, setLength] = useState<number | null>(null);
  const [concentrationTime, setConcentrationTime] = useState<number | null>(null);

  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainError, setTerrainError] = useState("");

  function resetTerrain() {
    setPointA(null);
    setPointB(null);

    setElev1(null);
    setElev2(null);
    setHeightDifference(null);

    setLength(null);
    setConcentrationTime(null);

    setTerrainLoading(false);
    setTerrainError("");
  }

  return {
    pointA,
    setPointA,
    pointB,
    setPointB,

    elev1,
    setElev1,
    elev2,
    setElev2,
    heightDifference,
    setHeightDifference,

    length,
    setLength,
    concentrationTime,
    setConcentrationTime,

    terrainLoading,
    setTerrainLoading,
    terrainError,
    setTerrainError,
    resetTerrain,
  };
}