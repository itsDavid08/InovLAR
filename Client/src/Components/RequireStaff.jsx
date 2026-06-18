import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import StaffSkeleton from "./layout/StaffSkeleton";

// Guarda das rotas de staff (kiosk). O acesso (`staffUnlocked`) é restaurado do
// cookie do dispositivo ao arrancar (ver ContextProvider) — por isso um reload
// numa página de staff mantém-se sem voltar a pedir o PIN. Enquanto essa
// verificação não termina (`staffChecked` a false), mostra o esqueleto da página
// em vez de branco. A segurança real continua no servidor (`requireStaff`).
export default function RequireStaff({ children }) {
    const { staffUnlocked, staffChecked } = useContext(Context);

    if (!staffChecked) {
        return <StaffSkeleton />;
    }
    if (!staffUnlocked) {
        return <Navigate to="/" replace />;
    }
    return children;
}
