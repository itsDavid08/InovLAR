import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ContextProvider } from "./ContextProvider";

import UtenteHome from "./Pages/UtenteHome.jsx";
import MainContent from "./Pages/MainContent";
import StaffHome from "./Pages/StaffHome.jsx";
import PedidosPendentes from "./Pages/PedidosPendentes.jsx";

import EditUtente from "./Components/EditUtente.jsx";
import NewUtente from "./Components/NewUtente.jsx";

import EditBotoes from "./Components/EditBotoes.jsx";
import Home from "./Pages/Home.jsx";
import StaffLogin from "./Pages/StaffLogin.jsx";
import ChangePassword from "./Pages/ChangePassword.jsx";
import RequireStaff from "./Components/RequireStaff.jsx";

function App() {

    return (
        <Router>
            <ContextProvider>

                <div className="main-content-area">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/utente" element={<UtenteHome />} />
                        <Route path="/main/:id" element={<MainContent />} />

                        {/* Ecrã de login do staff (define a password na 1ª vez, ou pede-a) */}
                        <Route path="/staff/login" element={<StaffLogin />} />

                        {/* Rotas só-staff: protegidas pelo guarda RequireStaff */}
                        <Route path="/edit-utente/:id" element={<RequireStaff><EditUtente /></RequireStaff>} />
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

/*

<RequestListDrawer visible={isDrawerVisible} onClose={hideDrawer} />
<SuccessModal visible={isModalVisible} onClose={hideModal} />

*/