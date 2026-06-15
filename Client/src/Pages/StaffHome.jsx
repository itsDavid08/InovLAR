import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import { staffLogout } from "../api/auth";
import StaffShell from "../Components/layout/StaffShell";

const StaffHome = () => {
    const { utentes, setUtente, deleteUtente, setStaffUnlocked } = useContext(Context);
    const navigate = useNavigate();
    const [selectedUtente, setSelectedUtente] = useState(null);

    const handleSelectUtente = (utente) => {
        setSelectedUtente(utente);
    };

    // Iniciar a sessão do utente: entra na "gaiola". O fecho do gate é feito pelo
    // próprio tabuleiro ao montar — se o fizéssemos aqui, o RequireStaff (ainda
    // montado em /staff) redirecionaria para o bloqueio durante a navegação.
    const handleOpen = (utente) => {
        setUtente(utente);
        navigate("/main/" + utente.id);
    };

    const handleEdit = () => {
        if (selectedUtente) {
            navigate(`/edit-utente/${selectedUtente.id}`);
        }
    };

    const handleDelete = async () => {
        if (selectedUtente) {
            if (window.confirm(`Tens certeza que pretendes eliminar ${selectedUtente.nome}?`)) {
                await deleteUtente(selectedUtente.id);
                setSelectedUtente(null);
            }
        }
    };

    const handleNew = () => {
        navigate("/new-utente");
    };

    const handlePendingRequests = () => {
        navigate("/staff/pedidos");
    }

    const handleVoltar = () => {
        setStaffUnlocked(false);
        navigate("/");
    }

    const handleAlterarPassword = () => {
        navigate("/staff/alterar-password");
    }

    const handleLogout = async () => {
        await staffLogout();
        setStaffUnlocked(false);
        navigate("/");
    }

    const sidebar = (
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
                <button onClick={handlePendingRequests} className="w-full flex items-center gap-4 text-on-surface-variant dark:text-surface-variant px-4 py-3 mx-2 hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors active:scale-95 duration-150 mb-2">
                    <span className="material-symbols-outlined">pending_actions</span>
                    <span className="font-label-xl text-label-xl">Pedidos Pendentes</span>
                </button>

                <button onClick={() => navigate("/editBotoes")} className="w-full flex items-center gap-4 text-on-surface-variant dark:text-surface-variant px-4 py-3 mx-2 hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors active:scale-95 duration-150 mb-2">
                    <span className="material-symbols-outlined">tune</span>
                    <span className="font-label-xl text-label-xl">Editar Botões</span>
                </button>

                <button onClick={handleAlterarPassword} className="w-full flex items-center gap-4 text-on-surface-variant dark:text-surface-variant px-4 py-3 mx-2 hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors active:scale-95 duration-150 mb-2">
                    <span className="material-symbols-outlined">settings</span>
                    <span className="font-label-xl text-label-xl">Settings</span>
                </button>
            </div>

            {/* Quick Actions Panel */}
            <div className="px-4 pt-4 border-t border-surface-variant">
                <h3 className="font-label-xl text-label-xl text-on-surface-variant mb-4 px-2 uppercase text-xs tracking-wider">Ações com o Utente</h3>
                <button
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors mb-2 text-left ${selectedUtente ? 'text-primary hover:bg-surface-container' : 'text-outline opacity-50 cursor-not-allowed'}`}
                    onClick={handleEdit}
                    disabled={!selectedUtente}
                >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    <span className="font-staff-mono text-staff-mono">Editar Utente</span>
                </button>
                <button
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors mb-2 text-left ${selectedUtente ? 'text-error hover:bg-error-container hover:text-on-error-container' : 'text-outline opacity-50 cursor-not-allowed'}`}
                    onClick={handleDelete}
                    disabled={!selectedUtente}
                >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span className="font-staff-mono text-staff-mono">Apagar Utente</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-primary hover:bg-surface-container rounded-lg transition-colors mb-2 text-left" onClick={handleNew}>
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span className="font-staff-mono text-staff-mono">Novo Utente</span>
                </button>

                <div className="mt-4 pt-4 border-t border-surface-variant">
                    <button className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors mb-2" onClick={handleLogout}>
                        <span className="material-symbols-outlined text-sm">logout</span>
                        <span className="font-staff-mono text-staff-mono">Terminar Sessão</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors mb-2" onClick={handleVoltar}>
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span className="font-staff-mono text-staff-mono">Voltar Atrás</span>
                    </button>
                </div>
            </div>
        </>
    );

    const headerRight = (
        <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant">search</span>
            <input className="pl-10 pr-4 py-2 rounded-full bg-surface-container border-none focus:ring-2 focus:ring-primary w-64 font-body-md text-body-md text-on-surface placeholder-on-surface-variant" placeholder="Procurar utente..." type="text"/>
        </div>
    );

    return (
        <StaffShell sidebar={sidebar} headerRight={headerRight}>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="font-display-lg text-3xl font-bold text-on-surface mb-2">Visão Geral dos Utentes</h2>
                    <p className="font-body-lg text-body-lg text-on-surface-variant">Selecione um residente ou aceda ao seu perfil.</p>
                </div>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {utentes.map((utente) => {
                    const isSelected = selectedUtente?.id === utente.id;
                    return (
                        <div
                            key={utente.id}
                            className={`bg-surface-container-lowest rounded-lg p-6 shadow-sm border ${isSelected ? 'border-primary ring-1 ring-primary shadow-md' : 'border-surface-variant'} hover:shadow-md transition-all cursor-pointer relative overflow-hidden group`}
                            onClick={() => handleSelectUtente(utente)}
                        >
                            <div className={`absolute top-0 left-0 w-full h-1 ${isSelected ? 'bg-primary' : 'bg-status-green'}`}></div>
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-display-lg text-[24px] border-2 border-surface-container">
                                    {utente.nome.split(' ').map(name => name[0]).slice(0,2).join('')}
                                </div>
                                <div className="px-2 py-1 rounded text-xs font-staff-mono font-bold text-status-green flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">check_circle</span> Estável
                                </div>
                            </div>
                            <h3 className="font-body-xl text-body-xl font-semibold text-on-surface mb-1 truncate" title={utente.nome}>{utente.nome}</h3>
                            <p className="font-body-md text-body-md text-on-surface-variant mb-4 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">meeting_room</span> Quarto Geral
                            </p>
                            <div className="flex gap-2">
                                <button
                                    className={`flex-1 py-2 rounded-full font-staff-mono text-staff-mono transition-colors ${isSelected ? 'bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'}`}
                                    onClick={(e) => { e.stopPropagation(); handleOpen(utente); }}
                                >
                                    Aceder Perfil
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </StaffShell>
    );
};

export default StaffHome;
