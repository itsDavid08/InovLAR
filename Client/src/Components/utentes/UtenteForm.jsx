// Formulário partilhado de utente (criar/editar) + pré-visualização ao vivo.
// Presentacional: os dados e a submissão vivem nos wrappers EditUtente/NewUtente.
// Mesmo layout do BotaoForm: header com voltar + form|preview lado a lado. Em
// mobile (flex-col-reverse) a pré-visualização fica em cima e o formulário por
// baixo; em desktop (lg:flex-row) form à esquerda, preview à direita.
const UtenteForm = ({
    title,
    formData,
    setFormData,
    onSubmit,
    onCancel,
    submitLabel,
    quartoRequired = false,
    hiddenId,
}) => {
    // Iniciais para o avatar do cartão (igual ao cartão do StaffHome).
    const iniciais = (formData.nome || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md">
            <header className="bg-surface dark:bg-inverse-surface top-0 sticky bg-surface-container-low dark:bg-surface-container shadow-sm z-30 border-b border-surface-variant">
                <div className="flex items-center px-6 h-20 w-full max-w-7xl mx-auto gap-4">
                    <button onClick={onCancel} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:opacity-80 transition-opacity flex items-center justify-center">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-inverse-primary">
                        {title}
                    </h1>
                </div>
            </header>

            <div className="p-6 md:p-12 flex-1 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col-reverse lg:flex-row gap-8 items-start">
                <form onSubmit={onSubmit} className="w-full lg:flex-1 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-variant flex flex-col gap-6">
                    {hiddenId !== undefined && (
                        <input type="hidden" value={hiddenId} readOnly />
                    )}

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Nome
                        </label>
                        <input
                            type="text"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                            placeholder="Nome do utente"
                        />
                    </div>

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Quarto
                        </label>
                        <input
                            type="text"
                            value={formData.quarto || ''}
                            onChange={(e) => setFormData({ ...formData, quarto: e.target.value })}
                            required={quartoRequired}
                            className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                            placeholder="Ex.: A112"
                        />
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-surface-variant">
                        <button
                            type="submit"
                            className="flex-1 bg-primary text-on-primary py-3 rounded-full font-staff-mono text-staff-mono font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm"
                        >
                            {submitLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-surface-container-high text-on-surface py-3 rounded-full font-staff-mono text-staff-mono font-bold hover:bg-surface-variant transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>

                {/* Preview — flex-col-reverse põe-a em cima em mobile; lg:flex-row à direita em desktop.
                    (Não usar order-*: o Tailwind Play CDN não deixa lg:order-* sobrepor o order-* base.) */}
                <div className="w-full lg:flex-1 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-variant flex flex-col items-center">
                    <h2 className="font-display-lg text-2xl font-bold text-on-surface mb-6 w-full underline decoration-primary decoration-4 underline-offset-8">Pré-visualização</h2>

                    <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-surface-variant hover:shadow-md hover:border-primary transition-all relative overflow-hidden group w-full max-w-sm">
                        <div className="absolute top-0 left-0 w-full h-1 bg-status-green"></div>
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-display-lg text-[24px] border-2 border-surface-container">
                                {iniciais || "?"}
                            </div>
                            <div className="px-2 py-1 rounded text-xs font-staff-mono font-bold text-status-green flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Estável
                            </div>
                        </div>
                        <h3 className="font-body-xl text-body-xl font-semibold text-on-surface mb-1 truncate" title={formData.nome || "Nome"}>
                            {formData.nome || "Nome do utente"}
                        </h3>
                        <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">meeting_room</span>
                            {formData.quarto || "Quarto"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UtenteForm;
