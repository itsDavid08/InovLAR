import { useDroppable } from "@dnd-kit/core";

// Biblioteca (droppable para remover) — fora do TabelaEditor para não perder o
// foco da pesquisa a cada render (useDroppable de um componente pai remontaria
// os filhos se estivesse inline).
const LibDrop = ({ children }) => {
    const { setNodeRef } = useDroppable({ id: "lib", data: { tipo: "lib" } });
    return (
        <div
            ref={setNodeRef}
            className="w-full lg:w-[430px] shrink-0 bg-surface-container rounded-[24px] p-5 flex flex-col min-h-0"
        >
            {children}
        </div>
    );
};

export default LibDrop;
