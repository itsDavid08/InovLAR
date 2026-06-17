import { useEffect, useState } from "react";
import { useContext } from "react";
import { Context } from "../ContextProvider";

const RequestListDrawer = ({ visible, onClose }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { pedidosUtilizador, apiUrl } = useContext(Context);
    const { updatePedido } = useContext(Context);

    useEffect(() => {
        setIsOpen(visible);
    }, [visible]);

    const handleClose = () => {
        setIsOpen(false);
        onClose();
    };

    const handleCancel = (pedido) => {
        updatePedido(pedido, "cancelado");
    };
    const handleDone = (pedido) => {
        updatePedido(pedido, "concluido");
    };

    // Definição da função para concluir todos os pedidos
    const resolveTodosPedidos = () => {
        pedidosUtilizador.forEach((pedido) => updatePedido(pedido, "concluido"));
    };

    return (
        <>
            <div className={`custom-drawer ${isOpen ? "open" : ""}`}>
                <div className="drawer-content">
                    <div className="drawer-header">
                        <h3>Lista de Pedidos</h3>
                        <button className="close-button" onClick={handleClose}>
                            ×
                        </button>
                    </div>
                    <div className="request-list">
                        {pedidosUtilizador.length > 0 && (
                            <button
                                style={{
                                    marginRight: "0px",
                                    marginLeft: "auto",
                                    marginBottom: "10px",
                                    padding: "10px 20px",
                                    background: "linear-gradient(90deg, #4caf50 0%, #43a047 100%)",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "25px",
                                    boxShadow: "0 2px 8px rgba(76, 175, 80, 0.2)",
                                    fontWeight: "bold",
                                    fontSize: "16px",
                                    cursor: "pointer",
                                    transition: "background 0.3s, transform 0.2s"
                                }}
                                onMouseOver={e => e.currentTarget.style.background = "linear-gradient(90deg, #43a047 0%, #388e3c 100%)"}
                                onMouseOut={e => e.currentTarget.style.background = "linear-gradient(90deg, #4caf50 0%, #43a047 100%)"}
                                onClick={resolveTodosPedidos}
                            >
                                Concluir todos os pedidos
                            </button>
                        )}
                        {pedidosUtilizador.map((item) => (
                            <div key={item.id} className="request-item">
                                <img
                                    src={apiUrl+(item.botao.imagem || '/imagesBotoes/default.png')}
                                    alt={item.botao.nome}
                                    className="request-icon"
                                />
                                <span className="request-text">
                                    {item.botao.mensagem}
                                </span>
                                <div className="request-actions">
                                    <button className="action-button done" onClick={() => handleDone(item)}>
                                        ✔️
                                    </button>
                                    <button className="action-button cancel" onClick={() => handleCancel(item)}>
                                        ❌
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {isOpen && <div className="drawer-overlay" onClick={handleClose} />}
        </>
    );
};

export default RequestListDrawer;