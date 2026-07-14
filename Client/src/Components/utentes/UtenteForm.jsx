// Formulário partilhado de utente (criar/editar) + pré-visualização ao vivo.
// Presentacional: os dados e a submissão vivem nos wrappers EditUtente/NewUtente.
// Mesmo layout do BotaoForm: header com voltar + form|preview lado a lado. Em
// mobile (flex-col-reverse) a pré-visualização fica em cima e o formulário por
// baixo; em desktop (lg:flex-row) form à esquerda, preview à direita.
import { useRef } from "react";
import UtenteAvatar, { ICONE_PESSOA } from "./UtenteAvatar";

// Paleta de cores de fundo do avatar (recolore iniciais e ícone). Pastéis legíveis.
const CORES_AVATAR = ["#c7dbff", "#c9ecd3", "#ffe0c2", "#e6d6f7", "#ffd6e0", "#d6f0f5", "#f5e6c2"];

const UtenteForm = ({
    title,
    formData,
    setFormData,
    onSubmit,
    onCancel,
    submitLabel,
    quartoRequired = false,
    hiddenId,
    templates,
    onCriarNovo,
    apiUrl = "",
    onUploadFoto,
    onRemoverFoto,
}) => {
    const uploadInputRef = useRef(null);
    // Foto pessoal = imagem que é um caminho (não vazia e não o ícone).
    const temFotoPessoal = formData.imagem && formData.imagem !== ICONE_PESSOA;

    return (
        <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md">
            <header className="bg-surface dark:bg-inverse-surface top-0 sticky bg-surface-container-low dark:bg-surface-container shadow-sm z-30 border-b border-surface-variant">
                <div className="flex items-center px-6 h-20 w-full max-w-7xl mx-auto gap-4">
                    <button onClick={onCancel} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full active:opacity-80 transition-opacity flex items-center justify-center">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="font-headline-md text-headline-md font-black text-primary dark:text-inverse-primary">
                        {title}
                    </h1>
                </div>
            </header>

            <div className="p-6 md:p-12 flex-1 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col-reverse lg:flex-row gap-8 items-start">
                <form onSubmit={onSubmit} className="w-full lg:flex-1 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-variant flex flex-col gap-6">
                    {hiddenId !== undefined && (
                        <input type="hidden" value={hiddenId} readOnly />
                    )}

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Nome
                        </label>
                        <input
                            type="text"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                            placeholder="Nome do utente"
                        />
                    </div>

                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Quarto
                        </label>
                        <input
                            type="text"
                            value={formData.quarto || ''}
                            onChange={(e) => setFormData({ ...formData, quarto: e.target.value })}
                            required={quartoRequired}
                            className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                            placeholder="Ex.: A112"
                        />
                    </div>

                    {/* Avatar: escolher O QUE mostrar (iniciais, ícone, foto atual, ou carregar). */}
                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                            Avatar
                        </label>
                        <div className="flex flex-wrap gap-3 p-3 bg-surface-container rounded-lg border border-outline-variant">
                            {/* Iniciais (imagem vazia) — recolorida pela cor de fundo. */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, imagem: '' })}
                                title="Usar iniciais"
                                className="flex flex-col items-center gap-1 w-16"
                            >
                                <UtenteAvatar
                                    imagem=""
                                    corAvatar={formData.corAvatar}
                                    nome={formData.nome}
                                    className={`w-14 h-14 text-[18px] transition-all ${!formData.imagem ? 'ring-4 ring-primary scale-95' : 'hover:scale-105'}`}
                                />
                                <span className="text-[11px] text-on-surface-variant leading-tight text-center">Iniciais</span>
                            </button>

                            {/* Ícone de pessoa — recolorido pela cor de fundo. */}
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, imagem: ICONE_PESSOA })}
                                title="Usar ícone"
                                className="flex flex-col items-center gap-1 w-16"
                            >
                                <UtenteAvatar
                                    imagem={ICONE_PESSOA}
                                    corAvatar={formData.corAvatar}
                                    className={`w-14 h-14 text-[20px] transition-all ${formData.imagem === ICONE_PESSOA ? 'ring-4 ring-primary scale-95' : 'hover:scale-105'}`}
                                />
                                <span className="text-[11px] text-on-surface-variant leading-tight text-center">Ícone</span>
                            </button>

                            {/* Foto atual: upload pessoal (só aparece quando existe). */}
                            {temFotoPessoal && (
                                <div className="flex flex-col items-center gap-1 w-16">
                                    <div className="relative group/foto">
                                        <img
                                            src={`${apiUrl}${formData.imagem}`}
                                            alt="Foto pessoal"
                                            className="w-14 h-14 rounded-full object-cover ring-4 ring-primary scale-95"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => onRemoverFoto && onRemoverFoto()}
                                            title="Remover foto"
                                            className="absolute -top-1 -right-1 bg-error text-on-error rounded-full p-0.5 shadow flex"
                                        >
                                            <span className="material-symbols-outlined text-[14px] leading-none">close</span>
                                        </button>
                                    </div>
                                    <span className="text-[11px] text-on-surface-variant leading-tight text-center">Foto atual</span>
                                </div>
                            )}

                            {/* Carregar foto do dispositivo. */}
                            <button
                                type="button"
                                onClick={() => uploadInputRef.current?.click()}
                                title="Carregar foto"
                                className="flex flex-col items-center gap-1 w-16"
                            >
                                <div className="w-14 h-14 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined">add_a_photo</span>
                                </div>
                                <span className="text-[11px] text-on-surface-variant leading-tight text-center">Carregar</span>
                            </button>
                            <input
                                ref={uploadInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => { if (e.target.files[0] && onUploadFoto) onUploadFoto(e.target.files[0]); e.target.value = ''; }}
                            />
                        </div>
                    </div>

                    {/* Cor de fundo — recolore as iniciais e o ícone (não afeta fotos). */}
                    <div>
                        <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-1">
                            Cor de fundo
                        </label>
                        <p className="text-xs text-on-surface-variant mb-2">Recolore as iniciais e o ícone (quando não há foto).</p>
                        <div className="flex flex-wrap gap-2">
                            {CORES_AVATAR.map((cor) => (
                                <button
                                    key={cor}
                                    type="button"
                                    title={`Cor ${cor}`}
                                    onClick={() => setFormData({ ...formData, corAvatar: cor })}
                                    style={{ backgroundColor: cor }}
                                    className={`w-8 h-8 rounded-full border transition-all ${formData.corAvatar === cor ? 'ring-4 ring-primary scale-95' : 'border-outline-variant hover:scale-110'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {templates && (
                        <div>
                            <label className="block text-on-surface-variant font-label-xl text-sm font-semibold mb-2">
                                Tabela (template)
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={formData.templateId || ''}
                                    onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                                    required
                                    className="flex-1 px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-on-surface"
                                >
                                    <option value="" disabled>Escolhe um template…</option>
                                    {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                </select>
                                {onCriarNovo && (
                                    <button type="button" onClick={onCriarNovo}
                                        className="px-4 py-3 rounded-lg bg-surface-container-high text-on-surface font-staff-mono whitespace-nowrap hover:bg-surface-variant transition-colors flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[18px]">add</span> Criar do zero
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-on-surface-variant mt-1">Ou cria uma tabela personalizada para este utente, desde o zero.</p>
                        </div>
                    )}

                    <div className="flex gap-4 pt-4 border-t border-surface-variant">
                        <button
                            type="submit"
                            className="flex-1 bg-primary text-on-primary py-3 rounded-full font-staff-mono text-staff-mono font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm"
                        >
                            {submitLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-surface-container-high text-on-surface py-3 rounded-full font-staff-mono text-staff-mono font-bold hover:bg-surface-variant transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>

                {/* Preview — flex-col-reverse põe-a em cima em mobile; lg:flex-row à direita em desktop.
                    (Não usar order-*: o Tailwind Play CDN não deixa lg:order-* sobrepor o order-* base.) */}
                <div className="w-full lg:flex-1 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-variant flex flex-col items-center">
                    <h2 className="font-display-lg text-2xl font-bold text-on-surface mb-6 w-full underline decoration-primary decoration-4 underline-offset-8">Pré-visualização</h2>

                    <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-surface-variant hover:shadow-md hover:border-primary transition-all relative overflow-hidden group w-full max-w-sm">
                        <div className="absolute top-0 left-0 w-full h-1 bg-status-green"></div>
                        <div className="flex items-start justify-between mb-4">
                            <UtenteAvatar
                                imagem={formData.imagem}
                                corAvatar={formData.corAvatar}
                                nome={formData.nome}
                                apiUrl={apiUrl}
                                className="w-16 h-16 text-[24px] border-2 border-surface-container"
                            />
                            <div className="px-2 py-1 rounded text-xs font-staff-mono font-bold text-status-green flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Estável
                            </div>
                        </div>
                        <h3 className="font-body-xl text-body-xl font-semibold text-on-surface mb-1 truncate" title={formData.nome || "Nome"}>
                            {formData.nome || "Nome do utente"}
                        </h3>
                        <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">meeting_room</span>
                            {formData.quarto || "Quarto"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UtenteForm;
