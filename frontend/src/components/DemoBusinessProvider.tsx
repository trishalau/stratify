import { useState, type ReactNode } from 'react'
import { DemoBusinessContext, originalDemoBusiness, type DemoScenarioRun } from './demo-business-context'

export function DemoBusinessProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState(originalDemoBusiness)
  const [demoScenarioRuns, setDemoScenarioRuns] = useState<DemoScenarioRun[]>([])
  return <DemoBusinessContext.Provider value={{ business, setBusiness, demoScenarioRuns, setDemoScenarioRuns }}>{children}</DemoBusinessContext.Provider>
}
