import { useState, useEffect, useRef } from "react";
import { staffStatus } from "../api/auth";

// Gate de "kiosk": staffUnlocked = true quando o staff tem acesso ao console.
// O acesso é restaurado do cookie do dispositivo ao arrancar (um reload mantém
// a sessão). Exceção: entrar na "gaiola" (/board) não restaura — o próprio
// tabuleiro revoga o acesso. `staffChecked` fica false até a verificação inicial
// terminar, para o RequireStaff mostrar um esqueleto em vez de piscar o login.
//
// `staffUnlockedRef` espelha o estado para handlers assíncronos (o do socket)
// lerem sem stale-closure — as leituras só-staff não devem disparar no tabuleiro.
export function useStaffAuthState() {
    const [staffUnlocked, setStaffUnlocked] = useState(false);
    const [staffChecked, setStaffChecked] = useState(false);
    const staffUnlockedRef = useRef(staffUnlocked);

    useEffect(() => {
        staffUnlockedRef.current = staffUnlocked;
    }, [staffUnlocked]);

    useEffect(() => {
        if (window.location.pathname.startsWith("/board")) {
            setStaffChecked(true);
            return;
        }
        staffStatus()
            .then((s) => { if (s.autenticado) setStaffUnlocked(true); })
            .finally(() => setStaffChecked(true));
    }, []);

    return { staffUnlocked, setStaffUnlocked, staffChecked, staffUnlockedRef };
}
