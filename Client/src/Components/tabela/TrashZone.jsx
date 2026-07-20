import { useDroppable } from "@dnd-kit/core";
import { t } from "../../i18n";

// Zona de lixo: aparece ao arrastar OU com um botão selecionado (toque para eliminar).
const TrashZone = ({ visible, tap, onClick }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: "trash",
        data: { tipo: "trash" },
    });
    return (
        <div
            ref={setNodeRef}
            onClick={onClick}
            className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 flex items-center gap-2 px-6 py-3 rounded-full border-2 border-dashed shadow-lg transition-all duration-200
                ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
                ${isOver ? "bg-error text-on-error border-error scale-105" : "bg-error-container text-on-error-container border-error cursor-pointer"}`}
        >
            <span className="material-symbols-outlined">delete</span>
            <span className="text-staff-mono font-semibold">
                {isOver
                    ? t.tabelaEditor.dropToDelete
                    : tap
                      ? t.tabelaEditor.tapToDelete
                      : t.tabelaEditor.dragToDelete}
            </span>
        </div>
    );
};

export default TrashZone;
