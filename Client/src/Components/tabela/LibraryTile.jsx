import { useDraggable } from "@dnd-kit/core";
import ButtonTile from "./ButtonTile";
import MarchingAnts from "./MarchingAnts";

// Peça arrastável da biblioteca.
const LibraryTile = ({ botao, apiUrl, selecionado, onSelect }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `lib:${botao.id}`,
        data: { tipo: "lib", botaoId: botao.id },
    });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
            className={`relative cursor-pointer active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
        >
            <ButtonTile botao={botao} apiUrl={apiUrl} size="P" />
            {selecionado && <MarchingAnts />}
        </div>
    );
};

export default LibraryTile;
