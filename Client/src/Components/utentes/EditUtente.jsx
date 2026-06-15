import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../../ContextProvider";
import UtenteForm from "./UtenteForm";

const EditUtente = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { utentes, editUtente } = useContext(Context);
    const [utente, setUtente] = useState(null);
    const [formData, setFormData] = useState({ nome: '', quarto: '' });

    useEffect(() => {
        const foundUtente = utentes.find(u => u.id === parseInt(id));
        if (foundUtente) {
            setUtente(foundUtente);
            setFormData({
                nome: foundUtente.nome,
                quarto: foundUtente.quarto || ''
            });
        } else {
            navigate('/');
        }
    }, [id, utentes, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await editUtente({ ...utente, ...formData });
            navigate('/staff');
        } catch (error) {
            console.error("Error updating utente:", error);
        }
    };

    if (!utente) return <div>Loading...</div>;

    return (
        <UtenteForm
            title="Editar Utente"
            containerClass="edit-container"
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/staff')}
            submitLabel="Atualizar Utente"
            hiddenId={utente.id}
        />
    );
};

export default EditUtente;
