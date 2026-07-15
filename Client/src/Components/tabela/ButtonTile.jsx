import { TAMANHOS } from "./constants";

const ButtonTile = ({ botao, apiUrl, size = "M", fill = false, w = 1 }) => {
    const t = TAMANHOS[size] || TAMANHOS.M;
    const tile = (
        <div
            className={`w-full flex flex-col items-center justify-center rounded-2xl bg-surface-container-lowest border border-surface-variant text-on-surface shadow-sm select-none overflow-hidden ${fill ? "h-full min-h-0" : "gap-1 p-1"}`}
            style={
                fill
                    ? {
                          // paddingBlock/gap em cqh (altura do container envolvente) em vez de
                          // % — % resolveria sempre contra a LARGURA (regra do spec CSS), o que
                          // encolhia a imagem em botões largos. paddingInline continua em % de
                          // largura, dividido por w para dar "6% de 1 coluna" seja qual for o span.
                          paddingInline: `${6 / w}%`,
                          paddingBlock: "6cqh",
                          gap: "4cqh",
                      }
                    : { minHeight: t.min }
            }
        >
            <img
                src={apiUrl + (botao.imagem || "/imagesBotoes/default.png")}
                alt={botao.nome}
                className={fill ? "flex-1 min-h-0 w-full object-contain" : ""}
                style={fill ? undefined : { width: t.icon, height: t.icon, objectFit: "contain" }}
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

    // As unidades cq* resolvem contra o container ANTECESSOR mais próximo, nunca contra o
    // próprio elemento que declara `container-type`. Daí o wrapper: é ele o container de
    // tamanho e o tile lá dentro é que consome cqh.
    return fill ? (
        <div className="h-full w-full min-h-0" style={{ containerType: "size" }}>
            {tile}
        </div>
    ) : (
        tile
    );
};

export default ButtonTile;
