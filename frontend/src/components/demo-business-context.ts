import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { Business } from '../lib/api'

export const originalDemoBusiness: Business = {
  id: 1,
  name: 'KL Electronics Sdn. Bhd.',
  industry: 'Consumer electronics retail',
  location: 'Kuala Lumpur, Malaysia',
  currency: 'MYR',
  monthly_revenue: '120000.00',
  supplier_costs: '40000.00',
  rent: '10000.00',
  staff_salaries: '20000.00',
  other_expenses: '12000.00',
  cash_balance: '160000.00',
  inventory_value: null,
  liabilities: null,
  custom_monthly_variables: [],
}

export const DemoBusinessContext = createContext<{ business: Business; setBusiness: Dispatch<SetStateAction<Business>> } | null>(null)

export function useDemoBusiness() {
  const value = useContext(DemoBusinessContext)
  if (!value) throw new Error('useDemoBusiness must be used inside DemoBusinessProvider.')
  return value
}
