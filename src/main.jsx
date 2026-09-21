import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './themes/theme.css'
/* Visual World 兼容垫片：必须在 theme.css 之后，才能覆盖 Tailwind 的同名工具类 */
import './themes/world-shim.css'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)