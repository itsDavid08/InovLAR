import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Context } from "../ContextProvider";
import StaffShell from "../Components/layout/StaffShell";
import StaffSidebar from "../Components/layout/StaffSidebar";
import HistoricoFiltros from "../Components/pedidos/HistoricoFiltros";
import HistoricoTabela from "../Components/pedidos/HistoricoTabela";
import { fetchHistoricoPedidos } from "../api/pedidos";
import { PEDIDO_STATES } from "../constants";
import { t } from "../i18n";

// Registo de pedidos: o histórico completo (ao contrário de /staff/pedidos, que
// só mostra os pendentes). Container — guarda os filtros/ordenação/página e
// pede ao servidor; filtrar e ordenar acontece em SQL, não aqui, porque a
// tabela `pedidos` só cresce e nunca se traz o histórico todo para o browser.
const LIMITE = 50;

const FILTROS_VAZIOS = { de: "", ate: "", utenteId: "", estado: "", categoria: "", emergencia: "", q: "" };

const HistoricoPedidos = () => {
    const { utentes, botoes, apiUrl } = useContext(Context);
    const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
    const [ordenar, setOrdenar] = useState("hora");
    const [direcao, setDirecao] = useState("desc");
    const [offset, setOffset] = useState(0);
    const [dados, setDados] = useState(null);   // { total, resumo, pedidos }
    const [aCarregar, setACarregar] = useState(true);
    const [erro, setErro] = useState(false);
    // Muda de valor a cada "Atualizar" — força o efeito a repetir a mesma query.
    const [recarga, setRecarga] = useState(0);

    // A procura por texto é escrita letra a letra: só vai ao servidor 350 ms
    // depois de parar de escrever (os outros filtros são discretos e vão logo).
    const [qDebounced, setQDebounced] = useState("");
    useEffect(() => {
        const id = setTimeout(() => setQDebounced(filtros.q.trim()), 350);
        return () => clearTimeout(id);
    }, [filtros.q]);

    const { de, ate, utenteId, estado, categoria, emergencia } = filtros;

    useEffect(() => {
        let vivo = true; // respostas que cheguem fora de ordem são ignoradas
        setACarregar(true);
        setErro(false);
        fetchHistoricoPedidos({ de, ate, utenteId, estado, categoria, emergencia, q: qDebounced, ordenar, direcao, limite: LIMITE, offset })
            .then((r) => { if (vivo) setDados(r); })
            .catch(() => { if (vivo) { setErro(true); setDados(null); } })
            .finally(() => { if (vivo) setACarregar(false); });
        return () => { vivo = false; };
    }, [de, ate, utenteId, estado, categoria, emergencia, qDebounced, ordenar, direcao, offset, recarga]);

    // Qualquer mudança de filtro ou de ordenação volta à 1ª página — senão
    // ficaria uma página 3 de um conjunto que agora só tem uma.
    const mudarFiltros = (patch) => { setFiltros((f) => ({ ...f, ...patch })); setOffset(0); };
    const limpar = () => { setFiltros(FILTROS_VAZIOS); setOffset(0); };

    // Clicar na coluna ativa troca a direção; noutra coluna começa em descendente
    // (o mais recente/maior primeiro, que é o que interessa num registo).
    const mudarOrdenacao = (chave) => {
        if (chave === ordenar) setDirecao((d) => (d === "asc" ? "desc" : "asc"));
        else { setOrdenar(chave); setDirecao("desc"); }
        setOffset(0);
    };

    const categorias = useMemo(
        () => [...new Set(botoes.map((b) => b.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")),
        [botoes],
    );

    const temFiltros = Object.values(filtros).some((v) => v !== "");
    const total = dados?.total ?? 0;
    const pedidos = dados?.pedidos ?? [];
    const resumo = dados?.resumo;
    const primeiro = total === 0 ? 0 : offset + 1;
    const ultimo = offset + pedidos.length;

    // A lista fica montada durante o carregamento (só esbatida) para a página
    // não "saltar" a cada mudança de filtro.
    const listaRef = useRef(null);
    const irPara = (novoOffset) => {
        setOffset(novoOffset);
        listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <StaffShell sidebar={<StaffSidebar />}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4">
                <div>
                    <h2 className="font-display-lg text-3xl md:text-2xl font-bold text-on-surface mb-1">{t.historico.title}</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">{t.historico.subtitle}</p>
                </div>
                {resumo && (
                    <div className="flex flex-wrap gap-2">
                        <Chip icone="list_alt" label={t.historico.total} valor={total} />
                        <Chip icone="check_circle" label={t.historico.estados[PEDIDO_STATES.COMPLETED]} valor={resumo[PEDIDO_STATES.COMPLETED]} />
                        <Chip icone="pending" label={t.historico.estados[PEDIDO_STATES.PENDING]} valor={resumo[PEDIDO_STATES.PENDING]} />
                        <Chip icone="cancel" label={t.historico.estados[PEDIDO_STATES.CANCELLED]} valor={resumo[PEDIDO_STATES.CANCELLED]} />
                        <Chip icone="priority_high" label={t.historico.emergencies} valor={resumo.emergencias} destaque={resumo.emergencias > 0} />
                    </div>
                )}
            </div>

            <HistoricoFiltros
                filtros={filtros}
                onChange={mudarFiltros}
                onLimpar={limpar}
                onAtualizar={() => setRecarga((n) => n + 1)}
                utentes={utentes}
                categorias={categorias}
                temFiltros={temFiltros}
            />

            <div ref={listaRef} className={aCarregar ? "opacity-50 transition-opacity" : "transition-opacity"}>
                {erro ? (
                    <p className="font-staff-mono text-staff-mono text-error py-8 text-center">{t.historico.error}</p>
                ) : pedidos.length === 0 ? (
                    <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-[40px] text-on-surface-variant">
                            {aCarregar ? "hourglass_top" : "inbox"}
                        </span>
                        <p className="font-body-md text-body-md text-on-surface mt-2">
                            {aCarregar ? t.historico.loading : t.historico.empty}
                        </p>
                        {!aCarregar && temFiltros && (
                            <p className="font-staff-mono text-staff-mono text-on-surface-variant mt-1">{t.historico.emptyHint}</p>
                        )}
                    </div>
                ) : (
                    <HistoricoTabela
                        pedidos={pedidos}
                        ordenar={ordenar}
                        direcao={direcao}
                        onOrdenar={mudarOrdenacao}
                        apiUrl={apiUrl}
                    />
                )}
            </div>

            {/* Paginação — só aparece quando há mais do que uma página. */}
            {total > LIMITE && (
                <div className="flex items-center justify-between gap-3 mt-4">
                    <span className="font-staff-mono text-staff-mono text-on-surface-variant">
                        {t.historico.showing(primeiro, ultimo, total)}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={() => irPara(Math.max(0, offset - LIMITE))} disabled={offset === 0}
                            aria-label={t.historico.prevPage}
                            className="px-3 py-2 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        <button onClick={() => irPara(offset + LIMITE)} disabled={ultimo >= total}
                            aria-label={t.historico.nextPage}
                            className="px-3 py-2 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}
        </StaffShell>
    );
};

// Contador do cabeçalho (total/estado/emergências) do conjunto FILTRADO inteiro,
// não só da página visível — os números vêm do `resumo` do servidor.
const Chip = ({ icone, label, valor, destaque = false }) => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-staff-mono text-staff-mono ${
        destaque ? "bg-red-100 text-red-900" : "bg-surface-container text-on-surface-variant"
    }`}>
        <span className="material-symbols-outlined text-[18px]">{icone}</span>
        <span className="font-bold text-on-surface">{valor ?? 0}</span>
        {label}
    </div>
);

export default HistoricoPedidos;
