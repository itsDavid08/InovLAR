// Base e helpers partilhados das chamadas à API.
// A base pode ser definida por VITE_API_URL (tem de terminar em "/"); por omissão
// é o host atual na porta 3000 (mesma origem em produção, :3000 em dev/Vite).
export const apiUrl =
    import.meta.env.VITE_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:3000/`;

// GET simples — devolve o JSON; lança se a resposta não for 2xx (contrato igual
// ao do `mutate`). Quem chama trata o erro (try/catch ou .catch).
//  - `auth: true` envia o cookie de sessão (leituras só-staff: roster, agregados de pedidos,
//    layouts, templates). Os endpoints abertos (tabuleiro do utente) ficam sem credenciais.
export async function get(path, { auth = false } = {}) {
    const res = await fetch(apiUrl + path, auth ? { credentials: "include" } : {});
    if (!res.ok) throw new Error(`GET ${path} falhou (${res.status})`);
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
