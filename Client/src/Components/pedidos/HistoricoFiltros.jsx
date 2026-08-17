import SearchInput from "../SearchInput";
import { PEDIDO_STATES } from "../../constants";
import { t } from "../../i18n";

// Barra de filtros do registo de pedidos (Pages/HistoricoPedidos.jsx).
// Componente "burro": recebe os valores e devolve alterações por `onChange`
// (patch parcial); quem sabe o que fazer com eles é o container, que os manda
// para o servidor — é lá que a filtragem acontece de facto.

// Data de hoje em YYYY-MM-DD, na hora LOCAL (o toISOString daria o dia em UTC,
// que à meia-noite portuguesa do verão ainda é o dia anterior).
const isoDia = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoje = () => isoDia(new Date());
const hojeMenos = (dias) => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return isoDia(d);
};

// Atalhos de intervalo. `null` nas duas pontas = sem limite de datas.
const PRESETS = [
    { chave: "hoje", label: t.historico.presetToday, valor: () => ({ de: hoje(), ate: hoje() }) },
    { chave: "7d", label: t.historico.presetWeek, valor: () => ({ de: hojeMenos(6), ate: hoje() }) },
    { chave: "30d", label: t.historico.presetMonth, valor: () => ({ de: hojeMenos(29), ate: hoje() }) },
    { chave: "tudo", label: t.historico.presetAll, valor: () => ({ de: "", ate: "" }) },
];

const CAMPO = "w-full px-3 py-2 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface font-staff-mono text-staff-mono";
const ROTULO = "block text-on-surface-variant font-label-xl text-sm font-semibold mb-1";

const HistoricoFiltros = ({ filtros, onChange, onLimpar, onAtualizar, utentes, categorias, temFiltros }) => {
    // Qual o atalho que corresponde ao intervalo atual (para o destacar).
    const presetAtivo = PRESETS.find((p) => {
        const v = p.valor();
        return v.de === filtros.de && v.ate === filtros.ate;
    })?.chave;

    return (
        <div className="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-surface-variant mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-body-xl text-body-xl font-semibold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">filter_alt</span>
                    {t.historico.filters}
                </h3>
                <div className="flex items-center gap-2">
                    {temFiltros && (
                        <button onClick={onLimpar}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high font-staff-mono text-staff-mono transition-colors">
                            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                            {t.historico.clear}
                        </button>
                    )}
                    <button onClick={onAtualizar} title={t.historico.refresh} aria-label={t.historico.refresh}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high font-staff-mono text-staff-mono transition-colors">
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                    </button>
                </div>
            </div>

            {/* Atalhos de intervalo */}
            <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map((p) => (
                    <button key={p.chave} onClick={() => onChange(p.valor())}
                        className={`px-3 py-1.5 rounded-full font-staff-mono text-staff-mono transition-colors ${
                            presetAtivo === p.chave
                                ? "bg-primary text-on-primary"
                                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                        }`}>
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <div>
                    <label htmlFor="hist-de" className={ROTULO}>{t.historico.from}</label>
                    <input id="hist-de" type="date" value={filtros.de} max={filtros.ate || undefined}
                        onChange={(e) => onChange({ de: e.target.value })} className={CAMPO} />
                </div>
                <div>
                    <label htmlFor="hist-ate" className={ROTULO}>{t.historico.to}</label>
                    <input id="hist-ate" type="date" value={filtros.ate} min={filtros.de || undefined}
                        onChange={(e) => onChange({ ate: e.target.value })} className={CAMPO} />
                </div>
                <div>
                    <label htmlFor="hist-utente" className={ROTULO}>{t.historico.utente}</label>
                    <select id="hist-utente" value={filtros.utenteId}
                        onChange={(e) => onChange({ utenteId: e.target.value })} className={CAMPO}>
                        <option value="">{t.historico.allUtentes}</option>
                        {utentes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="hist-estado" className={ROTULO}>{t.historico.state}</label>
                    <select id="hist-estado" value={filtros.estado}
                        onChange={(e) => onChange({ estado: e.target.value })} className={CAMPO}>
                        <option value="">{t.historico.allStates}</option>
                        {Object.values(PEDIDO_STATES).map((e) => (
                            <option key={e} value={e}>{t.historico.estados[e]}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="hist-categoria" className={ROTULO}>{t.historico.category}</label>
                    <select id="hist-categoria" value={filtros.categoria}
                        onChange={(e) => onChange({ categoria: e.target.value })} className={CAMPO}>
                        <option value="">{t.historico.allCategories}</option>
                        {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="hist-tipo" className={ROTULO}>{t.historico.type}</label>
                    <select id="hist-tipo" value={filtros.emergencia}
                        onChange={(e) => onChange({ emergencia: e.target.value })} className={CAMPO}>
                        <option value="">{t.historico.allTypes}</option>
                        <option value="true">{t.historico.onlyEmergencies}</option>
                        <option value="false">{t.historico.onlyNormal}</option>
                    </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
                    <SearchInput value={filtros.q} onChange={(v) => onChange({ q: v })}
                        placeholder={t.historico.searchPlaceholder} />
                </div>
            </div>
        </div>
    );
};

export default HistoricoFiltros;
