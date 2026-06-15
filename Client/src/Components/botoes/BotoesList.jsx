// Layout "lista/selecionar" do editor de botões: grelha de botões + ações na
// sidebar. Componente presentacional — o estado e a lógica vivem em EditBotoes.
import StaffShell from "../layout/StaffShell";

const BotoesList = ({
    botoes,
    selectedBotao,
    apiUrl,
    onSelect,
    onEdit,
    onDelete,
    onNew,
    onBack,
}) => {
    const sidebar = (
        <>
            {/* Header/Profile */}
            <div className="px-6 pb-6 mb-4 border-b border-surface-variant flex items-center gap-4">
                <button onClick={onBack} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:opacity-80 transition-opacity">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary text-xl">Gestão de Botões</h2>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto">
                {/* More links can go here if needed */}
            </div>

            {/* Quick Actions Panel */}
            <div className="px-4 pt-4 border-t border-surface-variant">
                <h3 className="font-label-xl text-label-xl text-on-surface-variant mb-4 px-2 uppercase text-xs tracking-wider">Ações</h3>
                <button
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors mb-2 text-left ${selectedBotao ? 'text-primary hover:bg-surface-container' : 'text-outline opacity-50 cursor-not-allowed'}`}
                    onClick={onEdit}
                    disabled={!selectedBotao}
                >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span className="font-staff-mono text-staff-mono">Editar Botão</span>
                </button>
                <button
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors mb-2 text-left ${selectedBotao ? 'text-error hover:bg-error-container hover:text-on-error-container' : 'text-outline opacity-50 cursor-not-allowed'}`}
                    onClick={onDelete}
                    disabled={!selectedBotao}
                >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span className="font-staff-mono text-staff-mono">Apagar Botão</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-primary hover:bg-surface-container rounded-lg transition-colors mb-2 text-left" onClick={onNew}>
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    <span className="font-staff-mono text-staff-mono">Novo Botão</span>
                </button>
            </div>
        </>
    );

    return (
        <StaffShell sidebar={sidebar}>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="font-display-lg text-3xl font-bold text-on-surface mb-2">Visão Geral dos Botões</h2>
                    <p className="font-body-lg text-body-lg text-on-surface-variant">Selecione um botão da lista ou adicione um novo.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {botoes.map((botao) => {
                    const isSelected = selectedBotao?.id === botao.id;
                    return (
                        <div
                            key={botao.id}
                            className={`bg-surface-container-lowest rounded-lg p-6 shadow-sm border ${isSelected ? 'border-primary ring-1 ring-primary shadow-md' : 'border-surface-variant'} hover:shadow-md transition-all cursor-pointer relative overflow-hidden group`}
                            onClick={() => onSelect(botao)}
                        >
                            <div className={`absolute top-0 left-0 w-full h-1 ${isSelected ? 'bg-primary' : 'bg-surface-variant'}`}></div>
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
                    );
                })}
            </div>
        </StaffShell>
    );
};

export default BotoesList;
