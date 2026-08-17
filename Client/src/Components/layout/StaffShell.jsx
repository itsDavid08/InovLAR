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
            {/* `min-w-0` é obrigatório, não decorativo: um filho de flex tem
                `min-width: auto` por omissão, o que o impede de encolher abaixo da
                largura mínima do seu conteúdo. Uma tabela larga (ex.: o Registo de
                Pedidos) esticava o <main> para além da janela e criava scroll
                horizontal na PÁGINA — apesar de a tabela já ter o seu próprio
                `overflow-x-auto`, que nunca chegava a ser usado porque o container
                nunca era forçado a encolher. Com `min-w-0`, o <main> fica pela
                largura disponível e é a tabela que faz scroll dentro de si. */}
            <main className="flex-1 min-w-0 md:ml-72 flex flex-col min-h-screen">
                {/* pb em mobile = altura da barra inferior (4rem) + folga + safe-area,
                    para a última linha de cartões não ficar escondida pela barra. */}
                <div className="p-4 sm:p-6 md:px-10 md:py-8 flex-1 overflow-y-auto">
                    {children}
                    {/* Espaçador para o último cartão não ficar tapado pela barra de navegação inferior (h-16 = 64px). */}
                    <div className="h-16 md:hidden" aria-hidden="true" />
                </div>
            </main>

            {/* Navegação inferior — só mobile */}
            <StaffBottomNav />
        </div>
    );
};

export default StaffShell;
