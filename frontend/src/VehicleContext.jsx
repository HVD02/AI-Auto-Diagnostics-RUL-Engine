import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getDemoVehicles, uploadTelemetry, getCurrentUpload } from "./api";

const VehicleCtx = createContext(null);

export function VehicleProvider({ children }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleIdState] = useState(null);

  // dataSource: { mode: "demo" } | { mode: "upload", filename, analysis }
  const [dataSource, setDataSource] = useState({ mode: "demo" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    getDemoVehicles().then(d => {
      setVehicles(d.vehicles || []);
      if (d.vehicles && d.vehicles.length) setVehicleIdState(d.vehicles[0]);
    }).catch(() => {});

    // if the backend already has an upload from earlier this session
    // (e.g. navigated away and back), pick it back up automatically.
    getCurrentUpload().then(d => {
      setDataSource({ mode: "upload", filename: d.filename, analysis: d });
    }).catch(() => {});
  }, []);

  const setVehicleId = useCallback((id) => {
    setVehicleIdState(id);
    setDataSource({ mode: "demo" });
  }, []);

  const doUpload = useCallback((file) => {
    setUploading(true);
    setUploadError(null);
    return uploadTelemetry(file)
      .then(d => {
        if (!d.valid) {
          setUploadError(d);
          return d;
        }
        setDataSource({ mode: "upload", filename: d.filename, analysis: d });
        return d;
      })
      .catch(e => {
        setUploadError({ valid: false, message: e?.response?.data?.detail || e.message });
        throw e;
      })
      .finally(() => setUploading(false));
  }, []);

  const useUploadedAsActive = useCallback(() => {
    if (dataSource.mode === "upload") return;
    getCurrentUpload().then(d => setDataSource({ mode: "upload", filename: d.filename, analysis: d })).catch(() => {});
  }, [dataSource.mode]);

  const activeLabel = dataSource.mode === "upload" ? dataSource.filename : vehicleId;

  return (
    <VehicleCtx.Provider value={{
      vehicles, vehicleId, setVehicleId,
      dataSource, doUpload, uploading, uploadError, setUploadError,
      useUploadedAsActive, activeLabel,
    }}>
      {children}
    </VehicleCtx.Provider>
  );
}

export function useVehicle() {
  return useContext(VehicleCtx);
}
