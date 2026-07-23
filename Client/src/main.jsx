import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css';
import './fonts.css'
import './index.css'
import './tailwind.css' // por último: reproduz a ordem do antigo CDN (ver tailwind.css)
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
