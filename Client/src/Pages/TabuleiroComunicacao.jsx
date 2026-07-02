import { useParams, useNavigate } from "react-router-dom";
import { useContext, useEffect, useState, useRef, useMemo } from "react";
import { Context } from "../ContextProvider";
import { staffLogout } from "../api/auth";
import { fetchTabela } from "../api/tabela";
import { idDoToken } from "../utils/utenteToken";
import { DISPOSITIVOS } from "../Components/tabela/constants";
import RequestListDrawer from "../Components/RequestListDrawer.jsx";
import SuccessModal from "../Components/SuccessModal.jsx";
import PinPrompt from "../Components/PinPrompt.jsx";

const TabuleiroComunicacao = () => {
    const { token } = useParams();
    const id = idDoToken(token);
    const {
        utente,
        botoes,
        postPedido,
        updatePedido,
        setUtenteId,
        setStaffUnlocked,
        apiUrl,
    } = useContext(Context);
    const audioRef = useRef(null);

    const SOS_BUTTON = botoes.find((b) => b.nome === "SOS");

    const [isDrawerVisible, setDrawerVisible] = useState(false);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isPinVisible, setPinVisible] = useState(false);
    const navigate = useNavigate();

    const botaoPorId = useMemo(
        () => Object.fromEntries(botoes.map((b) => [b.id, b])),
        [botoes],
    );

    // Dispositivo pelo tamanho do ecrã (responsivo)
    const tipoDispositivo = () => {
        const w = window.innerWidth;
        return w < 600 ? "smartphone" : w < 1024 ? "tablet" : "pc";
    };
    const [dispositivo, setDispositivo] = useState(tipoDispositivo);
    useEffect(() => {
        const onResize = () => setDispositivo(tipoDispositivo());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Layouts guardados deste utente, por dispositivo
    const [configs, setConfigs] = useState({});
    const [carregado, setCarregado] = useState(false);
    useEffect(() => {
        let vivo = true;
        Promise.all(
            Object.keys(DISPOSITIVOS).map(async (d) => [
                d,
                await fetchTabela(id, d).catch(() => null),
            ]),
        ).then((entradas) => {
            if (vivo) {
                setConfigs(Object.fromEntries(entradas));
                setCarregado(true);
            }
        });
        return () => {
            vivo = false;
        };
    }, [id]);

    const temCells = (c) =>
        c && Array.isArray(c.cells) && c.cells.some((v) => v != null);
    // dispositivo do ecrã detetado; se vazio, o primeiro configurado; senão null (→ estado "sem tabela")
    const dispositivoAtivo = temCells(configs[dispositivo])
        ? dispositivo
        : Object.keys(DISPOSITIVOS).find((k) => temCells(configs[k])) || null;
    const configAtiva = dispositivoAtivo ? configs[dispositivoAtivo] : null;

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
        const existeEmergencia = utente?.pedidos?.some((p) => p.emergencia);
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
            (p) =>
                p.botaoId === SOS_BUTTON.id &&
                p.emergencia &&
                p.estado === "pendente",
        );

        if (pedidoEmergencia) {
            // Cancela o pedido de emergência existente
            updatePedido(
                { ...pedidoEmergencia, estado: "cancelado" },
                "cancelado",
            );
        } else {
            // Cria novo pedido de emergência
            const novoPedido = {
                emergencia: true,
                utenteId: utente.id,
                botaoId: SOS_BUTTON.id,
            };
            postPedido(novoPedido);
        }
    };

    const cancelarTodosPedidos = () => {
        utente?.pedidos.forEach((pedido) => updatePedido(pedido, "cancelado"));
    };

    const showDrawer = () => setDrawerVisible(true);
    const hideDrawer = () => setDrawerVisible(false);
    const showModal = () => setModalVisible(true);
    const hideModal = () => setModalVisible(false);

    const overlays = (
        <>
            <SuccessModal visible={isModalVisible} onClose={hideModal} />
            <RequestListDrawer
                visible={isDrawerVisible}
                onClose={hideDrawer}
                utente={utente}
            />
            {isPinVisible && (
                <PinPrompt
                    onSuccess={handleSairGaiola}
                    onCancel={() => setPinVisible(false)}
                />
            )}
        </>
    );

    const renderTabela = (config, disp) => {
        const cols = config.cols || 4;
        const cells = config.cells || [];
        const [aspW, aspH] = (DISPOSITIVOS[disp]?.aspect || "16 / 10")
            .split("/")
            .map((n) => parseFloat(n));
        const lastFilled = cells.reduce((m, v, i) => (v != null ? i : m), -1);
        // mesmas linhas que o editor (geométrico) → reproduz o desenho, não estica os botões
        const rows = Math.max(
            Math.round((cols * aspH) / aspW),
            Math.ceil((lastFilled + 1) / cols),
            1,
        );
        const slots = rows * cols;
        return (
            <div
                className="flex-grow-1"
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    gap: "1%",
                    minHeight: 0,
                }}
            >
                {Array.from({ length: slots }).map((_, i) => {
                    const b = botaoPorId[cells[i]];
                    if (!b)
                        return (
                            <div
                                key={i}
                                className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low"
                            />
                        );
                    const isSOS = b.categoria === "SOS" || b.nome === "SOS";
                    return (
                        <button
                            key={i}
                            onClick={() =>
                                isSOS ? handleButtonSOS() : handleButtonClick(b)
                            }
                            aria-label={b.nome}
                            className={`btn d-flex flex-column align-items-center justify-content-center rounded overflow-hidden ${isSOS ? "btn-danger" : "btn-light border border-secondary"}`}
                            style={{ minHeight: 0, padding: "2%" }}
                        >
                            <img
                                src={
                                    apiUrl +
                                    (b.imagem || "/imagesBotoes/default.png")
                                }
                                alt={b.nome}
                                style={{
                                    flex: "1 1 0",
                                    minHeight: 0,
                                    maxWidth: "100%",
                                    objectFit: "contain",
                                }}
                            />
                            <span
                                className="fw-bold text-center text-truncate w-100"
                                style={{ fontSize: "min(2.5vw, 16px)" }}
                            >
                                {b.nome}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            className="container-fluid p-2 d-flex flex-column"
            style={{ height: "100vh" }}
        >
            <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-2">
                    <div
                        style={{
                            position: "relative",
                            display: "inline-block",
                        }}
                    >
                        <button
                            onClick={showDrawer}
                            className="btn-outline-light border d-flex align-items-center gap-2"
                            style={{ fontSize: "14px", padding: "8px 16px" }}
                        >
                            <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "20px" }}
                            >
                                list_alt
                            </span>
                            Lista de Pedidos
                        </button>
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
                                }}
                            />
                        )}
                    </div>
                    {utente?.pedidos?.length > 0 && (
                        <button
                            className="btn btn-success fw-bold"
                            onClick={cancelarTodosPedidos}
                        >
                            Estou Bem
                        </button>
                    )}
                </div>
                <button
                    className="btn btn-outline-light text-muted border"
                    style={{ display: "flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setPinVisible(true)}
                    aria-label="Acesso staff"
                >
                    <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "20px" }}
                    >
                        key
                    </span>
                    Staff
                </button>
            </div>

            {!carregado ? (
                <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
                    A carregar…
                </div>
            ) : configAtiva ? (
                renderTabela(configAtiva, dispositivoAtivo)
            ) : (
                <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center text-muted">
                    <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 48 }}
                    >
                        grid_off
                    </span>
                    <p className="mt-3 mb-1 fw-bold">Sem tabela configurada</p>
                    <p className="small">
                        Peça ao staff para configurar a tabela deste utente.
                    </p>
                </div>
            )}

            {overlays}
        </div>
    );
};

export default TabuleiroComunicacao;
