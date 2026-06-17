import { useNavigate, useLocation } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";

// Barra de navegação inferior — só visível em mobile (md:hidden). Espelha a
// sidebar do desktop usando a mesma fonte de itens (navItems.js). O
// padding-bottom dinâmico respeita a safe-area do iOS (notch / barra de gestos).
const StaffBottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-low dark:bg-surface-container border-t border-surface-variant pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around items-stretch h-16">
                {NAV_ITEMS.map(({ short, icon, path }) => {
                    const active = location.pathname === path;
                    return (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            aria-label={short}
                            aria-current={active ? "page" : undefined}
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 duration-150 ${
                                active ? "text-primary" : "text-on-surface-variant"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[24px]">{icon}</span>
                            <span className="text-[11px] font-staff-mono">{short}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default StaffBottomNav;
