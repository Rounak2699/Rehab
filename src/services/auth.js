import { api } from "./api.js";

export function login(role, id, password) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ role, id, password }),
  });
}
