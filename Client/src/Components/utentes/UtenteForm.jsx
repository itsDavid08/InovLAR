// Formulário partilhado de utente (criar/editar). Presentacional: os dados e a
// submissão vivem nos wrappers EditUtente / NewUtente.
const UtenteForm = ({
    title,
    containerClass,
    formData,
    setFormData,
    onSubmit,
    onCancel,
    submitLabel,
    quartoRequired = false,
    hiddenId,
}) => {
    return (
        <div className={containerClass}>
            <h1>{title}</h1>
            <form onSubmit={onSubmit}>
                {hiddenId !== undefined && (
                    <input type="hidden" value={hiddenId} readOnly />
                )}
                <label>
                    Nome:
                    <input
                        type="text"
                        value={formData.nome}
                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                        required
                    />
                </label>
                <label>
                    Quarto:
                    <input
                        type="text"
                        value={formData.quarto || ''}
                        onChange={e => setFormData({ ...formData, quarto: e.target.value })}
                        required={quartoRequired}
                    />
                </label>
                <button type="submit">{submitLabel}</button>
                <button type="button" onClick={onCancel}>Cancelar</button>
            </form>
        </div>
    );
};

export default UtenteForm;
