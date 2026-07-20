import { useParams, useNavigate } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { Context } from "../ContextProvider";
import { staffLogout } from "../api/auth";
import { fetchTabela } from "../api/tabela";
import { idDoToken } from "../utils/utenteToken";
import { DISPOSITIVOS, isSOS, hasCells } from "../Components/tabela/constants";
import { useTipoDispositivo } from "../Components/tabela/useTipoDispositivo";
import GrelhaTabuleiro from "../Components/tabela/GrelhaTabuleiro";
import { useButtonById } from "../hooks/useButtonById";
import { useAlarmeEmergencia } from "../hooks/useAlarmeEmergencia";
import { PEDIDO_STATES } from "../constants";
import { t } from "../i18n";
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
        fetchUtente,
        fetchPedidosUtilizador,
        setStaffUnlocked,
        apiUrl,
    } = useContext(Context);
    const navigate = useNavigate();

    const SOS_BUTTON = botoes.find((b) => isSOS(b));
    const botaoPorId = useButtonById(botoes);

    const [isDrawerVisible, setDrawerVisible] = useState(false);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isPinVisible, setPinVisible] = useState(false);

    // Alarme sonoro enquanto houver uma emergência pendente deste utente.
    useAlarmeEmergencia(!!utente?.pedidos?.some((p) => p.emergencia));

    // Dispositivo pelo tamanho do ecrã, e layouts guardados deste utente por dispositivo.
    const dispositivo = useTipoDispositivo();
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

    // dispositivo do ecrã detetado; se vazio, o primeiro configurado; senão null (→ estado "sem tabela")
    const dispositivoAtivo = hasCells(configs[dispositivo])
        ? dispositivo
        : Object.keys(DISPOSITIVOS).find((k) => hasCells(configs[k])) || null;
    const configAtiva = dispositivoAtivo ? configs[dispositivoAtivo] : null;

    // Saída da gaiola: o PIN correto reabre o console de staff; cancelar/errar
    // mantém o utente no seu tabuleiro.
    const handleSairGaiola = () => {
        setStaffUnlocked(true);
        setPinVisible(false);
        navigate("/staff");
    };

    // Força dados frescos ao entrar nesta página — mesmo revisitando o mesmo utente. O
    // ContextProvider sobrevive à navegação da SPA, por isso `utente` pode já estar em
    // contexto (de uma visita anterior) com `pedidos` desatualizados; sem isto só um F5
    // os atualizava.
    useEffect(() => {
        setUtenteId(id);
        fetchUtente(id);
        fetchPedidosUtilizador(id);
    }, [id]);

    // Estar no tabuleiro = estar na "gaiola": fecha o gate de staff E limpa o
    // cookie do dispositivo — entrar no tabuleiro do utente revoga o acesso de
    // staff. Feito aqui (e não no StaffHome) para o guarda não redirecionar
    // durante a navegação. A partir daqui só se sai com o PIN (🛠 → PinPrompt).
    useEffect(() => {
        setStaffUnlocked(false);
        staffLogout().catch(() => {});
    }, []);

    const handleButtonClick = (button) => {
        new Audio("/Check-mark-ding-sound-effect.mp3").play().catch(() => {});
        showModalBriefly();
        postPedido({ emergencia: false, utenteId: utente.id, botaoId: button.id });
    };

    const handleButtonSOS = () => {
        showModalBriefly();
        // Alterna: se já existir uma emergência pendente deste utente, cancela-a; senão cria.
        const pedidoEmergencia = utente?.pedidos?.find(
            (p) => p.botaoId === SOS_BUTTON.id && p.emergencia && p.estado === PEDIDO_STATES.PENDING,
        );
        if (pedidoEmergencia) {
            updatePedido(pedidoEmergencia, PEDIDO_STATES.CANCELLED);
        } else {
            postPedido({ emergencia: true, utenteId: utente.id, botaoId: SOS_BUTTON.id });
        }
    };

    const cancelarTodosPedidos = () => {
        utente?.pedidos.forEach((pedido) => updatePedido(pedido, PEDIDO_STATES.CANCELLED));
    };

    const showModalBriefly = () => {
        setModalVisible(true);
        setTimeout(() => setModalVisible(false), 1000);
    };

    return (
        <div className="container-fluid p-2 d-flex flex-column" style={{ height: "100vh" }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-2">
                    <div style={{ position: "relative", display: "inline-block" }}>
                        <button
                            onClick={() => setDrawerVisible(true)}
                            className="btn-outline-light border d-flex align-items-center gap-2"
                            style={{ fontSize: "14px", padding: "8px 16px" }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                                list_alt
                            </span>
                            {t.tabuleiro.requestList}
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
                        <button className="btn btn-success fw-bold" onClick={cancelarTodosPedidos}>
                            {t.tabuleiro.imOk}
                        </button>
                    )}
                </div>
                <button
                    className="btn btn-outline-light text-muted border"
                    style={{ display: "flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setPinVisible(true)}
                    aria-label={t.tabuleiro.staffAccess}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        key
                    </span>
                    {t.tabuleiro.staff}
                </button>
            </div>

            {!carregado ? (
                <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
                    {t.common.loading}
                </div>
            ) : configAtiva ? (
                <GrelhaTabuleiro
                    config={configAtiva}
                    dispositivo={dispositivoAtivo}
                    botaoPorId={botaoPorId}
                    apiUrl={apiUrl}
                    onButtonClick={handleButtonClick}
                    onSOS={handleButtonSOS}
                />
            ) : (
                <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center text-muted">
                    <span className="material-symbols-outlined" style={{ fontSize: 48 }}>
                        grid_off
                    </span>
                    <p className="mt-3 mb-1 fw-bold">{t.tabuleiro.noTable}</p>
                    <p className="small">{t.tabuleiro.noTableHint}</p>
                </div>
            )}

            <SuccessModal visible={isModalVisible} onClose={() => setModalVisible(false)} />
            <RequestListDrawer
                visible={isDrawerVisible}
                onClose={() => setDrawerVisible(false)}
                utente={utente}
            />
            {isPinVisible && (
                <PinPrompt onSuccess={handleSairGaiola} onCancel={() => setPinVisible(false)} />
            )}
        </div>
    );
};

export default TabuleiroComunicacao;
