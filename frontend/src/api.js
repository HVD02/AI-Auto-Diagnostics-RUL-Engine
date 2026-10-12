import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export const getHealth = () => api.get("/health").then(r => r.data);
export const getModelMetrics = () => api.get("/model-metrics").then(r => r.data);
export const getDropdownOptions = () => api.get("/dropdown-options").then(r => r.data);

export const getDemoVehicles = () => api.get("/vehicles/demo").then(r => r.data);
export const analyzeDemo = (vehicle_id) => api.post("/analyze/demo", { vehicle_id }).then(r => r.data);
export const getTelemetry = (vehicle_id) => api.get(`/telemetry/${vehicle_id}`).then(r => r.data);

export const diagnoseSample = (seed) => api.get("/diagnose/sample", { params: seed ? { seed } : {} }).then(r => r.data);
export const diagnose = (features) => api.post("/diagnose", { features }).then(r => r.data);
export const whatIfDiagnosis = (base_features, changed_features) =>
  api.post("/whatif/diagnosis", { base_features, changed_features }).then(r => r.data);
export const whatIfDemo = (vehicle_id, sensor, delta) =>
  api.post("/whatif/demo", null, { params: { vehicle_id, sensor, delta } }).then(r => r.data);

export const getRulUnits = () => api.get("/rul/units").then(r => r.data);
export const getRul = (unit_id, up_to_cycle) => api.post("/rul", { unit_id, up_to_cycle }).then(r => r.data);

export const uploadTelemetry = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/upload/telemetry", form, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
};
export const getCurrentUpload = () => api.get("/upload/current").then(r => r.data);
export const getCurrentUploadTelemetry = () => api.get("/telemetry/upload/current").then(r => r.data);
export const whatIfUpload = (sensor, delta) =>
  api.post("/whatif/upload", null, { params: { sensor, delta } }).then(r => r.data);

export const getHistory = (vehicle_id, limit = 50) =>
  api.get("/history", { params: { vehicle_id, limit } }).then(r => r.data);

export const createReport = (vehicle_id) => api.post(`/report/${vehicle_id}`).then(r => r.data);
export const getReports = (vehicle_id) => api.get("/reports", { params: { vehicle_id } }).then(r => r.data);
export const reportDownloadUrl = (filename) => `/api/report/download/${filename}`;

export const maintenanceSearch = (q) => api.get("/maintenance/search", { params: { q } }).then(r => r.data);

export default api;
