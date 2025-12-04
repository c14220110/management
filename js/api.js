/**
 * API Helper Module
 * Handles all HTTP requests to the backend with authentication
 */

const api = {
  async _fetch(endpoint, method = "GET", body = null) {
    const token = localStorage.getItem("authToken");
    const options = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };
    if (body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, options);
    if (response.status === 401) {
      logout();
      return Promise.reject(new Error("Unauthorized"));
    }
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Terjadi kesalahan pada server.");
    return data;
  },
  get(endpoint) {
    return this._fetch(endpoint, "GET");
  },
  post(endpoint, body) {
    return this._fetch(endpoint, "POST", body);
  },
  put(endpoint, body) {
    return this._fetch(endpoint, "PUT", body);
  },
  delete(endpoint, body) {
    return this._fetch(endpoint, "DELETE", body);
  },
  async login(email, password) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    return response.json();
  },
};
