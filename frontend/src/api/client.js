const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function buildUrl(path) {
    if (!path.startsWith("/")) path = "/" + path;
    return BASE_URL + path;
}

export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = "ApiError"
        this.status = status;
        this.data = data;
    }
}

export async function apiFetch(path, { method = "GET", token, body, headers } = {}) {
    const url = buildUrl(patch);

    const res = await fetch(url, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers || {}),

        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // JSON dönmeyen hatalarda da patlamasın
    let data = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        data = await res.json();
    } else {
        const text = await res.text()
        data = text ? { message: text } : null;
    }

    if (!res.ok) {
        const msg = (data && (data.message || data.error)) ||
            `Request failed (${res.status})`;
        throw new ApiError(msg, res.status, data);
    }
    return data;

}