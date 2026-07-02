import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../ContextProvider";
import { fetchTabelasPadrao } from "../../api/tabelasPadrao";
import UtenteForm from "./UtenteForm";

const NewUtente = () => {
    const navigate = useNavigate();
    const { postUtente } = useContext(Context);
    const [formData, setFormData] = useState({ nome: '', quarto: '', templateId: '' });
    const [templates, setTemplates] = useState([]);

    useEffect(() => {
        let vivo = true;
        fetchTabelasPadrao().then((d) => {
            if (!vivo || !Array.isArray(d)) return;
            setTemplates(d);
            setFormData((f) => (f.templateId ? f : { ...f, templateId: d[0]?.id ? String(d[0].id) : '' }));
        }).catch(() => {});
        return () => { vivo = false; };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await postUtente({
                nome: formData.nome, quarto: formData.quarto,
                templateId: formData.templateId ? Number(formData.templateId) : undefined,
            });
            navigate('/staff');
        } catch (error) { console.error("Error creating utente:", error); }
    };

    const handleCriarDoZero = async () => {
        if (!formData.nome.trim() || !formData.quarto.trim()) { window.alert("Preenche o nome e o quarto primeiro."); return; }
        try {
            const novo = await postUtente({ nome: formData.nome, quarto: formData.quarto }); // sem template → tabela vazia
            navigate(novo?.id ? `/gerir-tabela/${novo.id}` : '/staff');
        } catch (error) { console.error("Error creating utente:", error); }
    };

    return (
        <UtenteForm
            title="Novo Utente"
            formData={formData}
            setFormData={setFormData}
            templates={templates}
            onCriarNovo={handleCriarDoZero}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/staff')}
            submitLabel="Criar Utente"
            quartoRequired
        />
    );
};

export default NewUtente;
