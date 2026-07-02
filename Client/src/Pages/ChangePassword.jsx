import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { staffChange } from "../api/auth";
import Keypad from "../Components/Keypad";

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
            if (atual.length < 4) return setErro("Mínimo 4 dígitos");
            return setPasso("nova");
        }
        if (passo === "nova") {
            if (nova.length < 4) return setErro("Mínimo 4 dígitos");
            return setPasso("confirmar");
        }
        // passo "confirmar"
        if (nova !== confirmar) {
            setErro("As palavras-passe não coincidem");
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
            setErro(data.mensagem || "Não foi possível alterar");
            setAtual("");
            setNova("");
            setConfirmar("");
            setPasso("atual");
        }
    };

    if (passo === "sucesso") {
        return (
            <div className="login-screen">
                <h1>Palavra-passe alterada ✓</h1>
                <p className="login-sucesso">A nova palavra-passe já está ativa.</p>
                <button className="login-botao-grande" onClick={() => navigate("/staff")}>
                    Voltar
                </button>
            </div>
        );
    }

    const titulo =
        passo === "atual"
            ? "Palavra-passe atual"
            : passo === "nova"
            ? "Nova palavra-passe"
            : "Confirmar nova palavra-passe";

    return (
        <div className="login-screen">
            <button className="login-voltar" onClick={() => navigate("/staff")}>
                ← Voltar
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
