import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { utenteBind } from "../api/auth";

// Vincula o tablet ao utente escolhido (ação de staff) e abre o board dele.
// O bind TERMINA a sessão de staff no servidor — o tablet passa a ser do residente.
export default function AbrirUtente() {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        let ativo = true;
        utenteBind(id).then(({ ok }) => {
            if (ativo) navigate(ok ? `/main/${id}` : "/", { replace: true });
        });
        return () => {
            ativo = false;
        };
    }, [id, navigate]);

    return <div className="login-screen"><h1>A abrir…</h1></div>;
}
