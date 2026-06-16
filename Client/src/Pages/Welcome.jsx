import { useNavigate } from "react-router-dom";

// Ecrã de boas-vindas (raiz). Não pede PIN — só convida a iniciar sessão.
// O botão leva ao ecrã de login do staff (/login).
export default function Welcome() {
    const navigate = useNavigate();

    return (
        <div className="login-screen">
            <div className="welcome-box">
                <h1>Bem-vindo à InovLAR</h1>
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
