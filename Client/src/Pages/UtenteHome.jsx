import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";

const UtenteHome = () => {
    const { utentes, setUtente } = useContext(Context);
    const navigate = useNavigate();

    const handleOpen = (utente) => {
        setUtente(utente);
        navigate("/main/" + utente.id);
    };

    const handleVoltar = () => {
        navigate("/");
    }

    return (
        <div className="bg-background text-on-background min-h-screen flex font-body-md">
            <main className="flex-1 flex flex-col min-h-screen">
                <header className="bg-surface dark:bg-inverse-surface top-0 sticky bg-surface-container-low dark:bg-surface-container shadow-sm z-30 border-b border-surface-variant">
                    <div className="flex justify-between items-center px-6 h-20 w-full max-w-7xl mx-auto">
                        <div className="flex-1 flex items-center gap-4">
                            <button onClick={handleVoltar} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:opacity-80 transition-opacity flex items-center justify-center">
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-inverse-primary">InovLAR</h1>
                        </div>
                    </div>
                </header>

                <div className="p-6 md:p-12 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="font-display-lg text-4xl font-bold text-on-surface mb-2">Quem está a usar?</h2>
                            <p className="font-body-lg text-body-lg text-on-surface-variant">Selecione o seu perfil para prosseguir.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {utentes.map((utente) => (
                            <div 
                                key={utente.id} 
                                className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-surface-variant hover:shadow-md hover:border-primary transition-all cursor-pointer relative overflow-hidden group"
                                onClick={() => handleOpen(utente)}
                            >
                                <div className="flex items-center flex-col text-center mt-4">
                                    <div className="w-24 h-24 mb-4 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-display-lg text-[36px] shadow-sm transform group-hover:scale-105 transition-transform duration-300">
                                        {utente.nome.split(' ').map(name => name[0]).slice(0,2).join('')}
                                    </div>
                                    <h3 className="font-headline-md text-2xl font-bold text-on-surface mb-1 truncate w-full" title={utente.nome}>
                                        {utente.nome}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default UtenteHome;