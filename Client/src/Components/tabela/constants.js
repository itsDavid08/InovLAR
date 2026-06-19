export const DISPOSITIVOS = {
    smartphone: { label: "Telemóvel", icon: "smartphone", colsDefault: 3, rowsDefault: 6, maxW: 380, aspect: "9 / 16" },
    tablet:     { label: "Tablet",    icon: "tablet",     colsDefault: 4, rowsDefault: 5, maxW: 640, aspect: "4 / 3" },
    pc:         { label: "PC",        icon: "computer",   colsDefault: 6, rowsDefault: 5, maxW: 980, aspect: "16 / 10" },
};

// Tamanho do tile: altura mínima, tamanho do ícone e do texto.
export const TAMANHOS = {
    P: { min: 80,  icon: 28, txt: 11 },
    M: { min: 112, icon: 40, txt: 13 },
    G: { min: 140, icon: 52, txt: 15 },
};

export const COL_OPCOES = [2, 3, 4, 5, 6];

// Cor por categoria — só decorativa (ponto no agrupamento da biblioteca).
export const COR_CATEGORIA = {
    "Sinto-me": "#F9A825",
    "Necessidades": "#63597c",
    "Tecnologias": "#2E9BD6",
    "Chamar": "#F0A33E",
    "Medicamentos": "#BA1A1A",
};
