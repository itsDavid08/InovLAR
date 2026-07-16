import { getSpan, footprint } from "./gridSpans";

export const DISPOSITIVOS = {
    smartphone: {
        label: "Telemóvel",
        icon: "smartphone",
        colsDefault: 3,
        colsMin: 2,
        colsMax: 8,
        maxW: 380,
        aspect: "9 / 16",
    },
    tablet: {
        label: "Tablet",
        icon: "tablet",
        colsDefault: 5,
        colsMin: 2,
        colsMax: 10,
        maxW: 620,
        aspect: "4 / 3",
    },
    pc: {
        label: "PC",
        icon: "computer",
        colsDefault: 6,
        colsMin: 2,
        colsMax: 14,
        maxW: 1000,
        aspect: "16 / 10",
    },
};

// Tamanho do tile: altura mínima, tamanho do ícone e do texto.
export const TAMANHOS = {
    P: { min: 80, icon: 28, txt: 11 },
    M: { min: 112, icon: 40, txt: 13 },
    G: { min: 140, icon: 52, txt: 15 },
};

export const COL_OPCOES = [2, 3, 4, 5, 6];

// SOS é especial em todo o lado (sem cor de categoria, sem fusão, estilo próprio).
// Regra única — antes estava copiada em 4 sítios.
export const isSOS = (botao) =>
    !!botao && (botao.categoria === "SOS" || botao.nome === "SOS");

// Config vazia de um dispositivo (estado inicial dos editores).
export const defaultConfig = (dispositivo) => ({
    cols: DISPOSITIVOS[dispositivo].colsDefault,
    size: "M",
    cells: [],
    spans: {},
    coresCategoria: {},
});

// True se a config tem pelo menos um botão colocado.
export const hasCells = (config) =>
    !!config && Array.isArray(config.cells) && config.cells.some((v) => v != null);

// Dispositivos de um mapa de configs { dispositivo: config } com layout preenchido.
export const devicesWithLayout = (configs) =>
    Object.keys(DISPOSITIVOS).filter((d) => hasCells(configs?.[d]));

// escala do ícone/texto consoante a densidade (menos colunas = botões maiores)
export const escalaPorColunas = (cols) =>
    cols <= 4 ? "G" : cols <= 6 ? "M" : "P";

// Cor por categoria — só decorativa (ponto no agrupamento da biblioteca).
export const COR_CATEGORIA = {
    "Sinto-me": "#F9A825",
    Necessidades: "#63597c",
    Tecnologias: "#2E9BD6",
    Chamar: "#F0A33E",
    Medicamentos: "#BA1A1A",
};

// Cor de fundo por categoria (pastel) — pinta o próprio botão no quadro. Default
// usado quando o staff não escolheu um override em `config.coresCategoria`.
export const COR_CATEGORIA_FUNDO = {
    "Sinto-me": "#FDE7C8",
    Necessidades: "#E6E1F0",
    Tecnologias: "#D6EBF9",
    Chamar: "#FBE4C6",
    Medicamentos: "#F6D3D3",
};

// Override do staff > default pastel > sem cor (nunca inventa cor para categorias
// desconhecidas).
export const resolverCorCategoria = (categoria, overrides) =>
    overrides?.[categoria] ?? COR_CATEGORIA_FUNDO[categoria] ?? null;

// Matriz de categorias do quadro (índice = r*cols+c), para a ilusão de fusão visual
// entre células vizinhas da mesma categoria. Preenche toda a pegada de um botão maior
// (não só a âncora), para a fusão funcionar em qualquer aresta dele. SOS nunca entra
// — mantém-se sempre uma "ilha" isolada, com os 4 cantos arredondados.
export const matrizCategorias = (cells, spans, cols, rows, botaoPorId) => {
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    cells.forEach((botaoId, pos) => {
        const b = botaoPorId[botaoId];
        if (!b || isSOS(b)) return;
        const { w, h } = getSpan(spans, pos);
        for (const p of footprint(pos, w, h, cols) || [pos]) {
            const r = Math.floor(p / cols),
                c = p % cols;
            if (r < rows) grid[r][c] = b.categoria;
        }
    });
    return grid;
};

// Raio de canto que dá a ilusão de fusão: só os cantos exteriores ao grupo da mesma
// categoria arredondam; os cantos partilhados com um vizinho da mesma categoria ficam
// quadrados. Sem categoria (célula vazia/SOS) → 4 cantos arredondados, como sempre.
// `w`/`h` (default 1x1) é a pegada do botão ancorado em (r,c) — os 4 cantos passam a
// ser os do retângulo inteiro, não os de uma única célula.
export const raioFusao = (grid, r, c, w = 1, h = 1, raio = "1rem") => {
    const cat = grid[r]?.[c];
    if (!cat) return { borderRadius: raio };
    const same = (rr, cc) => grid[rr]?.[cc] === cat;
    return {
        borderTopLeftRadius: same(r - 1, c) || same(r, c - 1) ? 0 : raio,
        borderTopRightRadius:
            same(r - 1, c + w - 1) || same(r, c + w) ? 0 : raio,
        borderBottomLeftRadius:
            same(r + h, c) || same(r + h - 1, c - 1) ? 0 : raio,
        borderBottomRightRadius:
            same(r + h, c + w - 1) || same(r + h - 1, c + w) ? 0 : raio,
    };
};
