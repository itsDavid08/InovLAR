import { useNavigate } from "react-router-dom";
import { t } from "../i18n";

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

                <p className="welcome-split-tagline">{t.welcome.tagline}</p>
            </div>

            <div className="welcome-split-content">
                <h1>{t.welcome.title}</h1>
                <p className="login-subtitulo">{t.welcome.subtitle}</p>
                <button
                    className="login-iniciar"
                    onClick={() => navigate("/login")}
                >
                    {t.welcome.signIn}
                </button>
            </div>
        </div>
    );
}
