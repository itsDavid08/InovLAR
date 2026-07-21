import { useContext, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../ContextProvider";
import StaffShell from "../Components/layout/StaffShell";
import StaffSidebar from "../Components/layout/StaffSidebar";
import ItemMenu from "../Components/layout/ItemMenu";
import UtenteAvatar from "../Components/utentes/UtenteAvatar";
import SearchInput from "../Components/SearchInput";
import FeedbackToast from "../Components/FeedbackToast";
import { useFeedback } from "../hooks/useFeedback";
import { rotateUtenteToken } from "../api/utentes";
import { t } from "../i18n";

// URL completa do tabuleiro de um utente (o que se põe/bookmarka no tablet).
const boardUrl = (utente) => `${window.location.origin}/board/${utente.accessToken}`;

const StaffHome = () => {
    const { utentes, setUtente, deleteUtente, apiUrl } = useContext(Context);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [feedback, setFeedback] = useFeedback();
    // Qual cartão tem o menu de ações aberto (só um de cada vez). O ref aponta para
    // esse cartão e serve de fronteira ao "clicar fora" do ItemMenu (ver ItemMenu.jsx).
    const [openMenuId, setOpenMenuId] = useState(null);
    const openCardRef = useRef(null);

    // Iniciar a sessão do utente: entra na "gaiola". O fecho do gate é feito pelo
    // próprio tabuleiro ao montar — se o fizéssemos aqui, o RequireStaff (ainda
    // montado em /staff) redirecionaria para o bloqueio durante a navegação.
    const handleOpen = (utente) => {
        setUtente(utente);
        navigate("/board/" + utente.accessToken);
    };

    const handleEdit = (utente) => {
        navigate(`/edit-utente/${utente.id}`);
    };

    const handleManage = (utente) => {
        navigate(`/gerir-tabela/${utente.id}`);
    };

    const handleDelete = async (utente) => {
        if (window.confirm(t.staffHome.deleteConfirm(utente.nome))) {
            await deleteUtente(utente.id);
        }
    };

    // Copia a URL do tablet para a área de transferência (setup do dispositivo).
    const handleCopyUrl = async (utente) => {
        try {
            await navigator.clipboard.writeText(boardUrl(utente));
            setFeedback({ tipo: "ok", texto: t.staffHome.copyUrlDone });
        } catch {
            setFeedback({ tipo: "erro", texto: t.staffHome.copyUrlError });
        }
    };

    // Gera um novo accessToken (revoga o URL antigo) e copia logo o URL novo.
    const handleRotate = async (utente) => {
        if (!window.confirm(t.staffHome.rotateConfirm(utente.nome))) return;
        try {
            const { accessToken } = await rotateUtenteToken(utente.id);
            try {
                await navigator.clipboard.writeText(`${window.location.origin}/board/${accessToken}`);
            } catch { /* a cópia pode falhar (permissões) — o novo link fica na mesma ativo */ }
            setFeedback({ tipo: "ok", texto: t.staffHome.rotateDone });
        } catch {
            setFeedback({ tipo: "erro", texto: t.staffHome.rotateError });
        }
    };

    const handleNew = () => {
        navigate("/new-utente");
    };

    // Procura só por nome (por agora). Outros critérios podem ser adicionados depois.
    const utentesFiltrados = utentes.filter((u) =>
        u.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <StaffShell sidebar={<StaffSidebar />}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
                <div>
                    <h2 className="font-display-lg text-3xl md:text-2xl font-bold text-on-surface mb-1">{t.staffHome.title}</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant">{t.staffHome.subtitle}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <SearchInput value={searchQuery} onChange={setSearchQuery}
                        placeholder={t.common.searchUtentePlaceholder}
                        className="flex-1 sm:flex-none" inputClassName="sm:w-56" />
                    <button
                        onClick={handleNew}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-staff-mono text-staff-mono hover:bg-primary-container hover:text-on-primary-container transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined">add</span>
                        {t.staffHome.newUtente}
                    </button>
                </div>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {utentesFiltrados.map((utente) => (
                    <div
                        key={utente.id}
                        ref={openMenuId === utente.id ? openCardRef : null}
                        onClick={() => setOpenMenuId((id) => (id === utente.id ? null : utente.id))}
                        className={`bg-surface-container-lowest rounded-lg p-3 shadow-sm border border-surface-variant hover:shadow-md transition-all relative overflow-hidden group cursor-pointer ${openMenuId === utente.id ? "z-50" : ""}`}
                    >
                        {/* z-50 quando aberto: eleva o cartão e o seu sheet/backdrop acima
                            dos vizinhos e da barra inferior. */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-status-green"></div>
                        <div className="flex items-start justify-between mb-3">
                            <UtenteAvatar
                                imagem={utente.imagem}
                                corAvatar={utente.corAvatar}
                                nome={utente.nome}
                                apiUrl={apiUrl}
                                className="w-11 h-11 text-[16px] border-2 border-surface-container"
                            />
                            <div className="flex items-center gap-1">
                                <div className="px-2 py-1 rounded text-xs font-staff-mono font-bold text-status-green flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">check_circle</span> {t.utentes.stable}
                                </div>
                                <ItemMenu
                                    open={openMenuId === utente.id}
                                    onOpenChange={(v) => setOpenMenuId(v ? utente.id : null)}
                                    boundaryRef={openCardRef}
                                    title={utente.nome}
                                    subtitle={utente.quarto || t.utentes.room}
                                    thumbnail={<UtenteAvatar imagem={utente.imagem} corAvatar={utente.corAvatar} nome={utente.nome} apiUrl={apiUrl} className="w-full h-full text-[16px]" />}
                                    onManage={() => handleManage(utente)}
                                    onEdit={() => handleEdit(utente)}
                                    onCopyUrl={() => handleCopyUrl(utente)}
                                    onRotateToken={() => handleRotate(utente)}
                                    onDelete={() => handleDelete(utente)}
                                />
                            </div>
                        </div>
                        <h3 className="font-body-xl text-body-xl font-semibold text-on-surface mb-1 truncate" title={utente.nome}>{utente.nome}</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant mb-3 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">meeting_room</span> {utente.quarto || t.utentes.roomPreview}
                        </p>
                        <div className="flex gap-2">
                            <button
                                className="flex-1 py-2 rounded-full font-staff-mono text-staff-mono transition-colors bg-surface-container-high text-on-surface hover:bg-surface-variant"
                                onClick={(e) => { e.stopPropagation(); handleOpen(utente); }}
                            >
                                {t.staffHome.openBoard}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <FeedbackToast feedback={feedback} zClass="z-[70]" />
        </StaffShell>
    );
};

export default StaffHome;
