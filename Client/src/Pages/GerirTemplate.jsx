import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { fetchTabelasPadrao, saveTabelaPadrao } from "../api/tabelasPadrao";
import TabelaEditor from "../Components/tabela/TabelaEditor";
import { DISPOSITIVOS, defaultConfig } from "../Components/tabela/constants";
import { useFeedback } from "../hooks/useFeedback";
import FeedbackToast from "../Components/FeedbackToast";
import { t } from "../i18n";

const configsVazias = () =>
    Object.fromEntries(Object.keys(DISPOSITIVOS).map((d) => [d, defaultConfig(d)]));

const GerirTemplate = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { botoes, apiUrl } = useContext(Context);

    const [nome, setNome] = useState("");
    const [dispositivo, setDispositivo] = useState("pc");
    const [configs, setConfigs] = useState(configsVazias());
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useFeedback();
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

    const cfg = configs[dispositivo];
    const patch = (p) => { setConfigs((prev) => ({ ...prev, [dispositivo]: { ...prev[dispositivo], ...p } })); setDirty(true); };

    const onSave = async () => {
        setSaving(true);
        try {
            await saveTabelaPadrao(id, { nome, configs });
            setDirty(false);
            setFeedback({ tipo: "ok", texto: t.tabelaEditor.templateSaved });
        } catch {
            setFeedback({ tipo: "erro", texto: t.tabelaEditor.saveError });
        } finally {
            setSaving(false);
        }
    };

    if (!carregado) return <div className="min-h-screen flex items-center justify-center text-on-surface-variant font-body-md">{t.tabelaEditor.loadingTemplate}</div>;

    return (
        <>
            <TabelaEditor
                titulo={t.tabelaEditor.manageTemplateTitle}
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
            <FeedbackToast feedback={feedback} />
        </>
    );
};

export default GerirTemplate;
