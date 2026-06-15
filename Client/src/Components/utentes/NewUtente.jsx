import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../ContextProvider";
import UtenteForm from "./UtenteForm";

const NewUtente = () => {
    const navigate = useNavigate();
    const { postUtente } = useContext(Context);
    const [formData, setFormData] = useState({ nome: '', quarto: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            postUtente(formData);
            navigate('/staff');
        } catch (error) {
            console.error("Error creating utente:", error);
        }
    };

    return (
        <UtenteForm
            title="Novo Utente"
            containerClass="new-container"
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/staff')}
            submitLabel="Criar Utente"
            quartoRequired
        />
    );
};

export default NewUtente;
