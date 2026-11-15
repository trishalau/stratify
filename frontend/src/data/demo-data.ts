export const business = {
  name: 'KL Electronics Sdn. Bhd.',
  industry: 'Consumer electronics retail',
  location: 'Kuala Lumpur, Malaysia',
  currency: 'MYR',
  revenue: 120000,
  expenses: 82000,
  supplierCosts: 40000,
  rent: 10000,
  salaries: 20000,
  otherExpenses: 12000,
  cash: 160000,
  profit: 38000,
}

export const monthlyTrend = [
  { month: 'Jun', revenue: 105, expenses: 69 },
  { month: 'Jul', revenue: 112, expenses: 74 },
  { month: 'Aug', revenue: 108, expenses: 71 },
  { month: 'Sep', revenue: 116, expenses: 77 },
  { month: 'Oct', revenue: 114, expenses: 76 },
  { month: 'Nov', revenue: 120, expenses: 82 },
]

export const scenarios = [
  { id: 'supplier', title: 'Supplier prices rise', description: 'Model a change in the cost of goods and materials.', icon: 'package', tag: 'Cost pressure' },
  { id: 'sales', title: 'Sales decrease', description: 'Explore a drop in monthly sales volume or revenue.', icon: 'trending-down', tag: 'Revenue risk' },
  { id: 'customer', title: 'Major customer leaves', description: 'Assess the effect of losing a key account.', icon: 'user-round-x', tag: 'Customer risk' },
  { id: 'competitor', title: 'New competitor enters', description: 'Consider a potential shift in your market.', icon: 'target', tag: 'Market change' },
  { id: 'interest', title: 'Interest rates increase', description: 'Review pressure on borrowing costs.', icon: 'landmark', tag: 'Finance' },
  { id: 'branch', title: 'Open a new branch', description: 'Explore the costs of a planned expansion.', icon: 'store', tag: 'Growth' },
]

// Static illustration only. Phase 3 will replace these fixtures with results
// from the deterministic backend financial engine.
export const demoResult = {
  title: 'Supplier prices rise by 20%',
  date: '14 Nov 2026',
  rows: [
    { label: 'Monthly revenue', baseline: 'RM120,000', scenario: 'RM120,000', change: 'No change', tone: 'neutral' },
    { label: 'Monthly expenses', baseline: 'RM82,000', scenario: 'RM90,000', change: '+RM8,000', tone: 'negative' },
    { label: 'Net profit', baseline: 'RM38,000', scenario: 'RM30,000', change: '−RM8,000', tone: 'negative' },
    { label: 'Cash balance', baseline: 'RM160,000', scenario: 'RM152,000', change: '−RM8,000', tone: 'negative' },
  ],
}

export const recentScenarios = [
  { title: 'Supplier prices rise by 20%', type: 'Cost pressure', date: '14 Nov 2026', impact: '−RM8,000 / month', tone: 'negative' },
  { title: 'Monthly sales decrease by 10%', type: 'Revenue risk', date: '12 Nov 2026', impact: '−RM12,000 / month', tone: 'negative' },
  { title: 'Open a second branch', type: 'Growth', date: '08 Nov 2026', impact: 'Under review', tone: 'neutral' },
]

export const money = (amount: number) => `RM${amount.toLocaleString('en-MY')}`
