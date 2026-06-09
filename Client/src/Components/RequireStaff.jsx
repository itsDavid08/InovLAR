import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { staffStatus } from "../api/auth";

// Guarda das rotas de staff: pergunta ao servidor se o dispositivo está autenticado.
// Se não estiver, reencaminha para /staff/login (que trata de definir ou pedir a password).
export default function RequireStaff({ children }) {
    const [estado, setEstado] = useState("carregando"); // "carregando" | "ok" | "negado"

    useEffect(() => {
        let ativo = true;
        staffStatus().then((s) => {
            if (ativo) setEstado(s.autenticado ? "ok" : "negado");
        });
        return () => {
            ativo = false;
        };
    }, []);

    if (estado === "carregando") {
        return <div className="login-screen"><h1>A verificar…</h1></div>;
    }
    if (estado === "negado") {
        return <Navigate to="/staff/login" replace />;
    }
    return children;
}
