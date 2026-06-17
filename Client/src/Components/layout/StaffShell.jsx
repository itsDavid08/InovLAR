import StaffBottomNav from "./StaffBottomNav";

// Shell das páginas de staff. Responsivo:
//  - Desktop (md+): sidebar fixa à esquerda (StaffSidebar).
//  - Mobile (<md): a sidebar fica escondida e a navegação passa para uma barra
//    inferior fixa (StaffBottomNav), espelhando os mesmos itens.
// O header "InovLAR" foi removido para aproveitar o espaço vertical — o branding
// vive na sidebar e a caixa de procura passou para o cabeçalho de cada página.
//  - `sidebar`  : conteúdo da barra lateral (header/perfil + ações da página).
//  - `children` : área principal de conteúdo.
const StaffShell = ({ sidebar, children }) => {
    return (
        <div className="bg-background text-on-background min-h-screen flex font-body-md">
            {/* SideNavBar — só desktop */}
            <nav className="bg-surface dark:bg-inverse-surface h-screen w-72 left-0 top-0 fixed bg-surface-container dark:bg-surface-container-highest shadow-sm z-40 hidden md:block border-r border-surface-variant">
                <div className="flex flex-col h-full py-stack-md">
                    {sidebar}
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
                {/* pb em mobile = altura da barra inferior (4rem) + folga + safe-area,
                    para a última linha de cartões não ficar escondida pela barra. */}
                <div className="p-4 sm:p-6 md:px-10 md:py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 flex-1 overflow-y-auto">
                    {children}
                </div>
            </main>

            {/* Navegação inferior — só mobile */}
            <StaffBottomNav />
        </div>
    );
};

export default StaffShell;
