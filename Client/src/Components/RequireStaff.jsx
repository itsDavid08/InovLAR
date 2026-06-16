import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { Context } from "../ContextProvider";

// Guarda das rotas de staff (kiosk). Deixa passar enquanto o staff estiver
// "desbloqueado" nesta sessão (flag em memória, definida após o PIN). Como
// reinicia a false no restart, qualquer arranque/reload cai no ecrã de bloqueio.
// A segurança real continua no servidor (`requireStaff` nas rotas de escrita).
export default function RequireStaff({ children }) {
    const { staffUnlocked } = useContext(Context);

    if (!staffUnlocked) {
        return <Navigate to="/login" replace />;
    }
    return children;
}
