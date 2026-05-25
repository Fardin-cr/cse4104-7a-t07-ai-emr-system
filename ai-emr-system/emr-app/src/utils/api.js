// API Base URL
const BASE = process.env.REACT_APP_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "http://localhost:8000");

async function api(method, path, body = null, isFormData = false) {
  const opts = {
    method,
    headers: isFormData ? {} : { "Content-Type": "application/json" },
    body: body ? (isFormData ? body : JSON.stringify(body)) : null,
    redirect: "follow",
  };
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map(e => e.msg || JSON.stringify(e)).join("; ")
      : err.detail || "Request failed";
    throw new Error(detail);
  }
  return res.json();
}

// AUTH
export const authAPI = {
  login:          (username, password)              => api("POST", "/auth/login",           { username, password }),
  changePassword: (role, new_password, editor_role) => api("POST", "/auth/change-password", { role, new_password, editor_role }),
  getCredentials: ()                                => api("GET",  "/auth/credentials"),
  getAuditLog:    (limit = 100)                     => api("GET",  `/auth/audit-log?limit=${limit}`),
};

// PATIENTS
export const patientAPI = {
  list:   (search = "") => api("GET",    `/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  get:    (id)          => api("GET",    `/patients/${id}`),
  create: (data)        => api("POST",   "/patients", data),
  update: (id, data)    => api("PUT",    `/patients/${id}`, data),
  delete: (id)          => api("DELETE", `/patients/${id}`),
};

// REPORTS
export const reportAPI = {
  upload: (formData)               => api("POST",   "/reports/upload",       formData, true),
  get:    (id)                     => api("GET",    `/reports/${id}`),
  edit:   (id, values, editorRole) => api("PUT",    `/reports/${id}/values`, { values, editor_role: editorRole }),
  delete: (id)                     => api("DELETE", `/reports/${id}`),
  pdfUrl: (id)                     => `${BASE}/reports/${id}/pdf`,
};

// NORMALIZERS
export function normalizeReport(r) {
  return {
    id:         r.id,
    type:       r.type,
    date:       r.date,
    time:       r.time || "",
    lab:        r.lab || "",
    labId:      r.lab_id || "",
    pdfName:    r.pdf_name || "",
    storageUrl: r.storage_url || "",
    createdAt:  r.created_at || r.date,
    editedBy:   r.edited_by || null,
    editedAt:   r.edited_at || null,
    values: (r.values || []).map(v => ({
      name:      v.name,
      value:     v.value ?? (parseFloat(v.value_text) || null),
      valueText: v.value_text || String(v.value ?? ""),
      unit:      v.unit || "",
      refMin:    v.ref_min ?? 0,
      refMax:    v.ref_max ?? 0,
      status:    v.status || (v.abnormal ? "Abnormal" : "Normal"),
      abnormal:  Boolean(v.abnormal),
    })),
  };
}

export function normalizePatient(p) {
  return {
    id:                p.id,
    name:              p.name,
    age:               p.age,
    sex:               p.sex,
    blood:             p.blood,
    phone:             p.phone,
    address:           p.address,
    doctor:            p.doctor,
    emergency_contact: p.emergency_contact,
    notes:             p.notes,
    registered:        p.registered,
    reports:           (p.reports || []).map(normalizeReport),
  };
}
