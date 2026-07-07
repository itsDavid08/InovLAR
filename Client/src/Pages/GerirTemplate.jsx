import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { fetchTabelasPadrao, saveTabelaPadrao } from "../api/tabelasPadrao";
import TabelaEditor from "../Components/tabela/TabelaEditor";
import { DISPOSITIVOS } from "../Components/tabela/constants";

const defaultConfig = (d) => ({ cols: DISPOSITIVOS[d].colsDefault, size: "M", cells: [], spans: {}, coresCategoria: {} });
const configsVazias = () => ({ smartphone: defaultConfig("smartphone"), tablet: defaultConfig("tablet"), pc: defaultConfig("pc") });

const GerirTemplate = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { botoes, apiUrl } = useContext(Context);

    const [nome, setNome] = useState("");
    const [dispositivo, setDispositivo] = useState("pc");
    const [configs, setConfigs] = useState(configsVazias());
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [carregado, setCarregado] = useState(false);

    useEffect(() => {
        let vivo = true;
        fetchTabelasPadrao().then((lista) => {
            if (!vivo) return;
            const t = Array.isArray(lista) ? lista.find((x) => String(x.id) === String(id)) : null;
            if (t) {
                setNome(t.nome);
                const carregado = configsVazias();
                for (const d of Object.keys(carregado))
                    if (t.configs?.[d]) carregado[d] = { ...carregado[d], ...t.configs[d] };
                setConfigs(carregado);
            }
            setCarregado(true);
        }).catch(() => setCarregado(true));
        return () => { vivo = false; };
    }, [id]);

    useEffect(() => {
        if (!feedback) return;
        const tt = setTimeout(() => setFeedback(null), 3000);
        return () => clearTimeout(tt);
    }, [feedback]);

    const cfg = configs[dispositivo];
    const patch = (p) => { setConfigs((prev) => ({ ...prev, [dispositivo]: { ...prev[dispositivo], ...p } })); setDirty(true); };

    const onSave = async () => {
        setSaving(true);
        try {
            await saveTabelaPadrao(id, { nome, configs });
            setDirty(false);
            setFeedback({ tipo: "ok", texto: "Template guardado" });
        } catch {
            setFeedback({ tipo: "erro", texto: "Erro ao guardar. Tenta novamente." });
        } finally {
            setSaving(false);
        }
    };

    if (!carregado) return <div className="min-h-screen flex items-center justify-center text-on-surface-variant font-body-md">A carregar template…</div>;

    return (
        <>
            <TabelaEditor
                titulo="Gerir Template"
                utenteNome={nome}
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
                dirty={dirty}
                saving={saving}
                onSave={onSave}
                onVoltar={() => navigate("/staff/tabelas")}
            />
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

export default GerirTemplate;
