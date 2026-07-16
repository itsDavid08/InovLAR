// Base modal: dimmed backdrop, click outside closes, clicks inside don't
// propagate. Content styling (width, padding) comes via className.
const Modal = ({ onClose, className = "max-w-md", zClass = "z-[60]", children }) => (
    <div
        className={`fixed inset-0 ${zClass} bg-black/40 flex items-center justify-center p-4`}
        onClick={onClose}
    >
        <div
            className={`bg-surface-container rounded-2xl shadow-xl w-full ${className}`}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    </div>
);

export default Modal;
