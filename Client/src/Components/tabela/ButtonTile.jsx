import { TAMANHOS } from "./constants";

const ButtonTile = ({ botao, apiUrl, size = "M" }) => {
    const t = TAMANHOS[size] || TAMANHOS.M;
    return (
        <div
            className="w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-container-lowest border border-surface-variant text-on-surface shadow-sm select-none"
            style={{ minHeight: t.min }}
        >
            <img
                src={apiUrl + (botao.imagem || "/imagesBotoes/default.png")}
                alt={botao.nome}
                style={{ width: t.icon, height: t.icon, objectFit: "contain" }}
                draggable={false}
            />
            <span
                className="font-staff-mono font-semibold text-center leading-tight px-1 truncate max-w-full"
                style={{ fontSize: t.txt }}
            >
                {botao.nome}
            </span>
        </div>
    );
};

export default ButtonTile;
