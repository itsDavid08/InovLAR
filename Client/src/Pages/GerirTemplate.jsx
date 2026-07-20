import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { fetchTabelasPadrao, saveTabelaPadrao } from "../api/tabelasPadrao";
import TabelaEditor from "../Components/tabela/TabelaEditor";
import { useTabelaConfigs } from "../Components/tabela/useTabelaConfigs";
import { useFeedback } from "../hooks/useFeedback";
import FeedbackToast from "../Components/FeedbackToast";
import { t } from "../i18n";

const GerirTemplate = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { botoes, apiUrl } = useContext(Context);

    const { configs, setConfigs, dispositivo, setDispositivo, cfg, patch, dirty, markClean } =
        useTabelaConfigs();
    const [nome, setNome] = useState("");
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useFeedback();
    const [carregado, setCarregado] = useState(false);

    useEffect(() => {
        let vivo = true;
        fetchTabelasPadrao().then((lista) => {
            if (!vivo) return;
            const tpl = Array.isArray(lista) ? lista.find((x) => String(x.id) === String(id)) : null;
            if (tpl) {
                setNome(tpl.nome);
                setConfigs((prev) => {
                    const next = { ...prev };
                    for (const d of Object.keys(next))
                        if (tpl.configs?.[d]) next[d] = { ...next[d], ...tpl.configs[d] };
                    return next;
                });
            }
            setCarregado(true);
        }).catch(() => setCarregado(true));
        return () => { vivo = false; };
    }, [id, setConfigs]);

    const onSave = async () => {
        setSaving(true);
        try {
            await saveTabelaPadrao(id, { nome, configs });
            markClean();
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
                config={cfg}
                onPatch={patch}
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
