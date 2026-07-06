import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI, patientAPI, reportAPI, normalizePatient, normalizeReport } from "../utils/api";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("emr_user")) || null; } catch { return null; }
  });
  const [patients, setPatients]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [backendOk, setBackendOk] = useState(null);

  // Backend health check
  useEffect(() => {
    const base = window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : (process.env.REACT_APP_API_URL || "http://localhost:8000");
    fetch(base + "/health")
      .then(r => r.ok ? setBackendOk(true) : setBackendOk(false))
      .catch(() => setBackendOk(false));
  }, []);

  // Load patients on login
  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await patientAPI.list();
      setPatients(data.map(normalizePatient));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && backendOk) loadPatients();
  }, [user, backendOk, loadPatients]);

  // AUTH
  const login = async (username, password) => {
    try {
      const res = await authAPI.login(username, password);
      const u = { role: res.role, username: res.username };
      setUser(u);
      localStorage.setItem("emr_user", JSON.stringify(u));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const logout = () => {
    setUser(null);
    setPatients([]);
    localStorage.removeItem("emr_user");
    sessionStorage.clear();
  };

  const changePassword = async (role, newPassword, editorRole) => {
    return await authAPI.changePassword(role, newPassword, editorRole || user?.role);
  };

  // PATIENTS
  const addPatient = async (data) => {
    const created = await patientAPI.create(data);
    const normalized = normalizePatient(created);
    setPatients(prev => [normalized, ...prev]);
    return normalized.id;
  };

  const deletePatient = async (id) => {
    await patientAPI.delete(id);
    setPatients(prev => prev.filter(p => p.id !== id));
  };

  const updatePatient = async (id, data) => {
    const updated = await patientAPI.update(id, data);
    const normalized = normalizePatient(updated);
    setPatients(prev => prev.map(p => p.id === id ? normalized : p));
  };

  const refreshPatient = async (id) => {
    const fresh = await patientAPI.get(id);
    const normalized = normalizePatient(fresh);
    setPatients(prev => prev.map(p => p.id === id ? normalized : p));
    return normalized;
  };

  const searchPatients = async (query) => {
    const data = await patientAPI.list(query);
    return data.map(normalizePatient);
  };

  // REPORTS
  const addReport = async (patientId, { file, type, lab, labId, date, time, patientSex }) => {
    const formData = new FormData();
    formData.append("patient_id",  patientId);
    formData.append("report_type", type);
    formData.append("lab",         lab || "");
    formData.append("lab_id",      labId || "");
    formData.append("date",        date || "");
    formData.append("time",        time || "");
    formData.append("patient_sex", patientSex || "Female");
    formData.append("file",        file);

    const result = await reportAPI.upload(formData);
    const normalized = normalizeReport(result);

    setPatients(prev => prev.map(p => {
      if (p.id !== patientId) return p;
      return { ...p, reports: [...p.reports, normalized] };
    }));

    return {
      report:           normalized,
      extractionError:  result.extraction_error,
      extractionNote:   result.extraction_note,
      extractionMethod: result.extraction_method,
    };
  };

  const editReport = async (patientId, reportId, updatedValues, editorRole) => {
    const backendValues = updatedValues.map(v => ({
      name:       v.name,
      value:      typeof v.value === "number" ? v.value : (isNaN(parseFloat(v.value)) ? null : parseFloat(v.value)),
      value_text: String(v.value ?? v.valueText ?? ""),
      unit:       v.unit,
      ref_min:    v.refMin,
      ref_max:    v.refMax,
      status:     v.status || "Needs Review",
      abnormal:   v.abnormal,
    }));

    const updated = await reportAPI.edit(reportId, backendValues, editorRole);
    const normalized = normalizeReport(updated);

    setPatients(prev => prev.map(p => {
      if (p.id !== patientId) return p;
      return { ...p, reports: p.reports.map(r => r.id === reportId ? normalized : r) };
    }));
    return normalized;
  };

  const deleteReport = async (patientId, reportId) => {
    await reportAPI.delete(reportId);
    setPatients(prev => prev.map(p => {
      if (p.id !== patientId) return p;
      return { ...p, reports: p.reports.filter(r => r.id !== reportId) };
    }));
  };

  const getPdfUrl = (reportId) => {
    const patient = patients.find(p => p.reports?.some(r => r.id === reportId));
    const report = patient?.reports?.find(r => r.id === reportId);
    if (report?.storageUrl) return report.storageUrl;
    return reportAPI.pdfUrl(reportId);
  };

  return (
    <AppContext.Provider value={{
      user, login, logout,
      patients, loading, error, backendOk,
      loadPatients, searchPatients, refreshPatient,
      addPatient, deletePatient, updatePatient,
      addReport, editReport, deleteReport,
      changePassword,
      getPdfUrl,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
