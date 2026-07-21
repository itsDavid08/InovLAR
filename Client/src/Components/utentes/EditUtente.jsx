import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../../ContextProvider";
import { uploadImagemUtente, deleteImagemUtente } from "../../api/utentes";
import UtenteForm from "./UtenteForm";
import { ICONE_PESSOA } from "./UtenteAvatar";
import { t } from "../../i18n";

const EditUtente = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { utentes, editUtente, apiUrl } = useContext(Context);
    const [utente, setUtente] = useState(null);
    const [formData, setFormData] = useState({ nome: '', quarto: '', imagem: '', corAvatar: '' });

    useEffect(() => {
        const foundUtente = utentes.find(u => u.id === parseInt(id));
        if (foundUtente) {
            setUtente(foundUtente);
            setFormData({
                nome: foundUtente.nome,
                quarto: foundUtente.quarto || '',
                imagem: foundUtente.imagem || '',
                corAvatar: foundUtente.corAvatar || ''
            });
        } else {
            navigate('/');
        }
    }, [id, utentes, navigate]);

    const handleUploadFoto = async (file) => {
        try {
            const { path } = await uploadImagemUtente(file, formData.imagem); // substitui a anterior (se pessoal)
            setFormData(prev => ({ ...prev, imagem: path }));
        } catch (err) {
            console.error("Erro ao carregar foto:", err);
            window.alert(t.utentes.photoUploadError);
        }
    };

    const handleRemoverFoto = async () => {
        // Só apaga do disco se for uma foto pessoal (um caminho, não o ícone/iniciais).
        const atual = formData.imagem;
        setFormData(prev => ({ ...prev, imagem: '' }));
        if (atual && atual !== ICONE_PESSOA) {
            try { await deleteImagemUtente(atual); } catch (err) { console.error("Erro ao remover foto:", err); }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await editUtente({ ...utente, ...formData });
            navigate('/staff');
        } catch (error) {
            console.error("Error updating utente:", error);
        }
    };

    if (!utente) return <div>{t.common.loading}</div>;

    return (
        <UtenteForm
            title={t.utentes.editTitle}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/staff')}
            submitLabel={t.utentes.updateSubmit}
            hiddenId={utente.id}
            apiUrl={apiUrl}
            onUploadFoto={handleUploadFoto}
            onRemoverFoto={handleRemoverFoto}
        />
    );
};

export default EditUtente;
