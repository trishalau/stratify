import { useState, type ReactNode } from 'react'
import { DemoBusinessContext, originalDemoBusiness } from './demo-business-context'

export function DemoBusinessProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState(originalDemoBusiness)
  return <DemoBusinessContext.Provider value={{ business, setBusiness }}>{children}</DemoBusinessContext.Provider>
}
