import { useNavigate } from "react-router-dom";

// Ecrã de boas-vindas (raiz). Não pede PIN — só convida a iniciar sessão.
// O botão leva ao ecrã de login do staff (/login).
export default function Welcome() {
    const navigate = useNavigate();

    return (
        <div className="welcome-split">
            <div className="welcome-split-brand">
                <div className="welcome-split-ring welcome-split-ring--top" />
                <div className="welcome-split-ring welcome-split-ring--bottom" />

                <div className="welcome-split-logo">
                    <span className="welcome-split-logo-mark">i</span>
                    <span className="welcome-split-logo-text">InovLAR</span>
                </div>

                <p className="welcome-split-tagline">
                    Comunicação simples entre residentes e equipa.
                </p>

                <span className="welcome-split-caption">
                    
                </span>
            </div>

            <div className="welcome-split-content">
                <h1>Bem-vindo</h1>
                <p className="login-subtitulo">
                    Toque no botão para iniciar sessão com o seu PIN.
                </p>
                <button
                    className="login-iniciar"
                    onClick={() => navigate("/login")}
                >
                    Iniciar sessão
                </button>
            </div>
        </div>
    );
}
