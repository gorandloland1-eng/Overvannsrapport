import { useState } from "react";

type LatLng = { lat: number; lng: number };

export function useTerrainState() {
  const [pointA, setPointA] = useState<LatLng | null>(null);
  const [pointB, setPointB] = useState<LatLng | null>(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [length, setLength] = useState<number | null>(null);
  const [concentrationTime, setConcentrationTime] = useState<number | null>(null);
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainError, setTerrainError] = useState("");

  function resetTerrain() {
    setPointA(null);
    setPointB(null);
    setElevation(null);
    setLength(null);
    setConcentrationTime(null);
    setTerrainError("");
  }

  return {
    pointA, setPointA,
    pointB, setPointB,
    elevation, setElevation,
    length, setLength,
    concentrationTime, setConcentrationTime,
    terrainLoading, setTerrainLoading,
    terrainError, setTerrainError,
    resetTerrain,
  };
}