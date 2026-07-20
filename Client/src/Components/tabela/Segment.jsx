// Botão de segmento (usado no seletor de dispositivo da barra superior).
const Segment = ({ ativo, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-staff-mono transition-colors ${ativo ? "bg-primary text-on-primary font-bold" : "text-on-surface-variant font-medium hover:bg-surface-container-high"}`}
    >
        {children}
    </button>
);

export default Segment;
