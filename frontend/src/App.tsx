import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { DemoBusinessProvider } from './components/DemoBusinessProvider'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Business = lazy(() => import('./pages/Business'))
const Simulator = lazy(() => import('./pages/Simulator'))
const Results = lazy(() => import('./pages/Results'))
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return <DemoBusinessProvider><BrowserRouter><Suspense fallback={<div className="route-loading">Loading Stratify…</div>}><Routes><Route element={<AppLayout />}>
    <Route index element={<Dashboard />} /><Route path="business" element={<Business />} /><Route path="simulator" element={<Simulator />} /><Route path="results" element={<Results />} /><Route path="history" element={<History />} /><Route path="settings" element={<Settings />} /><Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes></Suspense></BrowserRouter></DemoBusinessProvider>
}

export default App
