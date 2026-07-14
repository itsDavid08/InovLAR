import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../ContextProvider";
import { fetchTabelasPadrao } from "../../api/tabelasPadrao";
import { uploadImagemUtente, deleteImagemUtente } from "../../api/utentes";
import UtenteForm from "./UtenteForm";
import { ICONE_PESSOA } from "./UtenteAvatar";

const NewUtente = () => {
    const navigate = useNavigate();
    const { postUtente, apiUrl } = useContext(Context);
    const [formData, setFormData] = useState({ nome: '', quarto: '', templateId: '', imagem: '', corAvatar: '' });
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

    const handleUploadFoto = async (file) => {
        try {
            const { path } = await uploadImagemUtente(file, formData.imagem);
            setFormData(prev => ({ ...prev, imagem: path }));
        } catch (err) {
            console.error("Erro ao carregar foto:", err);
            window.alert("Não foi possível carregar a foto. Verifique que é um ficheiro de imagem válido.");
        }
    };

    const handleRemoverFoto = async () => {
        const atual = formData.imagem;
        setFormData(prev => ({ ...prev, imagem: '' }));
        if (atual && atual !== ICONE_PESSOA) {
            try { await deleteImagemUtente(atual); } catch (err) { console.error("Erro ao remover foto:", err); }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await postUtente({
                nome: formData.nome, quarto: formData.quarto,
                imagem: formData.imagem || null, corAvatar: formData.corAvatar || null,
                templateId: formData.templateId ? Number(formData.templateId) : undefined,
            });
            navigate('/staff');
        } catch (error) { console.error("Error creating utente:", error); }
    };

    const handleCriarDoZero = async () => {
        if (!formData.nome.trim() || !formData.quarto.trim()) { window.alert("Preenche o nome e o quarto primeiro."); return; }
        try {
            const novo = await postUtente({
                nome: formData.nome, quarto: formData.quarto,
                imagem: formData.imagem || null, corAvatar: formData.corAvatar || null,
            }); // sem template → tabela vazia
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
            apiUrl={apiUrl}
            onUploadFoto={handleUploadFoto}
            onRemoverFoto={handleRemoverFoto}
        />
    );
};

export default NewUtente;
