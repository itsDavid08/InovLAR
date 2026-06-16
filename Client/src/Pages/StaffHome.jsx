import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import StaffShell from "../Components/layout/StaffShell";
import StaffSidebar from "../Components/layout/StaffSidebar";
import ItemMenu from "../Components/layout/ItemMenu";

const StaffHome = () => {
    const { utentes, setUtente, deleteUtente } = useContext(Context);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");

    // Iniciar a sessão do utente: entra na "gaiola". O fecho do gate é feito pelo
    // próprio tabuleiro ao montar — se o fizéssemos aqui, o RequireStaff (ainda
    // montado em /staff) redirecionaria para o bloqueio durante a navegação.
    const handleOpen = (utente) => {
        setUtente(utente);
        navigate("/main/" + utente.id);
    };

    const handleEdit = (utente) => {
        navigate(`/edit-utente/${utente.id}`);
    };

    const handleDelete = async (utente) => {
        if (window.confirm(`Tens certeza que pretendes eliminar ${utente.nome}?`)) {
            await deleteUtente(utente.id);
        }
    };

    const handleNew = () => {
        navigate("/new-utente");
    };

    // Procura só por nome (por agora). Outros critérios podem ser adicionados depois.
    const utentesFiltrados = utentes.filter((u) =>
        u.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const headerRight = (
        <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant">search</span>
            <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-full bg-surface-container border-none focus:ring-2 focus:ring-primary w-64 font-body-md text-body-md text-on-surface placeholder-on-surface-variant"
                placeholder="Procurar utente..."
                type="text"
            />
        </div>
    );

    return (
        <StaffShell sidebar={<StaffSidebar />} headerRight={headerRight}>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="font-display-lg text-3xl font-bold text-on-surface mb-2">Visão Geral dos Utentes</h2>
                    <p className="font-body-lg text-body-lg text-on-surface-variant">Aceda ao perfil de um residente ou adicione um novo.</p>
                </div>
                <button
                    onClick={handleNew}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-staff-mono text-staff-mono hover:bg-primary-container hover:text-on-primary-container transition-colors shrink-0"
                >
                    <span className="material-symbols-outlined">add</span>
                    Novo Utente
                </button>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {utentesFiltrados.map((utente) => (
                    <div
                        key={utente.id}
                        className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-surface-variant hover:shadow-md transition-all relative overflow-hidden group"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-status-green"></div>
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-display-lg text-[24px] border-2 border-surface-container">
                                {utente.nome.split(' ').map(name => name[0]).slice(0, 2).join('')}
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="px-2 py-1 rounded text-xs font-staff-mono font-bold text-status-green flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">check_circle</span> Estável
                                </div>
                                <ItemMenu onEdit={() => handleEdit(utente)} onDelete={() => handleDelete(utente)} />
                            </div>
                        </div>
                        <h3 className="font-body-xl text-body-xl font-semibold text-on-surface mb-1 truncate" title={utente.nome}>{utente.nome}</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant mb-4 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">meeting_room</span> Quarto Geral
                        </p>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 py-2 rounded-full font-staff-mono text-staff-mono transition-colors bg-surface-container-high text-on-surface hover:bg-surface-variant"
                                onClick={() => handleOpen(utente)}
                            >
                                Aceder Perfil
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </StaffShell>
    );
};

export default StaffHome;
