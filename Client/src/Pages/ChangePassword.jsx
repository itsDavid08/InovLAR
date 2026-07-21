import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { staffChange } from "../api/auth";
import Keypad from "../Components/Keypad";
import { t } from "../i18n";

// Alterar a palavra-passe do staff em 3 passos: atual -> nova -> confirmar.
// Exige saber a palavra-passe atual (e o servidor também a confirma).
export default function ChangePassword() {
    const [passo, setPasso] = useState("atual"); // "atual" | "nova" | "confirmar" | "sucesso"
    const [atual, setAtual] = useState("");
    const [nova, setNova] = useState("");
    const [confirmar, setConfirmar] = useState("");
    const [erro, setErro] = useState("");
    const navigate = useNavigate();

    const valor = passo === "atual" ? atual : passo === "nova" ? nova : confirmar;
    const setValor =
        passo === "atual" ? setAtual : passo === "nova" ? setNova : setConfirmar;

    const adicionar = (d) => {
        setErro("");
        setValor((p) => (p + d).slice(0, 8));
    };
    const apagar = () => setValor((p) => p.slice(0, -1));

    const avancar = async () => {
        if (passo === "atual") {
            if (atual.length < 4) return setErro(t.auth.minDigits);
            return setPasso("nova");
        }
        if (passo === "nova") {
            if (nova.length < 4) return setErro(t.auth.minDigits);
            return setPasso("confirmar");
        }
        // passo "confirmar"
        if (nova !== confirmar) {
            setErro(t.auth.mismatch);
            setNova("");
            setConfirmar("");
            setPasso("nova");
            return;
        }
        const { ok, data } = await staffChange(atual, nova);
        if (ok) {
            setPasso("sucesso");
        } else {
            // ex.: palavra-passe atual incorreta (401)
            setErro(data.mensagem || t.auth.changeError);
            setAtual("");
            setNova("");
            setConfirmar("");
            setPasso("atual");
        }
    };

    if (passo === "sucesso") {
        return (
            <div className="login-screen">
                <h1>{t.auth.changed}</h1>
                <p className="login-sucesso">{t.auth.changedHint}</p>
                <button className="login-botao-grande" onClick={() => navigate("/staff")}>
                    {t.common.back}
                </button>
            </div>
        );
    }

    const titulo =
        passo === "atual"
            ? t.auth.currentPassword
            : passo === "nova"
            ? t.auth.newPassword
            : t.auth.confirmNewPassword;

    return (
        <div className="login-screen">
            <button className="login-voltar" onClick={() => navigate("/staff")}>
                {t.common.backArrow}
            </button>

            <h1>{titulo}</h1>

            <Keypad
                value={valor}
                erro={erro}
                onDigit={adicionar}
                onDelete={apagar}
                onConfirm={avancar}
            />
        </div>
    );
}
