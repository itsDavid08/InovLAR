import { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import StaffShell from "../Components/layout/StaffShell";
import StaffSidebar from "../Components/layout/StaffSidebar";
import ItemMenu from "../Components/layout/ItemMenu";
import TabelaPreview from "../Components/tabela/TabelaPreview";
import { fetchTabelas } from "../api/tabela";
import { fetchTabelasPadrao, criarTabelaPadrao, saveTabelaPadrao, deleteTabelaPadrao, aplicarTabelaPadrao } from "../api/tabelasPadrao";
import { DISPOSITIVOS } from "../Components/tabela/constants";

const inicial = (nome) => nome.split(" ").map((n) => n[0]).slice(0, 2).join("");
const devsComLayout = (configsObj) => Object.keys(DISPOSITIVOS).filter((d) => {
    const c = configsObj?.[d];
    return c && Array.isArray(c.cells) && c.cells.some((v) => v != null);
});

const TabelasView = () => {
    const { utentes, botoes, apiUrl } = useContext(Context);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [layouts, setLayouts] = useState([]);     // [{ utenteId, dispositivo, config }]
    const [templates, setTemplates] = useState([]); // [{ id, nome, configs }]
    const [dispSel, setDispSel] = useState({});      // por utente
    const [dispSelTpl, setDispSelTpl] = useState({}); // por template
    const [aplicar, setAplicar] = useState(null);    // template a aplicar (abre modal)
    const [feedback, setFeedback] = useState(null);
    const [openMenuTpl, setOpenMenuTpl] = useState(null); // template com o menu (⋮) aberto
    const openTplRef = useRef(null);

    const recarregarLayouts = () => fetchTabelas().then((d) => { if (Array.isArray(d)) setLayouts(d); }).catch(() => {});
    const recarregarTemplates = () => fetchTabelasPadrao().then((d) => { if (Array.isArray(d)) setTemplates(d); }).catch(() => {});

    useEffect(() => { let vivo = true;
        fetchTabelas().then((d) => { if (vivo && Array.isArray(d)) setLayouts(d); }).catch(() => {});
        fetchTabelasPadrao().then((d) => { if (vivo && Array.isArray(d)) setTemplates(d); }).catch(() => {});
        return () => { vivo = false; };
    }, []);
    useEffect(() => { if (!feedback) return; const t = setTimeout(() => setFeedback(null), 3000); return () => clearTimeout(t); }, [feedback]);

    const botaoPorId = useMemo(() => Object.fromEntries(botoes.map((b) => [b.id, b])), [botoes]);
    const porUtente = useMemo(() => {
        const m = {};
        for (const l of layouts) (m[l.utenteId] = m[l.utenteId] || {})[l.dispositivo] = l.config;
        return m;
    }, [layouts]);

    const onNovoTemplate = async () => {
        const nome = window.prompt("Nome do novo template:");
        if (!nome || !nome.trim()) return;
        try { const t = await criarTabelaPadrao({ nome: nome.trim(), configs: {} }); navigate(`/gerir-template/${t.id}`); }
        catch { setFeedback({ tipo: "erro", texto: "Erro ao criar template." }); }
    };
    const onRenomear = async (t) => {
        const nome = window.prompt("Novo nome:", t.nome);
        if (!nome || !nome.trim() || nome.trim() === t.nome) return;
        try { await saveTabelaPadrao(t.id, { nome: nome.trim() }); recarregarTemplates(); }
        catch { setFeedback({ tipo: "erro", texto: "Erro ao renomear." }); }
    };
    const onEliminar = async (t) => {
        if (!window.confirm(`Eliminar o template "${t.nome}"?`)) return;
        try { await deleteTabelaPadrao(t.id); recarregarTemplates(); }
        catch { setFeedback({ tipo: "erro", texto: "Erro ao eliminar." }); }
    };
    const onAplicar = async (utente) => {
        if (!aplicar) return;
        if (!window.confirm(`Aplicar "${aplicar.nome}" a ${utente.nome}? Substitui as tabelas atuais do utente.`)) return;
        try {
            await aplicarTabelaPadrao(aplicar.id, utente.id);
            setAplicar(null);
            setFeedback({ tipo: "ok", texto: `Aplicado a ${utente.nome}` });
            recarregarLayouts();
        } catch { setFeedback({ tipo: "erro", texto: "Erro ao aplicar." }); }
    };

    const utentesFiltrados = utentes.filter((u) => u.nome.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <StaffShell sidebar={<StaffSidebar />}>
            {/* ===== Modelos (templates) ===== */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4">
                <div>
                    <h2 className="font-display-lg text-3xl md:text-2xl font-bold text-on-surface mb-1">Modelos</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">Tabelas default reutilizáveis. Cria, edita e aplica a utentes.</p>
                </div>
                <button onClick={onNovoTemplate}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-staff-mono text-staff-mono hover:bg-primary-container hover:text-on-primary-container transition-colors shrink-0">
                    <span className="material-symbols-outlined">add</span> Novo Template
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                {templates.map((t) => {
                    const dispT = dispSelTpl[t.id] || devsComLayout(t.configs)[0] || "smartphone";
                    const comLayout = devsComLayout(t.configs);
                    return (
                        <div key={t.id}
                            ref={openMenuTpl === t.id ? openTplRef : null}
                            onClick={() => setOpenMenuTpl((id) => (id === t.id ? null : t.id))}
                            className={`bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-surface-variant hover:shadow-md transition-all relative overflow-hidden cursor-pointer flex flex-col ${openMenuTpl === t.id ? "z-50" : ""}`}>
                            <div className="flex items-center justify-between mb-3 gap-2">
                                <h3 className="font-body-xl text-body-xl font-semibold text-on-surface truncate min-w-0" title={t.nome}>{t.nome}</h3>
                                <div className="flex items-center gap-1 shrink-0">
                                    <div className="flex bg-surface-container rounded-full p-0.5" onClick={(e) => e.stopPropagation()}>
                                        {Object.entries(DISPOSITIVOS).map(([k, d]) => {
                                            const tem = comLayout.includes(k);
                                            return (
                                                <button key={k} onClick={() => setDispSelTpl((s) => ({ ...s, [t.id]: k }))} title={d.label}
                                                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${dispT === k ? "bg-primary text-on-primary" : tem ? "text-on-surface-variant hover:bg-surface-container-high" : "text-on-surface-variant/30"}`}>
                                                    <span className="material-symbols-outlined text-[16px]">{d.icon}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <ItemMenu
                                        open={openMenuTpl === t.id}
                                        onOpenChange={(v) => setOpenMenuTpl(v ? t.id : null)}
                                        boundaryRef={openTplRef}
                                        title={t.nome}
                                        subtitle="Template"
                                        thumbnail={<span className="material-symbols-outlined text-[20px]">grid_view</span>}
                                        onEdit={() => navigate(`/gerir-template/${t.id}`)}
                                        onAplicar={() => setAplicar(t)}
                                        onRenomear={() => onRenomear(t)}
                                        onDelete={() => onEliminar(t)}
                                    />
                                </div>
                            </div>
                            <TabelaPreview config={t.configs?.[dispT]} dispositivo={dispT} botaoPorId={botaoPorId} apiUrl={apiUrl} />
                        </div>
                    );
                })}
                {templates.length === 0 && <p className="text-staff-mono text-on-surface-variant col-span-full">Sem modelos. Cria um para reutilizar.</p>}
            </div>

            {/* ===== Tabelas dos utentes ===== */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4">
                <div>
                    <h2 className="font-display-lg text-3xl md:text-2xl font-bold text-on-surface mb-1">Tabelas dos utentes</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">Pré-visualização por utente. Clica para editar.</p>
                </div>
                <div className="relative flex-1 sm:flex-none">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-56 pl-10 pr-4 py-2 rounded-full bg-surface-container border-none focus:ring-2 focus:ring-primary font-body-md text-body-md text-on-surface placeholder-on-surface-variant"
                        placeholder="Procurar utente..." type="text" />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {utentesFiltrados.map((u) => {
                    const disp = dispSel[u.id] || devsComLayout(porUtente[u.id])[0] || "smartphone";
                    const comLayout = devsComLayout(porUtente[u.id]);
                    return (
                        <div key={u.id} onClick={() => navigate(`/gerir-tabela/${u.id}`)}
                            className="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-surface-variant hover:shadow-md transition-all cursor-pointer">
                            <div className="flex items-center justify-between mb-3 gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-display-lg text-[18px] shrink-0">{inicial(u.nome)}</div>
                                    <div className="min-w-0">
                                        <h3 className="font-body-xl text-body-xl font-semibold text-on-surface truncate" title={u.nome}>{u.nome}</h3>
                                        <p className="font-body-md text-body-md text-on-surface-variant truncate flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[15px]">meeting_room</span>{u.quarto}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex bg-surface-container rounded-full p-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {Object.entries(DISPOSITIVOS).map(([k, d]) => {
                                        const tem = comLayout.includes(k);
                                        return (
                                            <button key={k} onClick={() => setDispSel((s) => ({ ...s, [u.id]: k }))} title={d.label}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${disp === k ? "bg-primary text-on-primary" : tem ? "text-on-surface-variant hover:bg-surface-container-high" : "text-on-surface-variant/30"}`}>
                                                <span className="material-symbols-outlined text-[16px]">{d.icon}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <TabelaPreview config={porUtente[u.id]?.[disp]} dispositivo={disp} botaoPorId={botaoPorId} apiUrl={apiUrl} />
                        </div>
                    );
                })}
            </div>

            {/* ===== Modal: aplicar template a utente ===== */}
            {aplicar && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setAplicar(null)}>
                    <div className="bg-surface-container rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-surface-variant">
                            <h3 className="font-display-lg text-lg font-bold text-on-surface">Aplicar "{aplicar.nome}"</h3>
                            <p className="text-staff-mono text-on-surface-variant">Escolhe o utente — substitui as tabelas existentes.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {utentes.map((u) => (
                                <button key={u.id} onClick={() => onAplicar(u)}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high text-left">
                                    <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[14px] shrink-0">{inicial(u.nome)}</div>
                                    <div className="min-w-0">
                                        <div className="font-semibold text-on-surface truncate">{u.nome}</div>
                                        <div className="text-staff-mono text-on-surface-variant truncate">{u.quarto}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="p-3 border-t border-surface-variant flex justify-end">
                            <button onClick={() => setAplicar(null)} className="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container-high font-staff-mono">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {feedback && (
                <div role="status"
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-staff-mono font-semibold ${feedback.tipo === "ok" ? "bg-primary text-on-primary" : "bg-error text-on-error"}`}>
                    <span className="material-symbols-outlined text-[20px]">{feedback.tipo === "ok" ? "check_circle" : "error"}</span>
                    {feedback.texto}
                </div>
            )}
        </StaffShell>
    );
};

export default TabelasView;
