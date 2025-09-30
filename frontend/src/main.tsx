import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

console.log('main.tsx loading')
console.log('React version:', React.version)

const rootEl = document.getElementById('root')
if (!rootEl) {
  console.error('Root element not found!')
} else {
  console.log('Root element found, creating React root...')
  const root = createRoot(rootEl)
  console.log('React root created, rendering App...')
  root.render(<App />)
  console.log('App rendered successfully')
}
