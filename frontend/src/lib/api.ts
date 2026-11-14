export type Business = {
  id: number
  name: string
  currency: string
  monthly_revenue: string
  supplier_costs: string
  rent: string
  staff_salaries: string
  other_expenses: string
  cash_balance: string
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
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

export const listScenarios = (businessId: number) =>
  request<SavedScenario[]>(`/api/businesses/${businessId}/scenarios`)

export const interpretScenario = (businessId: number, messages: ChatMessage[]) =>
  request<ScenarioInterpretation>(`/api/businesses/${businessId}/scenarios/interpret`, {
    method: 'POST', body: JSON.stringify({ messages }),
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

export const simulateScenario = (scenarioId: number) =>
  request<SimulationCalculation>(`/api/scenarios/${scenarioId}/simulate`, { method: 'POST' })

export const explainScenario = (scenarioId: number) =>
  request<{ calculation: SimulationCalculation; explanation: ScenarioExplanation }>(
    `/api/scenarios/${scenarioId}/explain`, { method: 'POST' },
  )
