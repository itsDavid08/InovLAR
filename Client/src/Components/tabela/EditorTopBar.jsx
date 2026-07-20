import { DISPOSITIVOS } from "./constants";
import Segment from "./Segment";
import { t } from "../../i18n";

// Barra superior do editor (título + seletor de dispositivo + guardar) e, em
// mobile, uma segunda linha compacta só com os ícones de dispositivo.
const EditorTopBar = ({ titulo, utenteNome, dispositivo, setDispositivo, dirty, saving, onSave, onVoltar }) => (
    <>
        <div className="h-16 shrink-0 bg-surface-container-lowest border-b border-surface-variant flex items-center justify-between px-4 sm:px-6 gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    onClick={onVoltar}
                    className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    aria-label={t.common.back}
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <span className="w-9 h-9 rounded-xl bg-primary text-on-primary hidden sm:flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">grid_view</span>
                </span>
                <h1 className="font-display-lg text-xl font-bold text-on-surface truncate">
                    {titulo}
                </h1>
                <span className="text-on-surface-variant truncate hidden sm:inline">
                    — {utenteNome}
                </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
                <div className="hidden md:flex items-center gap-2">
                    <span className="text-staff-mono text-on-surface-variant">{t.tabelaEditor.device}</span>
                    <div className="flex bg-surface-container rounded-full p-1 gap-1">
                        {Object.entries(DISPOSITIVOS).map(([k, d]) => (
                            <Segment key={k} ativo={dispositivo === k} onClick={() => setDispositivo(k)}>
                                <span className="material-symbols-outlined text-[17px] align-middle mr-1">
                                    {d.icon}
                                </span>
                                {d.label}
                            </Segment>
                        ))}
                    </div>
                </div>
                <button
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className="px-5 py-2 rounded-full bg-primary text-on-primary text-staff-mono font-semibold hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {saving ? t.common.saving : t.common.save}
                </button>
            </div>
        </div>

        <div className="md:hidden flex items-center gap-2 px-4 pt-3">
            <div className="flex bg-surface-container rounded-full p-1 gap-1">
                {Object.entries(DISPOSITIVOS).map(([k, d]) => (
                    <Segment key={k} ativo={dispositivo === k} onClick={() => setDispositivo(k)}>
                        <span className="material-symbols-outlined text-[17px] align-middle">
                            {d.icon}
                        </span>
                    </Segment>
                ))}
            </div>
        </div>
    </>
);

export default EditorTopBar;
