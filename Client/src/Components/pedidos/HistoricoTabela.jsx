import UtenteAvatar from "../utentes/UtenteAvatar";
import { joinUrl } from "../../api/client";
import { PEDIDO_STATES } from "../../constants";
import { t } from "../../i18n";

// Resultados do registo de pedidos: tabela em ecrãs médios/grandes, cartões em
// telemóvel. Componente "burro" — não filtra nem ordena nada: recebe a página já
// pronta do servidor e limita-se a pedir ao container uma nova ordenação quando
// se clica num cabeçalho.

// Data + hora no formato local (pt-PT). Criado uma vez, não por linha.
const FORMATO = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" });
const quando = (hora) => FORMATO.format(new Date(hora));

// Espaçamento das células, um pouco mais apertado em telemóvel para caber mais
// tabela no ecrã antes de ser preciso deslizar para o lado.
const CELULA = "px-3 py-2.5 md:px-4 md:py-3";

const COR_ESTADO = {
    [PEDIDO_STATES.PENDING]: "bg-amber-100 text-amber-900",
    [PEDIDO_STATES.COMPLETED]: "bg-emerald-100 text-emerald-900",
    [PEDIDO_STATES.CANCELLED]: "bg-surface-container-high text-on-surface-variant",
};

const EstadoBadge = ({ estado }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-staff-mono text-staff-mono whitespace-nowrap ${COR_ESTADO[estado] || COR_ESTADO[PEDIDO_STATES.CANCELLED]}`}>
        {t.historico.estados[estado] || estado}
    </span>
);

const EmergenciaBadge = () => (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-900 font-staff-mono text-staff-mono whitespace-nowrap">
        <span className="material-symbols-outlined text-[16px]">priority_high</span>
        {t.historico.emergency}
    </span>
);

// Cabeçalho clicável: o 1º clique ordena pela coluna (descendente), os
// seguintes trocam a direção. A seta só aparece na coluna ativa.
const ColunaOrdenavel = ({ chave, label, ordenar, direcao, onOrdenar, className = "" }) => {
    const ativa = ordenar === chave;
    return (
        <th scope="col" className={`${CELULA} text-left font-staff-mono text-staff-mono text-on-surface-variant ${className}`}
            aria-sort={ativa ? (direcao === "asc" ? "ascending" : "descending") : "none"}>
            <button onClick={() => onOrdenar(chave)}
                title={ativa && direcao === "desc" ? t.historico.sortAsc : t.historico.sortDesc}
                className={`inline-flex items-center gap-1 hover:text-on-surface transition-colors ${ativa ? "text-on-surface font-bold" : ""}`}>
                {label}
                {/* A seta só existe na coluna ativa: os Material Symbols são
                    texto, por isso uma seta escondida por opacidade continuaria
                    a ser lida em voz alta pelos leitores de ecrã. */}
                {ativa && (
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                        {direcao === "asc" ? "arrow_upward" : "arrow_downward"}
                    </span>
                )}
            </button>
        </th>
    );
};

const HistoricoTabela = ({ pedidos, ordenar, direcao, onOrdenar, apiUrl }) => {
    const imagemBotao = (p) => joinUrl(apiUrl, p.botao?.imagem || "/imagesBotoes/default.png");

    return (
        // Uma tabela só, em todos os tamanhos de ecrã (era uma tabela + uma lista
        // de cartões para telemóvel, a pedido do utilizador: o registo lê-se
        // melhor com as mesmas colunas em toda a parte). Em ecrãs estreitos a
        // tabela não encolhe — mantém a largura mínima e desliza na horizontal
        // DENTRO do seu contentor, para a página em si nunca deslizar de lado.
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-surface-variant overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse">
                    <thead className="bg-surface-container border-b border-surface-variant">
                        <tr>
                            <ColunaOrdenavel chave="hora" label={t.historico.colDateTime} ordenar={ordenar} direcao={direcao} onOrdenar={onOrdenar} />
                            <ColunaOrdenavel chave="utente" label={t.historico.colUtente} ordenar={ordenar} direcao={direcao} onOrdenar={onOrdenar} />
                            <ColunaOrdenavel chave="botao" label={t.historico.colRequest} ordenar={ordenar} direcao={direcao} onOrdenar={onOrdenar} />
                            <th scope="col" className={`${CELULA} text-left font-staff-mono text-staff-mono text-on-surface-variant`}>{t.historico.colCategory}</th>
                            <ColunaOrdenavel chave="estado" label={t.historico.colState} ordenar={ordenar} direcao={direcao} onOrdenar={onOrdenar} />
                            <ColunaOrdenavel chave="emergencia" label={t.historico.emergency} ordenar={ordenar} direcao={direcao} onOrdenar={onOrdenar} />
                        </tr>
                    </thead>
                    <tbody>
                        {pedidos.map((p) => (
                            <tr key={p.id} className={`border-b border-surface-variant last:border-0 hover:bg-surface-container-low transition-colors ${p.emergencia ? "bg-red-50" : ""}`}>
                                <td className={`${CELULA} font-staff-mono text-staff-mono text-on-surface whitespace-nowrap`}>{quando(p.hora)}</td>
                                <td className={CELULA}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <UtenteAvatar imagem={p.utente?.imagem} corAvatar={p.utente?.corAvatar} nome={p.utente?.nome}
                                            apiUrl={apiUrl} className="w-8 h-8 text-[12px] shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-staff-mono text-staff-mono font-semibold text-on-surface truncate">{p.utente?.nome}</div>
                                            <div className="font-staff-mono text-staff-mono text-on-surface-variant truncate">{p.utente?.quarto}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={CELULA}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img src={imagemBotao(p)} alt="" aria-hidden="true"
                                            className="w-8 h-8 object-contain rounded shrink-0" />
                                        <span className="font-staff-mono text-staff-mono text-on-surface truncate" title={p.botao?.mensagem}>
                                            {p.botao?.mensagem || p.botao?.nome}
                                        </span>
                                    </div>
                                </td>
                                <td className={`${CELULA} font-staff-mono text-staff-mono text-on-surface-variant whitespace-nowrap`}>
                                    {p.botao?.categoria || t.common.noCategory}
                                </td>
                                <td className={CELULA}><EstadoBadge estado={p.estado} /></td>
                                <td className={CELULA}>{p.emergencia ? <EmergenciaBadge /> : <span className="text-on-surface-variant">—</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HistoricoTabela;
