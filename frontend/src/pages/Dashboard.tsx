import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp, Clock3, CreditCard, Plus, Wallet } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { Card, DemoNotice, PageHeader, Button } from '../components/ui'
import { business, money, monthlyTrend, recentScenarios } from '../data/demo-data'

function MetricCard({ label, value, change, icon: Icon, tone, footnote }: { label: string; value: string; change: string; icon: typeof Wallet; tone: string; footnote: string }) {
  return <Card className="metric-card">
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-bottom"><span className={`metric-change ${tone}`}><ArrowUpRight size={13} />{change}</span><span>{footnote}</span></div>
  </Card>
}

export default function Dashboard() {
  return <>
    <PageHeader eyebrow="SATURDAY, NOVEMBER 14, 2026" title="Good morning, Alex" description="Here’s the latest snapshot of your business." action={<Button to="/simulator"><Plus size={16} /> New simulation</Button>} />
    <DemoNotice />
    <div className="metric-grid">
      <MetricCard label="Monthly revenue" value={money(business.revenue)} change="5.3%" icon={ArrowUpRight} tone="positive" footnote="vs. last month" />
      <MetricCard label="Monthly expenses" value={money(business.expenses)} change="2.1%" icon={CreditCard} tone="negative" footnote="vs. last month" />
      <MetricCard label="Net profit" value={money(business.profit)} change="8.7%" icon={ArrowUpRight} tone="positive" footnote="vs. last month" />
      <MetricCard label="Cash balance" value={money(business.cash)} change="3.2%" icon={Wallet} tone="positive" footnote="vs. last month" />
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

      <Card className="position-card">
        <div className="section-head"><div><div className="section-title">Financial position</div><div className="section-subtitle">As of November 2026</div></div><button aria-label="About financial position" className="plain-icon"><CircleHelp size={16} /></button></div>
        <div className="position-score"><div className="score-ring"><div className="score-inner"><strong>78</strong><span>of 100</span></div></div><div><strong className="position-rating">Good standing</strong><p className="position-detail">Your cash position covers about <b>2 months</b> of current expenses.</p></div></div>
        <div className="position-meter-label"><span>Cash reserve</span><strong>1.95 months</strong></div>
        <div className="position-meter"><span style={{ width: '65%' }} /></div>
        <div className="position-range"><span>0 months</span><span>3 months recommended</span></div>
        <div className="position-separator" />
        <div className="position-row"><span><i className="position-dot cash-dot" />Cash available</span><strong>{money(business.cash)}</strong></div>
        <div className="position-row"><span><i className="position-dot profit-dot" />Monthly net profit</span><strong>{money(business.profit)}</strong></div>
        <div className="position-hint"><Clock3 size={13} /> Based on demo business information</div>
      </Card>
    </div>

    <div className="dashboard-grid lower-grid">
      <Card className="recent-card">
        <div className="section-head"><div><div className="section-title">Recent simulations</div><div className="section-subtitle">Your latest what-if scenarios</div></div><Link className="text-link" to="/history">View history <ArrowRight size={14} /></Link></div>
        <div className="table-wrap"><table className="scenario-table"><thead><tr><th>SCENARIO</th><th>DATE</th><th>EST. MONTHLY IMPACT</th><th /></tr></thead><tbody>{recentScenarios.map((scenario) => <tr key={scenario.title}><td><strong>{scenario.title}</strong><span className="table-type">{scenario.type}</span></td><td className="date-cell">{scenario.date}</td><td><span className={`impact-text ${scenario.tone}`}>{scenario.impact}</span></td><td><Link className="row-arrow" to="/results" aria-label={`Open ${scenario.title}`}><ArrowRight size={15} /></Link></td></tr>)}</tbody></table></div>
      </Card>
      <Card className="quick-card">
        <div className="quick-icon"><ArrowDownRight size={17} /></div><div className="section-title">Plan for what’s next</div><p>See how a change in costs, sales or expansion plans could affect your monthly position.</p><Button variant="secondary" to="/simulator">Explore a scenario <ArrowRight size={15} /></Button>
      </Card>
    </div>
  </>
}
