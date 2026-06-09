// Teclado numérico reutilizável (usado no login e no alterar palavra-passe).
// É puramente apresentacional: o estado (valor digitado) vive no componente pai.
export default function Keypad({ value, erro, onDigit, onDelete, onConfirm }) {
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
