import { useEffect, useRef } from "react";

// Teclado numérico reutilizável (usado no login e no alterar palavra-passe).
// É puramente apresentacional: o estado (valor digitado) vive no componente pai.
// Aceita rato (botões) E o teclado físico do PC — ambos chamam os mesmos
// handlers (onDigit/onDelete/onConfirm), por isso respeitam o limite de
// comprimento e a lógica que o pai já aplica.
export default function Keypad({ value, erro, onDigit, onDelete, onConfirm }) {
    // Mantém os handlers mais recentes sem reanexar o listener a cada render.
    const handlers = useRef({ onDigit, onDelete, onConfirm });
    handlers.current = { onDigit, onDelete, onConfirm };

    // Teclado físico: dígitos 0-9 (teclado normal e numpad chegam ambos como
    // e.key "0".."9"), Backspace apaga, Enter confirma. Ignora combinações com
    // Ctrl/Alt/Meta e não interfere se houver um campo de texto focado.
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            const alvo = e.target;
            if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return;

            if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                handlers.current.onDigit(Number(e.key));
            } else if (e.key === "Backspace") {
                e.preventDefault();
                handlers.current.onDelete();
            } else if (e.key === "Enter") {
                e.preventDefault();
                handlers.current.onConfirm();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <>
            <div className="pin-display">
                {"•".repeat(value.length) || <span className="pin-placeholder">·</span>}
            </div>

            {erro && <p className="login-erro">{erro}</p>}

            <div className="keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button key={n} className="keypad-btn" onClick={() => onDigit(n)}>
                        {n}
                    </button>
                ))}
                <button className="keypad-btn keypad-acao" onClick={onDelete}>
                    ⌫
                </button>
                <button className="keypad-btn" onClick={() => onDigit(0)}>
                    0
                </button>
                <button className="keypad-btn keypad-ok" onClick={onConfirm}>
                    ✓
                </button>
            </div>
        </>
    );
}
