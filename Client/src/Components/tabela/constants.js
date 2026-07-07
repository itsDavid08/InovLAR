export const DISPOSITIVOS = {
    smartphone: { label: "Telemóvel", icon: "smartphone", colsDefault: 4, colsMin: 2, colsMax: 8,  maxW: 640,  aspect: "16 / 9" },
    tablet:     { label: "Tablet",    icon: "tablet",     colsDefault: 5, colsMin: 2, colsMax: 10, maxW: 760,  aspect: "4 / 3" },
    pc:         { label: "PC",        icon: "computer",   colsDefault: 6, colsMin: 2, colsMax: 14, maxW: 1000, aspect: "16 / 10" },
};

// Tamanho do tile: altura mínima, tamanho do ícone e do texto.
export const TAMANHOS = {
    P: { min: 80,  icon: 28, txt: 11 },
    M: { min: 112, icon: 40, txt: 13 },
    G: { min: 140, icon: 52, txt: 15 },
};

export const COL_OPCOES = [2, 3, 4, 5, 6];

// escala do ícone/texto consoante a densidade (menos colunas = botões maiores)
export const escalaPorColunas = (cols) => (cols <= 4 ? "G" : cols <= 6 ? "M" : "P");

// Cor por categoria — só decorativa (ponto no agrupamento da biblioteca).
export const COR_CATEGORIA = {
    "Sinto-me": "#F9A825",
    "Necessidades": "#63597c",
    "Tecnologias": "#2E9BD6",
    "Chamar": "#F0A33E",
    "Medicamentos": "#BA1A1A",
};

// Cor de fundo por categoria (pastel) — pinta o próprio botão no quadro. Default
// usado quando o staff não escolheu um override em `config.coresCategoria`.
export const COR_CATEGORIA_FUNDO = {
    "Sinto-me": "#FDE7C8",
    "Necessidades": "#E6E1F0",
    "Tecnologias": "#D6EBF9",
    "Chamar": "#FBE4C6",
    "Medicamentos": "#F6D3D3",
};

// Override do staff > default pastel > sem cor (nunca inventa cor para categorias
// desconhecidas).
export const resolverCorCategoria = (categoria, overrides) =>
    overrides?.[categoria] ?? COR_CATEGORIA_FUNDO[categoria] ?? null;

// Matriz de categorias do quadro (índice = r*cols+c), para a ilusão de fusão visual
// entre células vizinhas da mesma categoria. SOS nunca entra — mantém-se sempre uma
// "ilha" isolada, com os 4 cantos arredondados.
export const matrizCategorias = (cells, cols, rows, botaoPorId) =>
    Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
            const b = botaoPorId[cells[r * cols + c]];
            if (!b || b.categoria === "SOS" || b.nome === "SOS") return null;
            return b.categoria;
        }));

// Raio de canto que dá a ilusão de fusão: só os cantos exteriores ao grupo da mesma
// categoria arredondam; os cantos partilhados com um vizinho da mesma categoria ficam
// quadrados. Sem categoria (célula vazia/SOS) → 4 cantos arredondados, como sempre.
export const raioFusao = (grid, r, c, raio = "1rem") => {
    const cat = grid[r]?.[c];
    if (!cat) return { borderRadius: raio };
    const same = (rr, cc) => grid[rr]?.[cc] === cat;
    const up = same(r - 1, c), down = same(r + 1, c), left = same(r, c - 1), right = same(r, c + 1);
    return {
        borderTopLeftRadius: up || left ? 0 : raio,
        borderTopRightRadius: up || right ? 0 : raio,
        borderBottomLeftRadius: down || left ? 0 : raio,
        borderBottomRightRadius: down || right ? 0 : raio,
    };
};
