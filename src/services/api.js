import { Capacitor } from "@capacitor/core";

const IS_NATIVE = Capacitor.isNativePlatform();
const API_URL_KEY = "rehabrep-api-url";
const TOKEN_KEY = "rehabrep-token";

export function getApiUrl() {
  return IS_NATIVE
    ? localStorage.getItem(API_URL_KEY) || import.meta.env.VITE_API_URL || ""
    : import.meta.env.VITE_API_URL || "/api";
}

export function saveApiUrl(value) {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:") {
    throw new Error("The Android app requires a secure HTTPS API URL.");
  }
  localStorage.setItem(API_URL_KEY, parsed.toString().replace(/\/+$/, ""));
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const apiUrl = getApiUrl();
  if (IS_NATIVE && !apiUrl) {
    throw new Error("Enter your ReHabRep HTTPS API URL to connect this app to your server.");
  }
  if (IS_NATIVE && new URL(apiUrl).protocol !== "https:") {
    throw new Error("The Android app requires a secure HTTPS API URL.");
  }

  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });
  if (response.status === 204) return null;

  const body = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => item.msg).join("; ")
      : body.detail;
    throw new Error(detail || "The request could not be completed.");
  }
  return body;
}
