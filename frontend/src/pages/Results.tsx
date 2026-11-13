import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Download, Info } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link, useLocation } from 'react-router-dom'
import { Button, Card, DemoNotice, PageHeader } from '../components/ui'
import { demoResult } from '../data/demo-data'

const comparison = [
  { label: 'Revenue', baseline: 120, optimistic: 120, pessimistic: 120 },
  { label: 'Expenses', baseline: 82, optimistic: 86, pessimistic: 90 },
  { label: 'Net profit', baseline: 38, optimistic: 34, pessimistic: 30 },
]

export default function Results() {
  const location = useLocation()
  const [saveNotice, setSaveNotice] = useState(false)
  const selectedEvent = location.state?.selectedEvent as string | undefined
  return <>
    <PageHeader eyebrow="DEMO RESULT PREVIEW · 14 NOV 2026" title="Scenario results" description="A structured view of the potential financial impact." action={<div className="result-actions"><Button variant="secondary" size="sm" onClick={() => setSaveNotice(true)}><Bookmark size={15} /> Save</Button><Button variant="ghost" size="sm" onClick={() => window.print()}><Download size={15} /> Print / PDF</Button>{saveNotice && <span className="save-notice" role="status">Saving starts in Phase 2.</span>}</div>} />
    <DemoNotice>Fixed demonstration fixture only. This page does not use the assumptions entered in the simulator or calculate a prediction.</DemoNotice>
    {selectedEvent && <div className="selected-event-note"><Info size={15} /><span>You selected <strong>{selectedEvent}</strong>. The example below is a separate supplier cost fixture for interface demonstration.</span></div>}
    <div className="result-title-row"><div><span className="result-event-icon"><ArrowDownRight size={18} /></span><div><div className="eyebrow">REFERENCE EXAMPLE</div><h2>{demoResult.title}</h2><span className="result-date">Created {demoResult.date} <i /> Supplier expenses increase by 20%</span></div></div><Link className="back-link result-back" to="/simulator"><ArrowLeft size={14} /> Edit scenario</Link></div>
    <div className="result-stat-grid">{[
      { title: 'Monthly revenue', value: 'RM120,000', change: 'No change in fixture', tone: 'neutral', icon: ArrowUpRight },
      { title: 'Monthly expenses', value: 'RM90,000', change: '+RM8,000 vs baseline', tone: 'negative', icon: ArrowUpRight },
      { title: 'Net profit', value: 'RM30,000', change: '−RM8,000 vs baseline', tone: 'negative', icon: ArrowDownRight },
      { title: 'Cash balance', value: 'RM152,000', change: 'Illustrative only', tone: 'negative', icon: ArrowDownRight },
    ].map(({ title, value, change, tone, icon: Icon }) => <Card key={title} className="result-stat"><div className="result-stat-top"><span>{title}</span><Icon size={15} className={tone} /></div><strong>{value}</strong><small className={tone}>{change}</small></Card>)}</div>
    <div className="result-grid">
      <Card className="comparison-card"><div className="section-head"><div><div className="section-title">Financial comparison</div><div className="section-subtitle">Monthly figures <span className="muted-bullet">·</span> RM thousands</div></div><span className="fixture-badge">Static example</span></div>
        <div className="chart-legend result-legend"><span><i className="legend-swatch baseline-swatch" />Baseline</span><span><i className="legend-swatch optimistic-swatch" />Illustrative low impact</span><span><i className="legend-swatch pessimistic-swatch" />Illustrative high impact</span></div>
        <div className="result-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison} margin={{ top: 10, right: 12, left: -20, bottom: 0 }} barGap={4} barCategoryGap="30%"><CartesianGrid vertical={false} stroke="#ecece8" strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#777f80', fontSize: 11 }} tickMargin={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#969a9b', fontSize: 10 }} tickFormatter={(value) => `RM${value}k`} /><Tooltip formatter={(value) => [`RM${value}k`, '']} contentStyle={{ border: '1px solid #ecece8', borderRadius: 10, fontSize: 12 }} /><Bar dataKey="baseline" fill="#bed0c7" radius={[4, 4, 0, 0]} /><Bar dataKey="optimistic" fill="#75a28e" radius={[4, 4, 0, 0]} /><Bar dataKey="pessimistic" fill="#d3a46b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="table-wrap result-table-wrap"><table className="scenario-table result-table"><thead><tr><th>MONTHLY METRIC</th><th>BASELINE</th><th>EXAMPLE</th><th>CHANGE</th></tr></thead><tbody>{demoResult.rows.map((row) => <tr key={row.label}><td><strong>{row.label}</strong></td><td>{row.baseline}</td><td><b>{row.scenario}</b></td><td><span className={`impact-text ${row.tone}`}>{row.change}</span></td></tr>)}</tbody></table></div>
      </Card>
      <div className="result-side-column">
        <Card className="explanation-card"><div className="explanation-top"><span className="explanation-icon"><Info size={15} /></span><span>ILLUSTRATIVE EXPLANATION</span></div><h3>What this example shows</h3><p>If supplier costs rose by 20% from the demonstration baseline of RM40,000, that cost line would be RM8,000 higher. The fixture displays a lower monthly profit to illustrate how a result might be explained.</p><div className="explanation-separator" /><p className="explanation-caveat">This text is static sample copy. It was not generated by AI and is not based on a calculation engine.</p></Card>
        <Card className="scenario-range-card"><div className="section-title">Scenario range</div><div className="section-subtitle">Illustrative profit comparison</div><div className="range-values"><div><span>Example low impact</span><strong>RM34,000</strong></div><div><span>Example high impact</span><strong>RM30,000</strong></div></div><div className="range-bar"><span /><i /></div><div className="range-caption"><span>RM4,000 range</span><span>Monthly net profit</span></div><p>Optimistic and pessimistic values are static examples to illustrate the comparison layout.</p></Card>
      </div>
    </div>
    <div className="assumptions-panel"><div><div className="assumptions-title"><Info size={16} /> Assumptions & limitations</div><p>This fixed interface fixture assumes monthly supplier expenses of RM40,000 and shows a 20% increase. It uses fictional business data. Cash balance movement, baseline/optimistic/pessimistic cases, and explanatory text are illustrative placeholders. No live user input, AI output, or financial engine is used.</p></div><div className="assumptions-foot"><span>Not a guaranteed prediction or financial advice.</span><Button to="/history" variant="secondary" size="sm">View scenario history <ArrowRight size={14} /></Button></div></div>
  </>
}
