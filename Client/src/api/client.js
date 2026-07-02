// Base e helpers partilhados das chamadas à API.
// A base é a mesma origem em produção e :3000 em desenvolvimento (Vite).
export const apiUrl = `${window.location.protocol}//${window.location.hostname}:3000/`;

// GET simples — devolve o JSON. Não verifica o estado de propósito: espelha o
// comportamento original dos `fetch` de leitura do ContextProvider.
export async function get(path) {
    const res = await fetch(apiUrl + path);
    return res.json();
}

// Mutação (POST/PUT/DELETE). Espelha exatamente os `fetch` originais:
//  - `auth: true` envia o cookie de sessão (mutações exclusivas do staff);
//    os pedidos do utente ficam SEM credenciais, como antes.
//  - só envia o header Content-Type quando há corpo.
//  - lança com `errorMsg` (a mensagem original) quando `res.ok` é falso.
// Devolve a `Response` para quem precisar do JSON (ex.: criar/editar botão).
export async function mutate(path, { method, body, errorMsg, auth = false }) {
    const res = await fetch(apiUrl + path, {
        method,
        ...(auth ? { credentials: "include" } : {}),
        ...(body !== undefined
            ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
            : {}),
    });
    if (!res.ok) throw new Error(errorMsg);
    return res;
}
