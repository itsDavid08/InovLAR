import { TAMANHOS } from "./constants";

const ButtonTile = ({ botao, apiUrl, size = "M", fill = false }) => {
    const t = TAMANHOS[size] || TAMANHOS.M;
    return (
        <div
            className={`w-full flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface-container-lowest border border-surface-variant text-on-surface shadow-sm select-none p-1 overflow-hidden ${fill ? "h-full min-h-0" : ""}`}
            style={fill ? undefined : { minHeight: t.min }}
        >
            <img
                src={apiUrl + (botao.imagem || "/imagesBotoes/default.png")}
                alt={botao.nome}
                className={fill ? "flex-1 min-h-0 w-auto max-w-full object-contain" : ""}
                style={fill ? { maxHeight: t.icon } : { width: t.icon, height: t.icon, objectFit: "contain" }}
                draggable={false}
            />
            <span
                className="font-staff-mono font-semibold text-center leading-tight px-1 truncate max-w-full w-full shrink-0"
                style={{ fontSize: t.txt }}
            >
                {botao.nome}
            </span>
        </div>
    );
};

export default ButtonTile;
