import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { utenteBind } from "../api/auth";

// Ecrã (só-staff) para vincular ESTE tablet a um utente — "Modo Quarto".
// Tocar num utente vincula o dispositivo e abre logo o ecrã desse utente.
export default function BindUtente() {
    const { utentes } = useContext(Context);
    const navigate = useNavigate();

    const handleBind = async (utente) => {
        const { ok } = await utenteBind(utente.id);
        if (ok) navigate(`/main/${utente.id}`, { replace: true });
    };

    return (
        <div className="home-container staff">
            <h1>Escolha o utente deste tablet</h1>
            <div className="utentes-grid">
                {utentes.length === 0 && (
                    <p style={{ color: "white" }}>
                        Ainda não há utentes. Crie um primeiro em Staff → Novo.
                    </p>
                )}
                {utentes.map((utente) => (
                    <div
                        key={utente.id}
                        className="utente-card"
                        onClick={() => handleBind(utente)}
                    >
                        <div className="initials-circle">
                            {utente.nome.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <h3>{utente.nome}</h3>
                        {utente.quarto && (
                            <p style={{ margin: 0, color: "#666" }}>Quarto {utente.quarto}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="action-sidebar">
                <button
                    className="sidebar-button"
                    style={{ marginTop: "auto", marginBottom: "30px" }}
                    onClick={() => navigate("/staff")}
                >
                    Voltar
                </button>
            </div>
        </div>
    );
}
