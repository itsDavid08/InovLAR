import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ContextProvider } from "./ContextProvider";

import MainContent from "./Pages/MainContent";
import StaffHome from "./Pages/StaffHome.jsx";
import PedidosPendentes from "./Pages/PedidosPendentes.jsx";

import EditUtente from "./Components/utentes/EditUtente.jsx";
import NewUtente from "./Components/utentes/NewUtente.jsx";
import GerirTabela from "./Pages/GerirTabela.jsx";

import EditBotoes from "./Components/botoes/EditBotoes.jsx";
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

                        {/* Tabuleiro do utente — a "gaiola". Sem saída livre: só se sai com PIN. */}
                        <Route path="/main/:id" element={<MainContent />} />

                        {/* Rotas só-staff: protegidas pelo gate de kiosk (RequireStaff). */}
                        <Route path="/edit-utente/:id" element={<RequireStaff><EditUtente /></RequireStaff>} />
                        <Route path="/gerir-tabela/:id" element={<RequireStaff><GerirTabela /></RequireStaff>} />
                        <Route path="/new-utente" element={<RequireStaff><NewUtente /></RequireStaff>} />
                        <Route path="/staff" element={<RequireStaff><StaffHome /></RequireStaff>} />
                        <Route path="/staff/alterar-password" element={<RequireStaff><ChangePassword /></RequireStaff>} />
                        <Route path="/staff/pedidos" element={<RequireStaff><PedidosPendentes /></RequireStaff>} />
                        <Route path="/editBotoes" element={<RequireStaff><EditBotoes /></RequireStaff>} />
                    </Routes>
                </div>


            </ContextProvider>
        </Router>
    );
}

export default App;
