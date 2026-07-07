import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { fetchTabela, saveTabela } from "../api/tabela";
import TabelaEditor from "../Components/tabela/TabelaEditor";
import { DISPOSITIVOS } from "../Components/tabela/constants";

const defaultConfig = (d) => ({ cols: DISPOSITIVOS[d].colsDefault, size: "M", cells: [], spans: {}, coresCategoria: {} });

const GerirTabela = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { utentes, botoes, apiUrl } = useContext(Context);
    const utente = utentes.find((u) => String(u.id) === String(id));

    const [dispositivo, setDispositivo] = useState("pc");
    const [configs, setConfigs] = useState({
        smartphone: defaultConfig("smartphone"),
        tablet: defaultConfig("tablet"),
        pc: defaultConfig("pc"),
    });
    const [dirty, setDirty] = useState({});
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null); // { tipo: "ok" | "erro", texto }
    const [confirmarSaida, setConfirmarSaida] = useState(false);

    useEffect(() => {
        if (!feedback) return;
        const t = setTimeout(() => setFeedback(null), 3000);
        return () => clearTimeout(t);
    }, [feedback]);

    // Carrega os três layouts ao abrir.
    useEffect(() => {
        let vivo = true;
        (async () => {
            const entradas = await Promise.all(
                Object.keys(DISPOSITIVOS).map(async (d) => {
                    try { return [d, await fetchTabela(id, d)]; } catch { return [d, null]; }
                })
            );
            if (!vivo) return;
            setConfigs((prev) => {
                const next = { ...prev };
                for (const [d, c] of entradas)
                    if (c && Array.isArray(c.cells))
                        next[d] = { cols: c.cols ?? DISPOSITIVOS[d].colsDefault, size: c.size ?? "M", cells: c.cells, spans: c.spans ?? {}, coresCategoria: c.coresCategoria ?? {} };
                return next;
            });
        })();
        return () => { vivo = false; };
    }, [id]);

    const cfg = configs[dispositivo];
    const patch = (p) => {
        setConfigs((prev) => ({ ...prev, [dispositivo]: { ...prev[dispositivo], ...p } }));
        setDirty((d) => ({ ...d, [dispositivo]: true }));
    };

    const onSave = async () => {
        setSaving(true);
        try {
            const alterados = Object.keys(dirty).filter((d) => dirty[d]);
            await Promise.all(alterados.map((d) => saveTabela(id, d, configs[d])));
            setDirty({});
            setFeedback({ tipo: "ok", texto: alterados.length > 1 ? "Tabelas guardadas" : "Tabela guardada" });
            return true;
        } catch {
            setFeedback({ tipo: "erro", texto: "Erro ao guardar. Tenta novamente." });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const dirtyAtivo = Object.values(dirty).some(Boolean);
    const handleVoltar = () => { if (dirtyAtivo) setConfirmarSaida(true); else navigate("/staff"); };
    const guardarESair = async () => { if (await onSave()) navigate("/staff"); else setConfirmarSaida(false); };
    const descartarESair = () => { setConfirmarSaida(false); navigate("/staff"); };

    if (!utente) {
        return <div className="min-h-screen flex items-center justify-center text-on-surface-variant font-body-md">A carregar utente…</div>;
    }

    return (
        <>
            <TabelaEditor
                utenteNome={utente.nome}
                botoes={botoes}
                apiUrl={apiUrl}
                dispositivo={dispositivo}
                setDispositivo={setDispositivo}
                cols={cfg.cols}
                setCols={(v) => patch({ cols: v })}
                size={cfg.size}
                setSize={(v) => patch({ size: v })}
                cells={cfg.cells}
                setCells={(fn) => patch({ cells: typeof fn === "function" ? fn(cfg.cells) : fn })}
                spans={cfg.spans || {}}
                setSpans={(fn) => patch({ spans: typeof fn === "function" ? fn(cfg.spans || {}) : fn })}
                coresCategoria={cfg.coresCategoria || {}}
                setCoresCategoria={(fn) => patch({ coresCategoria: typeof fn === "function" ? fn(cfg.coresCategoria || {}) : fn })}
                dirty={dirtyAtivo}
                saving={saving}
                onSave={onSave}
                onVoltar={handleVoltar}
            />
            {confirmarSaida && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmarSaida(false)}>
                    <div className="bg-surface-container rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-display-lg text-lg font-bold text-on-surface mb-1">Alterações por guardar</h3>
                        <p className="text-staff-mono text-on-surface-variant mb-4">Tens alterações que ainda não foram guardadas. O que queres fazer?</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={guardarESair} disabled={saving}
                                className="w-full py-2.5 rounded-full bg-primary text-on-primary font-staff-mono font-semibold hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-40">
                                {saving ? "A guardar…" : "Guardar e sair"}
                            </button>
                            <button onClick={descartarESair}
                                className="w-full py-2.5 rounded-full bg-error-container text-on-error-container font-staff-mono font-semibold hover:bg-error hover:text-on-error transition-colors">
                                Descartar e sair
                            </button>
                            <button onClick={() => setConfirmarSaida(false)}
                                className="w-full py-2.5 rounded-full text-on-surface-variant font-staff-mono hover:bg-surface-container-high transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {feedback && (
                <div role="status"
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-staff-mono font-semibold ${feedback.tipo === "ok" ? "bg-primary text-on-primary" : "bg-error text-on-error"}`}>
                    <span className="material-symbols-outlined text-[20px]">{feedback.tipo === "ok" ? "check_circle" : "error"}</span>
                    {feedback.texto}
                </div>
            )}
        </>
    );
};

export default GerirTabela;
