import Modal from "./Modal";
import { t } from "../i18n";

// Confirmação de pedido enviado. Usa o Modal partilhado (backdrop, fecha ao
// clicar fora) — antes dependia do antd só para isto.
const SuccessModal = ({ visible, onClose }) => {
    if (!visible) return null;
    return (
        <Modal onClose={onClose} className="max-w-sm">
            <div className="p-6 text-center">
                <h2 className="text-headline-md-mobile font-headline-md text-on-surface m-0">
                    ✅ {t.tabuleiro.requestSent}
                </h2>
            </div>
        </Modal>
    );
};

export default SuccessModal;
