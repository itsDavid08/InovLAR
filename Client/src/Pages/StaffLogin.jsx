import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { staffStatus, staffSetup, staffLogin } from "../api/auth";
import Keypad from "../Components/Keypad";

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

    // Só decidimos definir-vs-login. NÃO saltamos por causa do cookie: o tablet
    // tem de pedir o PIN em cada arranque, mesmo que o dispositivo já esteja
    // autenticado no servidor (o cookie continua a servir para as mutações).
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
                setErro("Palavra-passe incorreta");
                setPin("");
            }
            return;
        }
        // modo "definir"
        if (passo === 1) {
            if (pin.length < 4) {
                setErro("Mínimo 4 dígitos");
                return;
            }
            setPasso(2);
            return;
        }
        if (pin !== pinConfirm) {
            setErro("As palavras-passe não coincidem");
            setPin("");
            setPinConfirm("");
            setPasso(1);
            return;
        }
        const { ok, data } = await staffSetup(pin);
        if (ok) entrar();
        else setErro(data.mensagem || "Erro ao definir a palavra-passe");
    };

    if (modo === "carregando") {
        return (
            <div className="login-screen">
                <h1>A carregar…</h1>
            </div>
        );
    }

    const titulo =
        modo === "login"
            ? "Acesso Staff"
            : passo === 1
            ? "Definir palavra-passe"
            : "Confirmar palavra-passe";

    const subtitulo =
        modo === "definir" && passo === 1
            ? "Primeira utilização — escolha uma palavra-passe"
            : null;

    return (
        <div className="login-screen">
            <button className="login-voltar" onClick={() => navigate("/")}>
                ← Voltar
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
