import { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import StaffShell from "../Components/layout/StaffShell";
import StaffSidebar from "../Components/layout/StaffSidebar";
import ItemMenu from "../Components/layout/ItemMenu";
import TabelaPreview from "../Components/tabela/TabelaPreview";
import UtenteAvatar from "../Components/utentes/UtenteAvatar";
import SearchInput from "../Components/SearchInput";
import Modal from "../Components/Modal";
import FeedbackToast from "../Components/FeedbackToast";
import { useFeedback } from "../hooks/useFeedback";
import { useButtonById } from "../hooks/useButtonById";
import { fetchTabelas } from "../api/tabela";
import { fetchTabelasPadrao, criarTabelaPadrao, saveTabelaPadrao, deleteTabelaPadrao, aplicarTabelaPadrao } from "../api/tabelasPadrao";
import { DISPOSITIVOS, devicesWithLayout } from "../Components/tabela/constants";
import { t } from "../i18n";

const TabelasView = () => {
    const { utentes, botoes, apiUrl } = useContext(Context);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [layouts, setLayouts] = useState([]);     // [{ utenteId, dispositivo, config }]
    const [templates, setTemplates] = useState([]); // [{ id, nome, configs }]
    const [dispSel, setDispSel] = useState({});      // por utente
    const [dispSelTpl, setDispSelTpl] = useState({}); // por template
    const [aplicar, setAplicar] = useState(null);    // template a aplicar (abre modal)
    const [feedback, setFeedback] = useFeedback();
    const [openMenuTpl, setOpenMenuTpl] = useState(null); // template com o menu (⋮) aberto
    const openTplRef = useRef(null);

    const recarregarLayouts = () => fetchTabelas().then((d) => { if (Array.isArray(d)) setLayouts(d); }).catch(() => {});
    const recarregarTemplates = () => fetchTabelasPadrao().then((d) => { if (Array.isArray(d)) setTemplates(d); }).catch(() => {});

    useEffect(() => { let vivo = true;
        fetchTabelas().then((d) => { if (vivo && Array.isArray(d)) setLayouts(d); }).catch(() => {});
        fetchTabelasPadrao().then((d) => { if (vivo && Array.isArray(d)) setTemplates(d); }).catch(() => {});
        return () => { vivo = false; };
    }, []);

    const botaoPorId = useButtonById(botoes);
    const porUtente = useMemo(() => {
        const m = {};
        for (const l of layouts) (m[l.utenteId] = m[l.utenteId] || {})[l.dispositivo] = l.config;
        return m;
    }, [layouts]);

    const onNovoTemplate = async () => {
        const nome = window.prompt(t.tabelasView.newTemplateNamePrompt);
        if (!nome || !nome.trim()) return;
        try { const tpl = await criarTabelaPadrao({ nome: nome.trim(), configs: {} }); navigate(`/gerir-template/${tpl.id}`); }
        catch { setFeedback({ tipo: "erro", texto: t.tabelasView.createError }); }
    };
    const onRenomear = async (tpl) => {
        const nome = window.prompt(t.tabelasView.renamePrompt, tpl.nome);
        if (!nome || !nome.trim() || nome.trim() === tpl.nome) return;
        try { await saveTabelaPadrao(tpl.id, { nome: nome.trim() }); recarregarTemplates(); }
        catch { setFeedback({ tipo: "erro", texto: t.tabelasView.renameError }); }
    };
    const onEliminar = async (tpl) => {
        if (!window.confirm(t.tabelasView.deleteConfirm(tpl.nome))) return;
        try { await deleteTabelaPadrao(tpl.id); recarregarTemplates(); }
        catch { setFeedback({ tipo: "erro", texto: t.tabelasView.deleteError }); }
    };
    const onAplicar = async (utente) => {
        if (!aplicar) return;
        if (!window.confirm(t.tabelasView.applyConfirm(aplicar.nome, utente.nome))) return;
        try {
            await aplicarTabelaPadrao(aplicar.id, utente.id);
            setAplicar(null);
            setFeedback({ tipo: "ok", texto: t.tabelasView.appliedTo(utente.nome) });
            recarregarLayouts();
        } catch { setFeedback({ tipo: "erro", texto: t.tabelasView.applyError }); }
    };

    const utentesFiltrados = utentes.filter((u) => u.nome.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <StaffShell sidebar={<StaffSidebar />}>
            {/* ===== Modelos (templates) ===== */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4">
                <div>
                    <h2 className="font-display-lg text-3xl md:text-2xl font-bold text-on-surface mb-1">{t.tabelasView.templatesTitle}</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">{t.tabelasView.templatesSubtitle}</p>
                </div>
                <button onClick={onNovoTemplate}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-staff-mono text-staff-mono hover:bg-primary-container hover:text-on-primary-container transition-colors shrink-0">
                    <span className="material-symbols-outlined">add</span> {t.tabelasView.newTemplate}
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                {templates.map((tpl) => {
                    const dispT = dispSelTpl[tpl.id] || devicesWithLayout(tpl.configs)[0] || "smartphone";
                    const comLayout = devicesWithLayout(tpl.configs);
                    return (
                        <div key={tpl.id}
                            ref={openMenuTpl === tpl.id ? openTplRef : null}
                            onClick={() => setOpenMenuTpl((id) => (id === tpl.id ? null : tpl.id))}
                            className={`bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-surface-variant hover:shadow-md transition-all relative overflow-hidden cursor-pointer flex flex-col ${openMenuTpl === tpl.id ? "z-50" : ""}`}>
                            <div className="flex items-center justify-between mb-3 gap-2">
                                <h3 className="font-body-xl text-body-xl font-semibold text-on-surface truncate min-w-0" title={tpl.nome}>{tpl.nome}</h3>
                                <div className="flex items-center gap-1 shrink-0">
                                    <div className="flex bg-surface-container rounded-full p-0.5" onClick={(e) => e.stopPropagation()}>
                                        {Object.entries(DISPOSITIVOS).map(([k, d]) => {
                                            const tem = comLayout.includes(k);
                                            return (
                                                <button key={k} onClick={() => setDispSelTpl((s) => ({ ...s, [tpl.id]: k }))} title={d.label}
                                                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${dispT === k ? "bg-primary text-on-primary" : tem ? "text-on-surface-variant hover:bg-surface-container-high" : "text-on-surface-variant/30"}`}>
                                                    <span className="material-symbols-outlined text-[16px]">{d.icon}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <ItemMenu
                                        open={openMenuTpl === tpl.id}
                                        onOpenChange={(v) => setOpenMenuTpl(v ? tpl.id : null)}
                                        boundaryRef={openTplRef}
                                        title={tpl.nome}
                                        subtitle={t.tabelasView.templateLabel}
                                        thumbnail={<span className="material-symbols-outlined text-[20px]">grid_view</span>}
                                        onEdit={() => navigate(`/gerir-template/${tpl.id}`)}
                                        onAplicar={() => setAplicar(tpl)}
                                        onRenomear={() => onRenomear(tpl)}
                                        onDelete={() => onEliminar(tpl)}
                                    />
                                </div>
                            </div>
                            <TabelaPreview config={tpl.configs?.[dispT]} dispositivo={dispT} botaoPorId={botaoPorId} apiUrl={apiUrl} />
                        </div>
                    );
                })}
                {templates.length === 0 && <p className="text-staff-mono text-on-surface-variant col-span-full">{t.tabelasView.noTemplates}</p>}
            </div>

            {/* ===== Tabelas dos utentes ===== */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4">
                <div>
                    <h2 className="font-display-lg text-3xl md:text-2xl font-bold text-on-surface mb-1">{t.tabelasView.utenteTablesTitle}</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">{t.tabelasView.utenteTablesSubtitle}</p>
                </div>
                <SearchInput value={searchQuery} onChange={setSearchQuery}
                    placeholder={t.common.searchUtentePlaceholder}
                    className="flex-1 sm:flex-none" inputClassName="sm:w-56" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {utentesFiltrados.map((u) => {
                    const disp = dispSel[u.id] || devicesWithLayout(porUtente[u.id])[0] || "smartphone";
                    const comLayout = devicesWithLayout(porUtente[u.id]);
                    return (
                        <div key={u.id} onClick={() => navigate(`/gerir-tabela/${u.id}`)}
                            className="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-surface-variant hover:shadow-md transition-all cursor-pointer">
                            <div className="flex items-center justify-between mb-3 gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <UtenteAvatar imagem={u.imagem} corAvatar={u.corAvatar} nome={u.nome} apiUrl={apiUrl}
                                        className="w-11 h-11 text-[16px] shrink-0" />
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
                <Modal onClose={() => setAplicar(null)} className="max-w-md max-h-[80vh] flex flex-col">
                    <div className="p-4 border-b border-surface-variant">
                        <h3 className="font-display-lg text-lg font-bold text-on-surface">{t.tabelasView.applyModalTitle(aplicar.nome)}</h3>
                        <p className="text-staff-mono text-on-surface-variant">{t.tabelasView.applyModalSubtitle}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {utentes.map((u) => (
                            <button key={u.id} onClick={() => onAplicar(u)}
                                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high text-left">
                                <UtenteAvatar imagem={u.imagem} corAvatar={u.corAvatar} nome={u.nome} apiUrl={apiUrl}
                                    className="w-9 h-9 text-[14px] shrink-0" />
                                <div className="min-w-0">
                                    <div className="font-semibold text-on-surface truncate">{u.nome}</div>
                                    <div className="text-staff-mono text-on-surface-variant truncate">{u.quarto}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="p-3 border-t border-surface-variant flex justify-end">
                        <button onClick={() => setAplicar(null)} className="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container-high font-staff-mono">{t.common.cancel}</button>
                    </div>
                </Modal>
            )}

            <FeedbackToast feedback={feedback} zClass="z-[70]" />
        </StaffShell>
    );
};

export default TabelasView;
