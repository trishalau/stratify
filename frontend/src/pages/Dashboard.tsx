import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp, CreditCard, Plus, Wallet } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, DemoNotice, PageHeader, Button } from '../components/ui'
import { money, monthlyTrend, recentScenarios } from '../data/demo-data'
import { useDemoBusiness } from '../components/demo-business-context'

function MetricCard({ label, value, change, icon: Icon, tone, footnote, trend }: { label: string; value: string; change: string; icon: typeof Wallet; tone: string; footnote: string; trend?: number[] }) {
  const low = trend ? Math.min(...trend) : 0
  const high = trend ? Math.max(...trend) : 0
  const points = trend?.map((point, index) => {
    const x = trend.length > 1 ? 2 + index * 76 / (trend.length - 1) : 40
    const y = high === low ? 13 : 22 - (point - low) / (high - low) * 18
    return `${x},${y}`
  }).join(' ')
  const lastPoint = points?.split(' ').at(-1)?.split(',')
  return <Card className="metric-card">
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-bottom"><span className={`metric-change ${tone}`}><i />{change}</span><span>{footnote}</span></div>
    {points && lastPoint && <div className={`metric-sparkline-row sparkline-${tone}`}><span>Demo trend</span><svg viewBox="0 0 80 26" aria-hidden="true"><polyline points={points} /><circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.2" /></svg></div>}
  </Card>
}

export default function Dashboard() {
  const { business } = useDemoBusiness()
  const revenue = Number(business.monthly_revenue) + business.custom_monthly_variables.filter((item) => item.type === 'revenue').reduce((sum, item) => sum + Number(item.value || 0), 0)
  const expenseMix = [
    { name: 'Supplier costs', value: Number(business.supplier_costs), color: '#3d8066', className: 'mix-supplier' },
    { name: 'Rent', value: Number(business.rent), color: '#7b7094', className: 'mix-rent' },
    { name: 'Salaries', value: Number(business.staff_salaries), color: '#7197ae', className: 'mix-salaries' },
    { name: 'Other', value: Number(business.other_expenses), color: '#c39a59', className: 'mix-other' },
    ...business.custom_monthly_variables.filter((item) => item.type !== 'revenue').map((item) => ({ name: item.name, value: Number(item.value), color: '#88a785', className: 'mix-custom' })),
  ].filter((item) => Number.isFinite(item.value) && item.value > 0)
  const expenses = expenseMix.reduce((sum, item) => sum + item.value, 0)
  const profit = revenue - expenses
  const cashBalance = Number(business.cash_balance)
  const runwayMonths = expenses > 0 ? cashBalance / expenses : 0
  const runwayProgress = Math.min(100, Math.max(0, runwayMonths / 3 * 100))
  const currency = business.currency ?? 'MYR'
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
  return <>
    <PageHeader eyebrow="SATURDAY, NOVEMBER 14, 2026" title="Good morning, Alex" description="Here’s the latest snapshot of your business." action={<Button to="/simulator"><Plus size={16} /> New simulation</Button>} />
    <DemoNotice />
    <div className="metric-grid">
      <MetricCard label="Monthly revenue" value={money(revenue)} change="Live profile" icon={ArrowUpRight} tone="positive" footnote="current baseline" trend={monthlyTrend.map((point) => point.revenue)} />
      <MetricCard label="Monthly expenses" value={money(expenses)} change="Live profile" icon={CreditCard} tone="neutral" footnote="current baseline" trend={monthlyTrend.map((point) => point.expenses)} />
      <MetricCard label="Net profit" value={money(profit)} change="Calculated" icon={ArrowUpRight} tone={profit >= 0 ? 'positive' : 'negative'} footnote="revenue less expenses" trend={monthlyTrend.map((point) => point.revenue - point.expenses)} />
      <MetricCard label="Cash balance" value={money(cashBalance)} change="Live profile" icon={Wallet} tone="positive" footnote="current balance" />
    </div>

    <div className="dashboard-grid">
      <Card className="chart-card">
        <div className="section-head"><div><div className="section-title">Revenue & expenses</div><div className="section-subtitle">Monthly overview <span className="muted-bullet">·</span> Last 6 months</div></div><button className="select-chip">Last 6 months <span>⌄</span></button></div>
        <div className="chart-legend"><span><i className="legend-swatch revenue-swatch" />Revenue</span><span><i className="legend-swatch expense-swatch" />Expenses</span></div>
        <div className="main-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs><linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#327a69" stopOpacity={0.14} /><stop offset="95%" stopColor="#327a69" stopOpacity={0} /></linearGradient><linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d29a58" stopOpacity={0.1} /><stop offset="95%" stopColor="#d29a58" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#ecece8" strokeDasharray="3 5" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#969a9b', fontSize: 11 }} tickMargin={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#969a9b', fontSize: 11 }} tickFormatter={(value) => `RM${value}k`} tickCount={5} /><Tooltip formatter={(value) => [`RM${value}k`, '']} contentStyle={{ border: '1px solid #ecece8', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px #182d2612' }} />
          <Area type="monotone" dataKey="revenue" stroke="#327a69" strokeWidth={2.2} fill="url(#revFill)" activeDot={{ r: 4, strokeWidth: 0 }} /><Area type="monotone" dataKey="expenses" stroke="#d29a58" strokeWidth={2} fill="url(#expFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
        </AreaChart></ResponsiveContainer></div>
        <div className="chart-footnote"><span className="chart-footnote-dot" />Figures in thousands of MYR <span className="footnote-spacer" /> Demo history</div>
      </Card>

      <Card className="expense-mix-card">
        <div className="section-head"><div><div className="section-title">Monthly expense mix</div><div className="section-subtitle">Current business profile <span className="muted-bullet">·</span> {currency}</div></div><span className="live-badge">Live profile</span></div>
        {expenses > 0 ? <>
          <div className="expense-mix-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseMix} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none">{expenseMix.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Monthly cost']} contentStyle={{ border: '1px solid #e3ebe5', borderRadius: 12, fontSize: 11, boxShadow: '0 8px 24px #182d2612' }} /></PieChart></ResponsiveContainer><div className="expense-mix-center"><strong>{formatCurrency(expenses)}</strong><span>total expenses</span></div></div>
          <div className="expense-mix-legend">{expenseMix.map((item) => <div className="expense-mix-item" key={item.name}><i className={item.className} /><span>{item.name}</span><strong>{formatCurrency(item.value)}</strong></div>)}</div>
        </> : <div className="empty-state"><CreditCard size={20} /><strong>No monthly expenses entered</strong><span>Add profile figures to see the mix.</span></div>}
      </Card>
    </div>

    <div className="dashboard-grid lower-grid">
      <Card className="recent-card">
        <div className="section-head"><div><div className="section-title">Recent simulations</div><div className="section-subtitle">Your latest what-if scenarios</div></div><Link className="text-link" to="/history">View history <ArrowRight size={14} /></Link></div>
        <div className="table-wrap"><table className="scenario-table"><thead><tr><th>SCENARIO</th><th>DATE</th><th>EST. MONTHLY IMPACT</th><th /></tr></thead><tbody>{recentScenarios.map((scenario) => <tr key={scenario.title}><td><strong>{scenario.title}</strong><span className="table-type">{scenario.type}</span></td><td className="date-cell">{scenario.date}</td><td><span className={`impact-text ${scenario.tone}`}>{scenario.impact}</span></td><td><Link className="row-arrow" to="/results" aria-label={`Open ${scenario.title}`}><ArrowRight size={15} /></Link></td></tr>)}</tbody></table></div>
      </Card>
      <div className="dashboard-side-stack">
        <Card className="position-card">
          <div className="section-head"><div><div className="section-title">Cash coverage</div><div className="section-subtitle">Cash balance divided by monthly expenses</div></div><span className="runway-icon"><Wallet size={16} /></span></div>
          <div className="position-score"><div className="score-ring" style={{ '--runway-progress': `${runwayProgress}%` } as CSSProperties}><div className="score-inner"><strong>{expenses > 0 ? runwayMonths.toFixed(1) : '—'}</strong><span>months</span></div></div><div><strong className="position-rating">Current coverage</strong><p className="position-detail">Simple ratio using current cash and monthly expense profile.</p></div></div>
          <div className="position-meter-label"><span>Cash reserve</span><strong>{expenses > 0 ? `${runwayMonths.toFixed(1)} months` : 'Unavailable'}</strong></div>
          <div className="position-meter"><span style={{ width: `${runwayProgress}%` }} /></div>
          <div className="position-range"><span>0 months</span><span>3 months reference</span></div>
          <div className="position-separator" />
          <div className="position-row"><span><i className="position-dot cash-dot" />Cash available</span><strong>{money(cashBalance)}</strong></div>
          <div className="position-row"><span><i className="position-dot profit-dot" />Monthly net profit</span><strong>{money(profit)}</strong></div>
          <div className="position-hint"><CircleHelp size={13} /> A simple cash-to-expense ratio, not a cash-flow forecast.</div>
        </Card>
        <Card className="quick-card">
          <div className="quick-icon"><ArrowDownRight size={17} /></div><div className="section-title">Plan for what’s next</div><p>See how a change in costs, sales or expansion plans could affect your monthly position.</p><Button variant="secondary" to="/simulator">Explore a scenario <ArrowRight size={15} /></Button>
        </Card>
      </div>
    </div>
  </>
}
