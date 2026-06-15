import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";

const EditBotoes = () => {
    const navigate = useNavigate();
    const { botoes, editBotao, deleteBotao, postBotao, apiUrl } = useContext(Context);
    const [selectedBotao, setSelectedBotao] = useState(null);
    const [mode, setMode] = useState("list"); // 'list', 'edit', 'new'
    const [formData, setFormData] = useState({
        nome: '',
        mensagem: '',
        categoria: '',
        imagem: ''
    });
    const [imagensDisponiveis, setImagensDisponiveis] = useState([]);
    const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([
        "Sinto-me",
        "Medicamentos",
        "Necessidades",
        "Tecnologias",
        "Chamar"
    ]);

    useEffect(() => {
        fetch(apiUrl + "/imagesBotoes")
            .then(res => res.json())
            .then(data => setImagensDisponiveis(data))
            .catch(err => {
                setImagensDisponiveis([]);
                console.error("Erro ao buscar imagens:", err);
            });
    }, [apiUrl]);

    const handleSelectBotao = (botao) => {
        setSelectedBotao(botao);
    };

    const handleEdit = () => {
        if (selectedBotao) {
            setFormData({
                nome: selectedBotao.nome,
                mensagem: selectedBotao.mensagem,
                categoria: selectedBotao.categoria,
                imagem: selectedBotao.imagem
            });
            setMode("edit");
        }
    };

    const handleNew = () => {
        setFormData({
            nome: '',
            mensagem: '',
            categoria: '',
            imagem: ''
        });
        setMode("new");
    };

    const handleDelete = async () => {
        if (selectedBotao) {
            if (window.confirm(`Tens certeza de eliminar o botão ${selectedBotao.nome}?`)) {
                await deleteBotao(selectedBotao.id);
                setSelectedBotao(null);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (mode === "edit") {
                await editBotao({ ...selectedBotao, ...formData });
            } else if (mode === "new") {
                await postBotao(formData);
            }
            setMode("list");
            setSelectedBotao(null);
        } catch (error) {
            console.error("Error saving botão:", error);
        }
    };

    const handleImageSelect = (img) => {
        setFormData({ ...formData, imagem: img });
    };

    const handleCancel = () => {
        setMode("list");
        setSelectedBotao(null);
    };

    if (mode === "edit" || mode === "new") {
        return (
            <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md">
                <header className="bg-surface dark:bg-inverse-surface top-0 sticky bg-surface-container-low dark:bg-surface-container shadow-sm z-30 border-b border-surface-variant">
                    <div className="flex items-center px-6 h-20 w-full max-w-7xl mx-auto gap-4">
                        <button onClick={handleCancel} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:opacity-80 transition-opacity flex items-center justify-center">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-inverse-primary">
                            {mode === "edit" ? "Editar Botão" : "Novo Botão"}
                        </h1>
                    </div>
                </header>

                <div className="p-6 md:p-12 flex-1 overflow-y-auto max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-variant flex flex-col gap-6">
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
                                        onClick={() => handleImageSelect(img)}
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
                                onClick={handleCancel}
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
                                <div className="w-24 h-24 mb-4 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center overflow-hidden shadow-sm transform group-hover:scale-105 transition-transform duration-300">
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
    }

    // LIST MODE
    return (
        <div className="bg-background text-on-background min-h-screen flex font-body-md">
            {/* SideNavBar */}
            <nav className="bg-surface dark:bg-inverse-surface h-screen w-72 left-0 top-0 fixed bg-surface-container dark:bg-surface-container-highest shadow-sm z-40 hidden md:block border-r border-surface-variant">
                <div className="flex flex-col h-full py-stack-md">
                    {/* Header/Profile */}
                    <div className="px-6 pb-6 mb-4 border-b border-surface-variant flex items-center gap-4">
                        <button onClick={() => navigate('/staff')} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:opacity-80 transition-opacity">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h2 className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary text-xl">Gestão de Botões</h2>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex-1 overflow-y-auto">
                        {/* More links can go here if needed */}
                    </div>

                    {/* Quick Actions Panel */}
                    <div className="px-4 pt-4 border-t border-surface-variant">
                        <h3 className="font-label-xl text-label-xl text-on-surface-variant mb-4 px-2 uppercase text-xs tracking-wider">Ações</h3>
                        <button 
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors mb-2 text-left ${selectedBotao ? 'text-primary hover:bg-surface-container' : 'text-outline opacity-50 cursor-not-allowed'}`}
                            onClick={handleEdit}
                            disabled={!selectedBotao}
                        >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            <span className="font-staff-mono text-staff-mono">Editar Botão</span>
                        </button>
                        <button 
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors mb-2 text-left ${selectedBotao ? 'text-error hover:bg-error-container hover:text-on-error-container' : 'text-outline opacity-50 cursor-not-allowed'}`}
                            onClick={handleDelete}
                            disabled={!selectedBotao}
                        >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            <span className="font-staff-mono text-staff-mono">Apagar Botão</span>
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-2 text-primary hover:bg-surface-container rounded-lg transition-colors mb-2 text-left" onClick={handleNew}>
                            <span className="material-symbols-outlined text-sm">add_circle</span>
                            <span className="font-staff-mono text-staff-mono">Novo Botão</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
                <header className="bg-surface dark:bg-inverse-surface top-0 sticky bg-surface-container-low dark:bg-surface-container shadow-sm z-30 border-b border-surface-variant">
                    <div className="flex justify-between items-center px-6 h-20 w-full">
                        <div className="flex-1">
                            <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-inverse-primary">InovLAR</h1>
                        </div>
                    </div>
                </header>

                <div className="p-6 md:p-12 flex-1 overflow-y-auto">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="font-display-lg text-3xl font-bold text-on-surface mb-2">Visão Geral dos Botões</h2>
                            <p className="font-body-lg text-body-lg text-on-surface-variant">Selecione um botão da lista ou adicione um novo.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {botoes.map((botao) => {
                            const isSelected = selectedBotao?.id === botao.id;
                            return (
                                <div 
                                    key={botao.id} 
                                    className={`bg-surface-container-lowest rounded-lg p-6 shadow-sm border ${isSelected ? 'border-primary ring-1 ring-primary shadow-md' : 'border-surface-variant'} hover:shadow-md transition-all cursor-pointer relative overflow-hidden group`}
                                    onClick={() => handleSelectBotao(botao)}
                                >
                                    <div className={`absolute top-0 left-0 w-full h-1 ${isSelected ? 'bg-primary' : 'bg-surface-variant'}`}></div>
                                    <div className="flex items-center flex-col text-center mt-4">
                                        <div className="w-20 h-20 mb-4 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center overflow-hidden border-2 border-surface-container shadow-sm transform group-hover:scale-105 transition-transform duration-300">
                                            <img
                                                src={apiUrl + (botao.imagem || "imagesBotoes/default.png")}
                                                alt={botao.nome}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <h3 className="font-headline-md text-xl font-bold text-on-surface mb-1 truncate w-full" title={botao.nome}>
                                            {botao.nome}
                                        </h3>
                                        <span className="mt-2 bg-surface-container text-on-surface-variant px-2 py-1 rounded text-xs font-staff-mono font-bold truncate max-w-full">
                                            {botao.categoria || 'Sem categoria'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default EditBotoes;