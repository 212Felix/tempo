import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './phase37/phase37.css' // final override: prevent white action buttons

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
