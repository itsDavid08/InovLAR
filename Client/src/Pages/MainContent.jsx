import { useParams, useNavigate } from "react-router-dom";
import { useContext, useEffect, useState, useRef } from "react";
import { Context } from "../ContextProvider";
import { staffLogout } from "../api/auth";
import RequestListDrawer from "../Components/RequestListDrawer.jsx";
import SuccessModal from "../Components/SuccessModal.jsx";
import PinPrompt from "../Components/PinPrompt.jsx";

const MainContent = () => {
    const { id } = useParams();
    const { utente, botoes, postPedido, updatePedido, setUtenteId, setStaffUnlocked, apiUrl } = useContext(Context);
    const audioRef = useRef(null);

    const botoesSintoMe = botoes.filter(b => b.categoria === "Sinto-me");
    const botoesNecessidades = botoes.filter(b => b.categoria === "Necessidades");
    const botoesTecnologias = botoes.filter(b => b.categoria === "Tecnologias");
    const botoesChamar = botoes.filter(b => b.categoria === "Chamar");
    const SOS_BUTTON = botoes.find(b => b.nome === "SOS");

    const [isDrawerVisible, setDrawerVisible] = useState(false);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isPinVisible, setPinVisible] = useState(false);
    const navigate = useNavigate();

    // Saída da gaiola: o PIN correto reabre o console de staff; cancelar/errar
    // mantém o utente no seu tabuleiro.
    const handleSairGaiola = () => {
        setStaffUnlocked(true);
        setPinVisible(false);
        navigate("/staff");
    };

    useEffect(() => {
        if (!utente || utente.id !== id) setUtenteId(id);
    }, [id]);

    // Estar no tabuleiro = estar na "gaiola": fecha o gate de staff E limpa o
    // cookie do dispositivo — entrar no tabuleiro do utente revoga o acesso de
    // staff. Feito aqui (e não no StaffHome) para o guarda não redirecionar
    // durante a navegação. A partir daqui só se sai com o PIN (🛠 → PinPrompt).
    useEffect(() => {
        setStaffUnlocked(false);
        staffLogout().catch(() => {});
    }, []);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio("/Warning-alarm-tone.mp3");
            audioRef.current.loop = true;
        }
        const existeEmergencia = utente?.pedidos?.some(p => p.emergencia);
        if (existeEmergencia) {
            audioRef.current.play().catch(() => {});
        } else {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    });

    const handleButtonClick = (button) => {

        const audio = new Audio("/Check-mark-ding-sound-effect.mp3");
        audio.play().catch(() => {});
        showModal();
        setTimeout(() => hideModal(), 1000);
        const novoPedido = {
            emergencia: false,
            utenteId: utente.id,
            botaoId: button.id,
        };
        postPedido(novoPedido);
    };

    const handleButtonSOS = () => {
        showModal();
        setTimeout(() => hideModal(), 1000);

        // Verifica se já existe um pedido de emergência pendente para este utente e botão
        const pedidoEmergencia = utente?.pedidos?.find(
            p => p.botaoId === SOS_BUTTON.id && p.emergencia && p.estado === "pendente"
        );

        if (pedidoEmergencia) {
            // Cancela o pedido de emergência existente
            updatePedido({ ...pedidoEmergencia, estado: "cancelado" }, "cancelado");
        } else {
            // Cria novo pedido de emergência
            const novoPedido = {
                emergencia: true,
                utenteId: utente.id,
                botaoId: SOS_BUTTON.id,
            };
            postPedido(novoPedido);
        }
    }

    const cancelarTodosPedidos = () => {
        utente?.pedidos.forEach((pedido) => updatePedido(pedido, "cancelado"));
    };


    const showDrawer = () => setDrawerVisible(true);
    const hideDrawer = () => setDrawerVisible(false);
    const showModal = () => setModalVisible(true);
    const hideModal = () => setModalVisible(false);

    // fixedHeight controla se a seção terá altura fixa ou não
    const renderSection = (title, buttons, bgColor, borderColor, fixedHeight = false) => (
        <div className="card mb-3 h-100" style={{ backgroundColor: bgColor, borderColor: borderColor, borderWidth: "2px" }}>
            <div className="card-header text-center fw-bold" style={{ borderColor }}>{title}</div>
            <div
                className="card-body p-2 d-flex flex-row flex-wrap gap-2 justify-content-center align-items-stretch"
                style={{ height: "auto" }}
            >
                {buttons.map((button) => (
                    <button
                        key={button.id}
                        className="btn btn-light d-flex flex-column align-items-center justify-content-center border border-secondary rounded"
                        onClick={() => handleButtonClick(button)}
                        aria-label={button.nome}
                        style={{ minWidth: 100, minHeight: 100, height: "16vh", maxHeight: 120, flex: "1 1 0" }}
                    >
                        <img src={apiUrl + (button.imagem || '/imagesBotoes/default.png')} alt={button.nome} style={{ maxWidth: "50px", maxHeight: "50px" }} />
                        <span className="fw-bold mt-2 text-center">{button.nome}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="container-fluid p-2 d-flex flex-column justify-content-center" style={{ minHeight: "100vh" }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                    {utente?.pedidos?.length > 0 && (
                        <button
                            className="btn btn-success mb-1"
                            style={{ fontWeight: "bold", minWidth: 90 }}
                            onClick={cancelarTodosPedidos}
                        >
                            Estou Bem
                        </button>
                    )}
                    <div style={{ position: "relative", display: "inline-block" }}>
                        <button className="btn btn-outline-dark" onClick={showDrawer}>☰</button>
                        {utente?.pedidos?.length > 0 && (
                            <span
                                style={{
                                    position: "absolute",
                                    top: 2,
                                    right: 2,
                                    width: 12,
                                    height: 12,
                                    background: "red",
                                    borderRadius: "50%",
                                    border: "2px solid white",
                                    zIndex: 1,
                                    display: "block"
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="flex-grow-1 mx-2">
                    {renderSection("Sinto-me", botoesSintoMe, "#FFF9C4", "#FFD700")}
                </div>
                <button className="btn btn-outline-light text-muted border-0" style={{ opacity: 0.4 }} onClick={() => setPinVisible(true)} aria-label="Acesso staff">🛠</button>
            </div>

            <div className="d-flex gap-2 align-items-stretch">
                <div
                    className="d-flex flex-column h-100"
                    style={{ flexGrow: botoesNecessidades.length, minWidth: 0 }}
                >
                    {renderSection("Necessidades", botoesNecessidades, "#EFEBE9", "#D7CCC8", false)}
                </div>
                <div
                    className="d-flex flex-column h-100"
                    style={{ flexGrow: botoesTecnologias.length, minWidth: 0 }}
                >
                    {renderSection("Tecnologias", botoesTecnologias, "#E1F5FE", "#B3E5FC", false)}
                </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-1">
                <button
                    className="btn btn-danger fw-bold"
                    style={{ width: "100px", height: "100px", fontSize: "20px" }}
                    onClick={() => handleButtonSOS()}
                >
                    SOS
                </button>

                <div className="flex-grow-1 mx-2">
                    {renderSection("Quero chamar...", botoesChamar, "#FFE0B2", "#FFCC80")}
                </div>

                <button
                    className="btn btn-danger fw-bold"
                    style={{ width: "100px", height: "100px", fontSize: "20px" }}
                    onClick={() => handleButtonSOS()}
                >
                    SOS
                </button>
            </div>

            <SuccessModal visible={isModalVisible} onClose={hideModal} />
            <RequestListDrawer visible={isDrawerVisible} onClose={hideDrawer} utente={utente} />
            {isPinVisible && (
                <PinPrompt
                    onSuccess={handleSairGaiola}
                    onCancel={() => setPinVisible(false)}
                />
            )}
        </div>
    );
};

export default MainContent;