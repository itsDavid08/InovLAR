import { useState } from "react";
import { staffLogin } from "../api/auth";
import Keypad from "./Keypad";

// Modal de PIN para SAIR do modo utente (a "gaiola"). Sobrepõe-se ao tabuleiro.
// Verifica o PIN no servidor (staffLogin). Em caso de sucesso chama onSuccess;
// se o utente cancelar ou errar, fica no tabuleiro (onCancel / mensagem de erro).
export default function PinPrompt({ titulo = "Acesso Staff", onSuccess, onCancel }) {
    const [pin, setPin] = useState("");
    const [erro, setErro] = useState("");

    const adicionar = (d) => {
        setErro("");
        setPin((p) => (p + d).slice(0, 8));
    };
    const apagar = () => setPin((p) => p.slice(0, -1));

    const confirmar = async () => {
        const { ok } = await staffLogin(pin);
        if (ok) {
            onSuccess();
        } else {
            setErro("Palavra-passe incorreta");
            setPin("");
        }
    };

    return (
        <div className="pin-overlay">
            <div className="login-screen">
                <button className="login-voltar" onClick={onCancel}>
                    ← Voltar
                </button>

                <h1>{titulo}</h1>

                <Keypad
                    value={pin}
                    erro={erro}
                    onDigit={adicionar}
                    onDelete={apagar}
                    onConfirm={confirmar}
                />
            </div>
        </div>
    );
}
