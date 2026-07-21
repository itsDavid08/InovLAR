import { t } from "../../i18n";

// Itens de navegação do staff — fonte única partilhada pela sidebar (desktop,
// StaffSidebar) e pela barra inferior (mobile, StaffBottomNav). Mantém as duas
// navegações sempre em sincronia.
//  - `label` : rótulo completo usado na sidebar do desktop.
//  - `short` : rótulo curto da barra inferior (espaço limitado em mobile).
//  - `icon`  : nome do ícone Material Symbols.
//  - `path`  : rota de destino.
export const NAV_ITEMS = [
    { label: t.nav.utentes, short: t.nav.utentes, icon: "groups", path: "/staff" },
    { label: t.nav.botoes, short: t.nav.botoes, icon: "tune", path: "/editBotoes" },
    { label: t.nav.tabelas, short: t.nav.tabelas, icon: "grid_view", path: "/staff/tabelas" },
    { label: t.nav.pedidosPendentes, short: t.nav.pedidosShort, icon: "pending_actions", path: "/staff/pedidos" },
    { label: t.nav.changePassword, short: t.nav.passwordShort, icon: "lock", path: "/staff/alterar-password" },
];
