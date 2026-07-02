// Chamadas à API de autenticação do staff.
// IMPORTANTE: todas usam `credentials: "include"` para o cookie de sessão viajar.
import { apiUrl } from "./client";

async function post(path, body) {
    const res = await fetch(apiUrl + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
}

// Estado atual: { configurado: bool, autenticado: bool }
export async function staffStatus() {
    try {
        const res = await fetch(apiUrl + "auth/staff/status", {
            credentials: "include",
        });
        return await res.json();
    } catch {
        return { configurado: false, autenticado: false };
    }
}

export const staffSetup = (password) => post("auth/staff/setup", { password });
export const staffLogin = (password) => post("auth/staff/login", { password });
export const staffChange = (currentPassword, newPassword) =>
    post("auth/staff/change", { currentPassword, newPassword });
export const staffLogout = () => post("auth/staff/logout");
