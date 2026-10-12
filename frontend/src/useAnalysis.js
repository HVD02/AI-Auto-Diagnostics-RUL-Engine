import { useEffect, useState } from "react";
import { analyzeDemo, getCurrentUpload } from "./api";
import { useVehicle } from "./VehicleContext.jsx";

export function useAnalysis() {
  const { vehicleId, dataSource } = useVehicle();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isUpload = dataSource?.mode === "upload";

  useEffect(() => {
    if (isUpload) {
      // already fetched at upload time / on session restore; re-fetch once
      // to make sure it's current if the tab was reopened.
      setLoading(true);
      setError(null);
      getCurrentUpload()
        .then(d => setData(d))
        .catch(e => setError(e?.response?.data?.detail || e.message))
        .finally(() => setLoading(false));
      return;
    }
    if (!vehicleId) return;
    setLoading(true);
    setError(null);
    analyzeDemo(vehicleId)
      .then(d => setData(d))
      .catch(e => setError(e?.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  }, [vehicleId, isUpload, dataSource?.filename]);

  return { data, loading, error, vehicleId: isUpload ? (dataSource?.filename || "Uploaded vehicle") : vehicleId, isUpload };
}
