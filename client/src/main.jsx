import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { MusicProvider } from './context/MusicContext.jsx'
import SmoothScroll from './components/SmoothScroll.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <MusicProvider>
        <SmoothScroll>
          <App />
        </SmoothScroll>
      </MusicProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
