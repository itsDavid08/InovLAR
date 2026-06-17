import { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Context } from "../../ContextProvider";
import { staffLogout } from "../../api/auth";
import { NAV_ITEMS } from "./navItems";

// Sidebar partilhado das páginas de staff (StaffHome, EditBotoes, …).
// Estrutura fixa: header + nav links (com highlight da página ativa) + slot de
// ações específicas da página (children) + footer "Terminar Sessão".
// A navegação entre secções faz-se pelos próprios links — por isso já não há
// botão "Voltar Atrás" (era redundante e mantinha o cookie de servidor vivo).
// Os itens de navegação vivem em navItems.js (partilhados com StaffBottomNav).

const StaffSidebar = ({ children }) => {
    const { setStaffUnlocked } = useContext(Context);
    const navigate = useNavigate();
    const location = useLocation();

    // Sair: invalida o cookie no servidor, fecha o gate de kiosk e volta ao home.
    // (Fechar o gate aqui é seguro: o RequireStaff aponta para `/`, o mesmo destino.)
    const handleLogout = async () => {
        await staffLogout();
        setStaffUnlocked(false);
        navigate("/");
    };

    return (
        <>
            {/* Header/Profile */}
            <div className="px-6 pb-6 mb-4 border-b border-surface-variant flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xl">
                    IS
                </div>
                <div>
                    <h2 className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary text-xl">InovLAR Staff</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm">Medical Center</p>
                </div>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto">
                {NAV_ITEMS.map(({ label, icon, path }) => {
                    const active = location.pathname === path;
                    return (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className={`w-full flex items-center gap-4 px-4 py-3 mx-2 transition-colors active:scale-95 duration-150 mb-2 ${
                                active
                                    ? "text-primary bg-surface-container-high dark:bg-surface-variant font-bold"
                                    : "text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant"
                            }`}
                        >
                            <span className="material-symbols-outlined">{icon}</span>
                            <span className="font-label-xl text-label-xl">{label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Ações específicas da página */}
            {children}

            {/* Footer */}
            <div className="px-4 pt-4 mt-4 border-t border-surface-variant">
                <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors mb-2"
                    onClick={handleLogout}
                >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    <span className="font-staff-mono text-staff-mono">Terminar Sessão</span>
                </button>
            </div>
        </>
    );
};

export default StaffSidebar;
