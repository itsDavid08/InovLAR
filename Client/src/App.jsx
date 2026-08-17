import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ContextProvider } from "./ContextProvider";

import TabuleiroComunicacao from "./Pages/TabuleiroComunicacao.jsx";
import StaffHome from "./Pages/StaffHome.jsx";
import PedidosPendentes from "./Pages/PedidosPendentes.jsx";
import HistoricoPedidos from "./Pages/HistoricoPedidos.jsx";
import EditUtente from "./Pages/EditUtente.jsx";
import NewUtente from "./Pages/NewUtente.jsx";
import GerirTabela from "./Pages/GerirTabela.jsx";
import TabelasView from "./Pages/TabelasView.jsx";
import GerirTemplate from "./Pages/GerirTemplate.jsx";
import EditBotoes from "./Pages/EditBotoes.jsx";
import Welcome from "./Pages/Welcome.jsx";
import StaffLogin from "./Pages/StaffLogin.jsx";
import ChangePassword from "./Pages/ChangePassword.jsx";
import RequireStaff from "./Components/RequireStaff.jsx";

function App() {

    return (
        <Router>
            <ContextProvider>

                <div className="main-content-area">
                    <Routes>
                        {/* Boas-vindas (raiz): convida a iniciar sessão. */}
                        <Route path="/" element={<Welcome />} />

                        {/* Ecrã de bloqueio: define a password na 1ª vez, ou pede o PIN. */}
                        <Route path="/login" element={<StaffLogin />} />

                        {/* Rotas só-staff: protegidas pelo gate de kiosk (RequireStaff). */}
                        <Route path="/edit-utente/:id" element={<RequireStaff><EditUtente /></RequireStaff>} />
                        <Route path="/gerir-tabela/:id" element={<RequireStaff><GerirTabela /></RequireStaff>} />
                        <Route path="/gerir-template/:id" element={<RequireStaff><GerirTemplate /></RequireStaff>} />
                        <Route path="/new-utente" element={<RequireStaff><NewUtente /></RequireStaff>} />
                        <Route path="/staff" element={<RequireStaff><StaffHome /></RequireStaff>} />
                        <Route path="/staff/tabelas" element={<RequireStaff><TabelasView /></RequireStaff>} />
                        <Route path="/staff/alterar-password" element={<RequireStaff><ChangePassword /></RequireStaff>} />
                        <Route path="/staff/pedidos" element={<RequireStaff><PedidosPendentes /></RequireStaff>} />
                        <Route path="/staff/historico" element={<RequireStaff><HistoricoPedidos /></RequireStaff>} />
                        <Route path="/edit-botoes" element={<RequireStaff><EditBotoes /></RequireStaff>} />

                        {/* Tabuleiro do utente — a "gaiola" (só se sai com PIN). A URL leva o
                            accessToken (segredo real, verificado no servidor), sob o prefixo /board. */}
                        <Route path="/board/:accessToken" element={<TabuleiroComunicacao />} />
                    </Routes>
                </div>


            </ContextProvider>
        </Router>
    );
}

export default App;
