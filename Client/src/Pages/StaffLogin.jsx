import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { staffStatus, staffSetup, staffLogin } from "../api/auth";
import Keypad from "../Components/Keypad";
import { t } from "../i18n";

// Ecrã de bloqueio do tablet (kiosk). Serve para DEFINIR a palavra-passe (1ª vez)
// e para DESBLOQUEAR o console de staff. Vive em /login: chega-se aqui pelo botão
// do ecrã de boas-vindas (/) ou por redirect do RequireStaff quando o gate
// `staffUnlocked` está bloqueado.
export default function StaffLogin() {
    const { setStaffUnlocked } = useContext(Context);
    const [modo, setModo] = useState("carregando"); // "carregando" | "definir" | "login"
    const [passo, setPasso] = useState(1); // no modo "definir": 1=escolher, 2=confirmar
    const [pin, setPin] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [erro, setErro] = useState("");
    const navigate = useNavigate();

    // Só decidimos definir-vs-login. Quem chega aqui não tem sessão a restaurar:
    // o reload de uma página de staff com cookie válido é tratado pelo
    // RequireStaff (restaura o acesso e não passa por aqui). Por isso pede o PIN.
    useEffect(() => {
        let ativo = true;
        staffStatus().then((s) => {
            if (!ativo) return;
            setModo(s.configurado ? "login" : "definir");
        });
        return () => {
            ativo = false;
        };
    }, []);

    // Entra no console de staff: liga o gate de kiosk e navega.
    const entrar = () => {
        setStaffUnlocked(true);
        navigate("/staff");
    };

    const aConfirmar = modo === "definir" && passo === 2;
    const valor = aConfirmar ? pinConfirm : pin;
    const setValor = aConfirmar ? setPinConfirm : setPin;

    const adicionar = (d) => {
        setErro("");
        setValor((p) => (p + d).slice(0, 8));
    };
    const apagar = () => setValor((p) => p.slice(0, -1));

    const confirmar = async () => {
        if (modo === "login") {
            const { ok } = await staffLogin(pin);
            if (ok) entrar();
            else {
                setErro(t.auth.wrongPassword);
                setPin("");
            }
            return;
        }
        // modo "definir"
        if (passo === 1) {
            if (pin.length < 4) {
                setErro(t.auth.minDigits);
                return;
            }
            setPasso(2);
            return;
        }
        if (pin !== pinConfirm) {
            setErro(t.auth.mismatch);
            setPin("");
            setPinConfirm("");
            setPasso(1);
            return;
        }
        const { ok, data } = await staffSetup(pin);
        if (ok) entrar();
        else setErro(data.mensagem || t.auth.setupError);
    };

    if (modo === "carregando") {
        return (
            <div className="login-screen">
                <h1>{t.common.loading}</h1>
            </div>
        );
    }

    const titulo =
        modo === "login"
            ? t.auth.staffAccess
            : passo === 1
            ? t.auth.setPassword
            : t.auth.confirmPassword;

    const subtitulo = modo === "definir" && passo === 1 ? t.auth.firstUse : null;

    return (
        <div className="login-screen">
            <button className="login-voltar" onClick={() => navigate("/")}>
                {t.common.backArrow}
            </button>
            <h1>{titulo}</h1>
            {subtitulo && <p className="login-subtitulo">{subtitulo}</p>}

            <Keypad
                value={valor}
                erro={erro}
                onDigit={adicionar}
                onDelete={apagar}
                onConfirm={confirmar}
            />
        </div>
    );
}
