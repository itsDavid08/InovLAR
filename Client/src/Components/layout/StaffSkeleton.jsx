import StaffShell from "./StaffShell";
import StaffSidebar from "./StaffSidebar";

// Esqueleto das páginas de staff: mostrado enquanto se confirma o cookie de
// acesso ao arrancar (ver RequireStaff) — em vez de página em branco ou
// "A carregar…". Reaproveita o shell real (sidebar no desktop / barra inferior
// no mobile) e enche o conteúdo com blocos em `animate-pulse` (estilo
// Instagram/Facebook: chrome real + conteúdo "fantasma").
const Bloco = ({ className }) => (
    <div className={`bg-surface-container animate-pulse rounded ${className}`} />
);

const StaffSkeleton = () => {
    return (
        <StaffShell sidebar={<StaffSidebar />}>
            {/* Cabeçalho (título + procura + ação) */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
                <div className="space-y-2">
                    <Bloco className="h-7 w-56 max-w-full" />
                    <Bloco className="h-4 w-72 max-w-full" />
                </div>
                <div className="flex items-center gap-3">
                    <Bloco className="h-10 w-full sm:w-56 rounded-full" />
                    <Bloco className="h-10 w-32 rounded-full shrink-0" />
                </div>
            </div>

            {/* Grelha de cartões "fantasma" */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        className="bg-surface-container-lowest border border-surface-variant rounded-lg p-4 flex flex-col items-center gap-3"
                    >
                        <Bloco className="w-16 h-16 rounded-2xl" />
                        <Bloco className="h-4 w-3/4" />
                        <Bloco className="h-3 w-1/2" />
                    </div>
                ))}
            </div>
        </StaffShell>
    );
};

export default StaffSkeleton;
