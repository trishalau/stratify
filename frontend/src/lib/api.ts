export type Business = {
  id: number
  name: string
  industry: string
  location: string
  currency: string
  monthly_revenue: string
  supplier_costs: string
  rent: string
  staff_salaries: string
  other_expenses: string
  cash_balance: string
  inventory_value: string | null
  liabilities: string | null
  custom_monthly_variables: { name: string; value: string }[]
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ScenarioInterpretation = {
  event_type: string
  title: string
  summary: string
  affected_variables: string[]
  assumptions: Record<string, string | number>
  assumption_evidence: Record<string, string>
  missing_information: string[]
  follow_up_questions: string[]
  simulation_supported: boolean
  ready_for_confirmation: boolean
  clarification_only?: boolean
  expense_category_suggestion?: { category: string; label: string; mentioned: string } | null
}

export type FinancialPosition = {
  currency: string
  monthly_revenue: string
  expenses: Record<string, string>
  total_expenses: string
  net_profit: string
}

export type SimulationCalculation = {
  scenario_id: number
  title: string
  event_type: string
  status: string
  currency: string
  period: string
  assumptions: Record<string, string | number>
  baseline: FinancialPosition
  estimate: FinancialPosition
  comparison: {
    range_available: boolean
    range_reason: string | null
    baseline: FinancialPosition
    optimistic: FinancialPosition | null
    central: FinancialPosition
    pessimistic: FinancialPosition | null
  }
  cash_flow: {
    available: boolean
    current_cash_balance: string
    estimated_change: string | null
    estimated_closing_balance: string | null
    reason: string
  }
  limitations: string[]
}

export type ScenarioExplanation = {
  summary: string
  drivers: { metric: string; direction: string; explanation: string }[]
  limitations: string[]
}

export type SavedScenario = {
  id: number
  business_id: number
  title: string
  event_type: string
  description: string | null
  assumptions: Record<string, string | number>
  missing_information: string[]
  status: 'draft' | 'confirmed'
  created_at: string
}

// VITE_API_BASE_URL is a public API origin, never a secret. Leave it unset
// during local development to use Vite's same-origin /api proxy.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${url}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new Error('Stratify could not reach the backend. Check that the Flask API is running.')
  }
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status}).`)
  if (!payload.data) throw new Error('The backend returned an unexpected response.')
  return payload.data
}

export const listBusinesses = () => request<Business[]>('/api/businesses')

export const updateBusiness = (businessId: number, changes: Partial<Omit<Business, 'id'>>) =>
  request<Business>(`/api/businesses/${businessId}`, {
    method: 'PATCH', body: JSON.stringify(changes),
  })

export const listScenarios = (businessId: number) =>
  request<SavedScenario[]>(`/api/businesses/${businessId}/scenarios`)

export const interpretScenario = (businessId: number, messages: ChatMessage[]) =>
  request<ScenarioInterpretation>(`/api/businesses/${businessId}/scenarios/interpret`, {
    method: 'POST', body: JSON.stringify({ messages }),
  })

export const interpretScenarioWithDemoProfile = (businessId: number, messages: ChatMessage[], business: Business) =>
  request<ScenarioInterpretation>(`/api/businesses/${businessId}/scenarios/interpret`, {
    method: 'POST', body: JSON.stringify({ messages, business_snapshot: businessSnapshot(business) }),
  })

export const businessSnapshot = (business: Business) => ({
  name: business.name, industry: business.industry, location: business.location, currency: business.currency,
  monthly_revenue: business.monthly_revenue, supplier_costs: business.supplier_costs, rent: business.rent,
  staff_salaries: business.staff_salaries, other_expenses: business.other_expenses, cash_balance: business.cash_balance,
  inventory_value: business.inventory_value, liabilities: business.liabilities,
  custom_monthly_variables: business.custom_monthly_variables,
})

export const createScenario = (businessId: number, input: {
  title: string
  event_type: string
  description: string
  assumptions: Record<string, string | number>
  missing_information: string[]
}) => request<{ id: number }>(`/api/businesses/${businessId}/scenarios`, {
  method: 'POST', body: JSON.stringify(input),
})

export const confirmScenario = (scenarioId: number) =>
  request<{ id: number }>(`/api/scenarios/${scenarioId}/confirm`, {
    method: 'POST', body: JSON.stringify({ confirmed: true }),
  })

export const simulateScenario = (scenarioId: number, business: Business) =>
  request<SimulationCalculation>(`/api/scenarios/${scenarioId}/simulate`, { method: 'POST', body: JSON.stringify({ business_snapshot: businessSnapshot(business) }) })

export const explainScenario = (scenarioId: number, business: Business) =>
  request<{ calculation: SimulationCalculation; explanation: ScenarioExplanation }>(
    `/api/scenarios/${scenarioId}/explain`, { method: 'POST', body: JSON.stringify({ business_snapshot: businessSnapshot(business) }) },
  )
