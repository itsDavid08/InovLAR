import { useContext, useEffect, useState } from "react";
import { Context } from "../../ContextProvider";
import { fetchImagensBotoes } from "../../api/botoes";
import BotoesList from "./BotoesList";
import BotaoForm from "./BotaoForm";

// Editor de botões. Container: detém o estado e a lógica e decide qual layout
// mostrar — BotoesList (selecionar) ou BotaoForm (criar/editar).
const EditBotoes = () => {
    const { botoes, editBotao, deleteBotao, postBotao, apiUrl } = useContext(Context);
    const [selectedBotao, setSelectedBotao] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [mode, setMode] = useState("list"); // 'list', 'edit', 'new'
    const [formData, setFormData] = useState({
        nome: '',
        mensagem: '',
        categoria: '',
        imagem: ''
    });
    const [imagensDisponiveis, setImagensDisponiveis] = useState([]);
    const [categoriasDisponiveis] = useState([
        "Sinto-me",
        "Medicamentos",
        "Necessidades",
        "Tecnologias",
        "Chamar"
    ]);

    useEffect(() => {
        fetchImagensBotoes()
            .then(data => setImagensDisponiveis(data))
            .catch(err => {
                setImagensDisponiveis([]);
                console.error("Erro ao buscar imagens:", err);
            });
    }, [apiUrl]);

    const handleEdit = (botao) => {
        setSelectedBotao(botao); // ainda usado no handleSubmit (edit usa {...selectedBotao, ...formData})
        setFormData({
            nome: botao.nome,
            mensagem: botao.mensagem,
            categoria: botao.categoria,
            imagem: botao.imagem
        });
        setMode("edit");
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

    const handleDelete = async (botao) => {
        if (window.confirm(`Tens certeza de eliminar o botão ${botao.nome}?`)) {
            await deleteBotao(botao.id);
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
            <BotaoForm
                mode={mode}
                formData={formData}
                setFormData={setFormData}
                selectedBotao={selectedBotao}
                imagensDisponiveis={imagensDisponiveis}
                categoriasDisponiveis={categoriasDisponiveis}
                apiUrl={apiUrl}
                onSubmit={handleSubmit}
                onImageSelect={handleImageSelect}
                onCancel={handleCancel}
            />
        );
    }

    return (
        <BotoesList
            botoes={botoes}
            apiUrl={apiUrl}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNew={handleNew}
        />
    );
};

export default EditBotoes;
