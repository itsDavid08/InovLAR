// Layout "criar/editar botão" do editor de botões: formulário + pré-visualização.
// Componente presentacional — todo o estado e a lógica vivem em EditBotoes.
const BotaoForm = ({
    mode,
    formData,
    setFormData,
    selectedBotao,
    imagensDisponiveis,
    categoriasDisponiveis,
    apiUrl,
    onSubmit,
    onImageSelect,
    onCancel,
}) => {
    return (
        <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md">
            <header className="bg-surface dark:bg-inverse-surface top-0 sticky bg-surface-container-low dark:bg-surface-container shadow-sm z-30 border-b border-surface-variant">
                <div className="flex items-center px-6 h-20 w-full max-w-7xl mx-auto gap-4">
                    <button onClick={onCancel} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:opacity-80 transition-opacity flex items-center justify-center">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-inverse-primary">
                        {mode === "edit" ? "Editar Botão" : "Novo Botão"}
                    </h1>
                </div>
            </header>

            <div className="p-6 md:p-12 flex-1 overflow-y-auto max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <form onSubmit={onSubmit} className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-variant flex flex-col gap-6">
                    {mode === "edit" && <input type="hidden" value={selectedBotao?.id} readOnly />}

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Nome
                        </label>
                        <input
                            type="text"
                            value={formData.nome}
                            onChange={e => setFormData({ ...formData, nome: e.target.value })}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                            placeholder="Nome do Botão"
                        />
                    </div>

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Mensagem
                        </label>
                        <input
                            type="text"
                            value={formData.mensagem}
                            onChange={e => setFormData({ ...formData, mensagem: e.target.value })}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                            placeholder="Mensagem a enviar..."
                        />
                    </div>

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Categoria
                        </label>
                        <input
                            type="text"
                            list="categorias-lista"
                            value={formData.categoria}
                            onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                            placeholder="Selecione ou escreva uma categoria"
                        />
                        <datalist id="categorias-lista">
                            {categoriasDisponiveis.map((cat, index) => (
                                <option key={index} value={cat} />
                            ))}
                        </datalist>
                    </div>

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Imagem
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-64 overflow-y-auto p-2 bg-surface-container rounded-lg border border-outline-variant">
                            {imagensDisponiveis.map((img, index) => (
                                <img
                                    key={index}
                                    src={apiUrl + img}
                                    alt={`Opção ${index}`}
                                    className={`w-full aspect-square object-cover rounded-lg cursor-pointer transition-all ${formData.imagem === img ? 'ring-4 ring-primary scale-95 shadow-md' : 'hover:scale-105 shadow-sm'}`}
                                    onClick={() => onImageSelect(img)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-surface-variant">
                        <button
                            type="submit"
                            className="flex-1 bg-primary text-on-primary py-3 rounded-full font-staff-mono text-staff-mono font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm"
                        >
                            {mode === "edit" ? "Atualizar Botão" : "Criar Botão"}
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

                {/* Preview Area */}
                <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-variant flex flex-col items-center">
                    <h2 className="font-display-lg text-2xl font-bold text-on-surface mb-6 w-full underline decoration-primary decoration-4 underline-offset-8">Pré-visualização</h2>

                    <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-surface-variant hover:shadow-md hover:border-primary transition-all relative overflow-hidden group w-full max-w-sm text-center">
                        <div className="flex items-center flex-col text-center mt-4">
                            <div className="w-24 h-24 mb-4 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center overflow-hidden shadow-sm transform group-hover:scale-105 transition-transform duration-300">
                                <img
                                    src={apiUrl + (formData.imagem || (imagensDisponiveis.length > 0 ? imagensDisponiveis[0] : "imagesBotoes/default.png"))}
                                    alt={formData.nome}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h3 className="font-headline-md text-2xl font-bold text-on-surface mb-1 truncate w-full" title={formData.nome || "Nome"}>
                                {formData.nome || "Nome do Botão"}
                            </h3>
                            <p className="font-body-md text-body-md text-on-surface-variant mb-2 truncate w-full">
                                {formData.mensagem || "Mensagem do botão"}
                            </p>
                            <span className="mt-2 bg-tertiary-container text-on-tertiary-container px-3 py-1 rounded-full text-xs font-staff-mono font-bold">
                                {formData.categoria || "Categoria"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BotaoForm;
