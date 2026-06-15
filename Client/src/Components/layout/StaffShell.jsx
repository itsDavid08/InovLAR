// Shell das páginas de staff: sidebar fixa à esquerda + header "InovLAR" + área
// de conteúdo. Partilhado entre StaffHome e a lista de botões (antes duplicado).
//  - `sidebar`     : conteúdo da barra lateral (header/perfil + ações da página).
//  - `headerRight` : conteúdo opcional à direita do header (ex.: caixa de procura).
//  - `children`    : área principal de conteúdo.
const StaffShell = ({ sidebar, headerRight, children }) => {
    return (
        <div className="bg-background text-on-background min-h-screen flex font-body-md">
            {/* SideNavBar */}
            <nav className="bg-surface dark:bg-inverse-surface h-screen w-72 left-0 top-0 fixed bg-surface-container dark:bg-surface-container-highest shadow-sm z-40 hidden md:block border-r border-surface-variant">
                <div className="flex flex-col h-full py-stack-md">
                    {sidebar}
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
                <header className="bg-surface dark:bg-inverse-surface top-0 sticky bg-surface-container-low dark:bg-surface-container shadow-sm z-30 border-b border-surface-variant">
                    <div className="flex justify-between items-center px-6 h-20 w-full">
                        <div className="flex-1">
                            <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-inverse-primary">InovLAR</h1>
                        </div>
                        {headerRight && (
                            <div className="flex items-center gap-4">
                                {headerRight}
                            </div>
                        )}
                    </div>
                </header>

                <div className="p-6 md:p-12 flex-1 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default StaffShell;
