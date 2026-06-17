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

    return (
        <StaffShell sidebar={<StaffSidebar />}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
                <div>
                    <h2 className="font-display-lg text-3xl md:text-2xl font-bold text-on-surface mb-1">Visão Geral dos Botões</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">Selecione um botão da lista ou adicione um novo.</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="relative flex-1 sm:flex-none">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                        <input
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full sm:w-56 pl-10 pr-4 py-2 rounded-full bg-surface-container border-none focus:ring-2 focus:ring-primary font-body-md text-body-md text-on-surface placeholder-on-surface-variant"
                            placeholder="Procurar botão..."
                            type="text"
                        />
                    </div>
                    <button
                        onClick={onNew}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-staff-mono text-staff-mono hover:bg-primary-container hover:text-on-primary-container transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Novo Botão
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {botoesFiltrados.map((botao) => (
                    <div
                        key={botao.id}
                        className="bg-surface-container-lowest rounded-lg p-3 sm:p-4 shadow-sm border border-surface-variant hover:shadow-md transition-all relative overflow-hidden group"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-surface-variant"></div>
                        <div className="absolute top-2 right-2 z-10">
                            <ItemMenu onEdit={() => onEdit(botao)} onDelete={() => onDelete(botao)} />
                        </div>
                        <div className="flex items-center flex-col text-center mt-2 sm:mt-4">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 mb-2 sm:mb-3 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center overflow-hidden border-2 border-surface-container shadow-sm transform group-hover:scale-105 transition-transform duration-300">
                                <img
                                    src={apiUrl + (botao.imagem || '/imagesBotoes/default.png')}
                                    alt={botao.nome}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h3 className="font-headline-md text-base sm:text-lg lg:text-xl font-bold text-on-surface mb-1 truncate w-full" title={botao.nome}>
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
