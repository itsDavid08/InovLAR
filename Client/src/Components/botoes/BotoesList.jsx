// Layout "lista/selecionar" do editor de botões: grelha de botões com menu de
// ações por item (⋮) + sidebar partilhada (StaffSidebar). Componente
// presentacional — o estado e a lógica (procura incluída) vivem em EditBotoes.
import StaffShell from "../layout/StaffShell";
import StaffSidebar from "../layout/StaffSidebar";
import ItemMenu from "../layout/ItemMenu";

const BotoesList = ({
    botoes,
    apiUrl,
    searchQuery,
    onSearchChange,
    onEdit,
    onDelete,
    onNew,
}) => {
    // Procura só por nome (por agora). Outros critérios podem ser adicionados depois.
    const botoesFiltrados = botoes.filter((b) =>
        b.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const headerRight = (
        <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant">search</span>
            <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-full bg-surface-container border-none focus:ring-2 focus:ring-primary w-64 font-body-md text-body-md text-on-surface placeholder-on-surface-variant"
                placeholder="Procurar botão..."
                type="text"
            />
        </div>
    );

    return (
        <StaffShell sidebar={<StaffSidebar />} headerRight={headerRight}>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="font-display-lg text-3xl font-bold text-on-surface mb-2">Visão Geral dos Botões</h2>
                    <p className="font-body-lg text-body-lg text-on-surface-variant">Selecione um botão da lista ou adicione um novo.</p>
                </div>
                <button
                    onClick={onNew}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-staff-mono text-staff-mono hover:bg-primary-container hover:text-on-primary-container transition-colors shrink-0"
                >
                    <span className="material-symbols-outlined">add</span>
                    Novo Botão
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {botoesFiltrados.map((botao) => (
                    <div
                        key={botao.id}
                        className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-surface-variant hover:shadow-md transition-all relative overflow-hidden group"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-surface-variant"></div>
                        <div className="absolute top-2 right-2 z-10">
                            <ItemMenu onEdit={() => onEdit(botao)} onDelete={() => onDelete(botao)} />
                        </div>
                        <div className="flex items-center flex-col text-center mt-4">
                            <div className="w-32 h-32 mb-4 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center overflow-hidden border-2 border-surface-container shadow-sm transform group-hover:scale-105 transition-transform duration-300">
                                <img
                                    src={apiUrl + (botao.imagem || "imagesBotoes/default.png")}
                                    alt={botao.nome}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h3 className="font-headline-md text-xl font-bold text-on-surface mb-1 truncate w-full" title={botao.nome}>
                                {botao.nome}
                            </h3>
                            <span className="mt-2 bg-surface-container text-on-surface-variant px-2 py-1 rounded text-xs font-staff-mono font-bold truncate max-w-full">
                                {botao.categoria || 'Sem categoria'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </StaffShell>
    );
};

export default BotoesList;
