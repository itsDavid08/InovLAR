// Itens de navegação do staff — fonte única partilhada pela sidebar (desktop,
// StaffSidebar) e pela barra inferior (mobile, StaffBottomNav). Mantém as duas
// navegações sempre em sincronia.
//  - `label` : rótulo completo usado na sidebar do desktop.
//  - `short` : rótulo curto da barra inferior (espaço limitado em mobile).
//  - `icon`  : nome do ícone Material Symbols.
//  - `path`  : rota de destino.
export const NAV_ITEMS = [
    { label: "Utentes", short: "Utentes", icon: "groups", path: "/staff" },
    { label: "Botões", short: "Botões", icon: "tune", path: "/editBotoes" },
    { label: "Pedidos Pendentes", short: "Pedidos", icon: "pending_actions", path: "/staff/pedidos" },
    { label: "Alterar Password", short: "Password", icon: "lock", path: "/staff/alterar-password" },
];
