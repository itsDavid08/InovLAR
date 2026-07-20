import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { fetchTabela, saveTabela } from "../api/tabela";
import TabelaEditor from "../Components/tabela/TabelaEditor";
import { DISPOSITIVOS } from "../Components/tabela/constants";
import { useTabelaConfigs } from "../Components/tabela/useTabelaConfigs";
import { useFeedback } from "../hooks/useFeedback";
import FeedbackToast from "../Components/FeedbackToast";
import Modal from "../Components/Modal";
import { t } from "../i18n";

const GerirTabela = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { utentes, botoes, apiUrl } = useContext(Context);
    const utente = utentes.find((u) => String(u.id) === String(id));

    const { configs, setConfigs, dispositivo, setDispositivo, cfg, patch, dirtyDevices, dirty, markClean } =
        useTabelaConfigs();
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useFeedback();
    const [confirmarSaida, setConfirmarSaida] = useState(false);

    // Carrega os três layouts ao abrir (não marca dirty — escreve direto no estado).
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
    }, [id, setConfigs]);

    const onSave = async () => {
        setSaving(true);
        try {
            const alterados = [...dirtyDevices];
            await Promise.all(alterados.map((d) => saveTabela(id, d, configs[d])));
            markClean();
            setFeedback({ tipo: "ok", texto: alterados.length > 1 ? t.tabelaEditor.tabelasSaved : t.tabelaEditor.tabelaSaved });
            return true;
        } catch {
            setFeedback({ tipo: "erro", texto: t.tabelaEditor.saveError });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleVoltar = () => { if (dirty) setConfirmarSaida(true); else navigate("/staff"); };
    const guardarESair = async () => { if (await onSave()) navigate("/staff"); else setConfirmarSaida(false); };
    const descartarESair = () => { setConfirmarSaida(false); navigate("/staff"); };

    if (!utente) {
        return <div className="min-h-screen flex items-center justify-center text-on-surface-variant font-body-md">{t.tabelaEditor.loadingUtente}</div>;
    }

    return (
        <>
            <TabelaEditor
                utenteNome={utente.nome}
                botoes={botoes}
                apiUrl={apiUrl}
                dispositivo={dispositivo}
                setDispositivo={setDispositivo}
                config={cfg}
                onPatch={patch}
                dirty={dirty}
                saving={saving}
                onSave={onSave}
                onVoltar={handleVoltar}
            />
            {confirmarSaida && (
                <Modal onClose={() => setConfirmarSaida(false)} className="max-w-sm p-5">
                    <h3 className="font-display-lg text-lg font-bold text-on-surface mb-1">{t.tabelaEditor.unsavedTitle}</h3>
                    <p className="text-staff-mono text-on-surface-variant mb-4">{t.tabelaEditor.unsavedBody}</p>
                    <div className="flex flex-col gap-2">
                        <button onClick={guardarESair} disabled={saving}
                            className="w-full py-2.5 rounded-full bg-primary text-on-primary font-staff-mono font-semibold hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-40">
                            {saving ? t.common.saving : t.tabelaEditor.saveAndExit}
                        </button>
                        <button onClick={descartarESair}
                            className="w-full py-2.5 rounded-full bg-error-container text-on-error-container font-staff-mono font-semibold hover:bg-error hover:text-on-error transition-colors">
                            {t.tabelaEditor.discardAndExit}
                        </button>
                        <button onClick={() => setConfirmarSaida(false)}
                            className="w-full py-2.5 rounded-full text-on-surface-variant font-staff-mono hover:bg-surface-container-high transition-colors">
                            {t.common.cancel}
                        </button>
                    </div>
                </Modal>
            )}
            <FeedbackToast feedback={feedback} />
        </>
    );
};

export default GerirTabela;
