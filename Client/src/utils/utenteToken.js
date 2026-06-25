// Ofuscação reversível do id do utente na URL (apenas para dissuadir curiosos; NÃO é segurança).
// Cifra de Feistel de 32 bits (bijeção): 1 → 3847291043, etc., e o inverso.
const KEY = [0x9e3779b1, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f];
const ROUNDS = 4;

const F = (half, k) => {
    let x = (half ^ k) >>> 0;
    x = Math.imul(x, 0x45d9f3b) >>> 0;
    x = ((x >>> 16) ^ x) >>> 0;
    return x & 0xffff;
};

export function tokenDoUtente(id) {
    let L = (id >>> 16) & 0xffff, R = id & 0xffff;
    for (let i = 0; i < ROUNDS; i++) { const t = (L ^ F(R, KEY[i])) & 0xffff; L = R; R = t; }
    return String((((L << 16) | R) >>> 0));
}

export function idDoToken(token) {
    const n = Number(token);
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return NaN;
    let L = (n >>> 16) & 0xffff, R = n & 0xffff;
    for (let i = ROUNDS - 1; i >= 0; i--) { const t = (R ^ F(L, KEY[i])) & 0xffff; R = L; L = t; }
    return (((L << 16) | R) >>> 0);
}
