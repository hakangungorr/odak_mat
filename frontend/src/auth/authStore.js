import { apiFetch } from "../api/client";

const KEY = "odak_auth";

export function loadAuth() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : { token: null, user: null };

    } catch {
        return { token: null, user: null };
    }
}

export function saveAuth(auth) {
    localStorage.setItem(KEY, JSON.stringify(auth));
}
export function clearAuth() {
    localStorage.removeItem(KEY);
}

export async function login(email, password) {
    // backend endpointin: POST /api/auth/login
    const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
    });

    const token = data.token || data.acces_token;
    const user = data.user || data;

    if (!token) throw new Error("Login response token içermiyor");

    const auth = { token, user };
    saveAuth(auth);
    return auth;

}

export function logout() {
    clearAuth();
}