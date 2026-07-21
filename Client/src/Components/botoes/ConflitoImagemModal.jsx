// Modal de decisão quando o nome da imagem carregada já existe.
// 3 opções: adicionar como cópia (nome(1)), substituir a existente, ou cancelar.
// Componente presentacional — a decisão é resolvida por EditBotoes.
// (Markup próprio, não o <Modal> partilhado: este tem estilo próprio — fundo
// surface-container-lowest e raio xl — e mudá-lo alteraria o aspeto.)
import { t } from "../../i18n";

const ConflitoImagemModal = ({ nome, onCancelar, onSubstituir, onAdicionar }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onCancelar}
        >
            <div
                className="bg-surface-container-lowest rounded-xl shadow-lg border border-surface-variant max-w-md w-full p-6 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary text-3xl">warning</span>
                    <h2 className="font-headline-md text-xl font-bold text-on-surface">
                        {t.conflitoImagem.title}
                    </h2>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">
                    {t.conflitoImagem.body}{" "}
                    <strong className="text-on-surface break-all">{nome}</strong>
                    {t.conflitoImagem.bodyEnd}
                </p>
                <div className="flex flex-col gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onAdicionar}
                        className="w-full bg-primary text-on-primary py-3 rounded-full font-staff-mono text-staff-mono font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors"
                    >
                        {t.conflitoImagem.addCopy}
                    </button>
                    <button
                        type="button"
                        onClick={onSubstituir}
                        className="w-full bg-surface-container-high text-on-surface py-3 rounded-full font-staff-mono text-staff-mono font-bold hover:bg-surface-variant transition-colors"
                    >
                        {t.conflitoImagem.replace}
                    </button>
                    <button
                        type="button"
                        onClick={onCancelar}
                        className="w-full text-on-surface-variant py-2 rounded-full font-staff-mono text-staff-mono hover:bg-surface-container-high transition-colors"
                    >
                        {t.common.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConflitoImagemModal;
