import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Download, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link, useLocation } from 'react-router-dom'
import { Button, Card, DemoNotice, PageHeader } from '../components/ui'
import { useDemoBusiness } from '../components/demo-business-context'
import { demoResult } from '../data/demo-data'
import { explainDemoScenario, explainScenario, type ScenarioExplanation, type ScenarioInput, type SimulationCalculation } from '../lib/api'

export default function Results() {
  const location = useLocation()
  const { demoScenarioRuns } = useDemoBusiness()
  const state = location.state as { calculation?: SimulationCalculation; scenarioId?: number; selectedEvent?: string; sessionRunId?: number } | null
  const sessionRun = demoScenarioRuns.find((run) => run.scenario.id === state?.sessionRunId)
  if (sessionRun) return <LiveResults calculation={sessionRun.calculation} scenarioId={sessionRun.scenario.id} scenarioInput={{ title: sessionRun.scenario.title, event_type: sessionRun.scenario.event_type, description: sessionRun.scenario.description ?? '', assumptions: sessionRun.scenario.assumptions, missing_information: sessionRun.scenario.missing_information }} businessId={sessionRun.scenario.business_id} />
  if (state?.calculation && state.scenarioId) return <LiveResults calculation={state.calculation} scenarioId={state.scenarioId} />
  return <DemoResults selectedEvent={state?.selectedEvent} />
}

function LiveResults({ calculation, scenarioId, scenarioInput, businessId }: { calculation: SimulationCalculation; scenarioId: number; scenarioInput?: ScenarioInput; businessId?: number }) {
  const { business } = useDemoBusiness()
  const [explanation, setExplanation] = useState<ScenarioExplanation | null>(null)
  const [explanationError, setExplanationError] = useState('')
  const [loadingExplanation, setLoadingExplanation] = useState(true)
  const currency = calculation.currency
  const formatMoney = (value: string | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-MY', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
  const baseline = calculation.baseline
  const estimate = calculation.estimate
  const metrics = [
    { title: 'Monthly revenue', before: baseline.monthly_revenue, after: estimate.monthly_revenue },
    { title: 'Monthly expenses', before: baseline.total_expenses, after: estimate.total_expenses },
    { title: 'Net profit', before: baseline.net_profit, after: estimate.net_profit },
  ]
  const chartData = metrics.map((item) => ({
    label: item.title.replace('Monthly ', ''),
    baseline: Number(item.before) / 1000,
    central: Number(item.after) / 1000,
    optimistic: calculation.comparison.optimistic ? Number(item.title === 'Monthly revenue' ? calculation.comparison.optimistic.monthly_revenue : item.title === 'Monthly expenses' ? calculation.comparison.optimistic.total_expenses : calculation.comparison.optimistic.net_profit) / 1000 : undefined,
    pessimistic: calculation.comparison.pessimistic ? Number(item.title === 'Monthly revenue' ? calculation.comparison.pessimistic.monthly_revenue : item.title === 'Monthly expenses' ? calculation.comparison.pessimistic.total_expenses : calculation.comparison.pessimistic.net_profit) / 1000 : undefined,
  }))

  useEffect(() => {
    let active = true
    const explanationRequest = scenarioInput && businessId
      ? explainDemoScenario(businessId, scenarioInput, business)
      : explainScenario(scenarioId, business)
    explanationRequest
      .then((result) => { if (active) setExplanation(result.explanation) })
      .catch((error: Error) => { if (active) setExplanationError(error.message) })
      .finally(() => { if (active) setLoadingExplanation(false) })
    return () => { active = false }
  }, [scenarioId, scenarioInput, businessId, business])

  return <>
    <PageHeader eyebrow="DETERMINISTIC SCENARIO ESTIMATE" title="Scenario results" description="A hypothetical monthly comparison calculated from your confirmed assumptions." action={<Button variant="ghost" size="sm" onClick={() => window.print()}><Download size={15} /> Print / PDF</Button>} />
    <DemoNotice>Estimate based on confirmed assumptions and your current in-memory demo values. Refreshing restores the original fictional sample data. This is not a guaranteed prediction or financial advice.</DemoNotice>
    <div className="result-title-row"><div><span className="result-event-icon"><ArrowDownRight size={18} /></span><div><div className="eyebrow">{scenarioInput ? 'CURRENT SESSION · TEMPORARY RUN' : `SAVED SCENARIO · #${scenarioId}`}</div><h2>{calculation.title}</h2><span className="result-date">Monthly estimate <i /> {calculation.status}</span></div></div><Link className="back-link result-back" to="/simulator"><ArrowLeft size={14} /> New scenario</Link></div>
    <div className="result-stat-grid">{metrics.map((metric) => {
      const delta = Number(metric.after) - Number(metric.before)
      const favorable = metric.title === 'Monthly expenses' ? delta <= 0 : delta >= 0
      const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
      return <Card key={metric.title} className="result-stat"><div className="result-stat-top"><span>{metric.title}</span><Icon size={15} className={delta === 0 ? 'neutral' : favorable ? 'positive' : 'negative'} /></div><strong>{formatMoney(metric.after)}</strong><small className={delta === 0 ? 'neutral' : favorable ? 'positive' : 'negative'}>{delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${formatMoney(Math.abs(delta).toFixed(2))}`} vs baseline</small></Card>
    })}<Card className="result-stat"><div className="result-stat-top"><span>Cash balance</span><Info size={15} /></div><strong>{formatMoney(calculation.cash_flow.current_cash_balance)}</strong><small className="neutral">Closing balance unavailable</small></Card></div>
    <div className="result-grid">
      <Card className="comparison-card"><div className="section-head"><div><div className="section-title">Financial comparison</div><div className="section-subtitle">Monthly figures <span className="muted-bullet">·</span> {currency} thousands</div></div><span className="live-badge">Financial engine</span></div>
        <div className="chart-legend result-legend"><span><i className="legend-swatch baseline-swatch" />Baseline</span><span><i className="legend-swatch optimistic-swatch" />Confirmed estimate</span>{calculation.comparison.range_available && <><span><i className="legend-swatch optimistic-swatch" />Optimistic</span><span><i className="legend-swatch pessimistic-swatch" />Pessimistic</span></>}</div>
        <div className="result-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }} barGap={4} barCategoryGap="30%"><CartesianGrid vertical={false} stroke="#ecece8" strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#777f80', fontSize: 11 }} tickMargin={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#969a9b', fontSize: 10 }} tickFormatter={(value) => `${currency} ${value}k`} /><Tooltip formatter={(value) => [`${currency} ${value}k`, '']} contentStyle={{ border: '1px solid #ecece8', borderRadius: 10, fontSize: 12 }} /><Bar dataKey="baseline" name="Baseline" fill="#bed0c7" radius={[4, 4, 0, 0]} /><Bar dataKey="central" name="Estimate" fill="#75a28e" radius={[4, 4, 0, 0]} />{calculation.comparison.range_available && <><Bar dataKey="optimistic" name="Optimistic" fill="#9ab79d" radius={[4, 4, 0, 0]} /><Bar dataKey="pessimistic" name="Pessimistic" fill="#d3a46b" radius={[4, 4, 0, 0]} /></>}</BarChart></ResponsiveContainer></div>
        <div className="table-wrap result-table-wrap"><table className="scenario-table result-table"><thead><tr><th>MONTHLY METRIC</th><th>BASELINE</th><th>ESTIMATE</th><th>CHANGE</th></tr></thead><tbody>{metrics.map((metric) => { const delta = Number(metric.after) - Number(metric.before); return <tr key={metric.title}><td><strong>{metric.title}</strong></td><td>{formatMoney(metric.before)}</td><td><b>{formatMoney(metric.after)}</b></td><td><span className={`impact-text ${delta < 0 ? 'negative' : delta > 0 ? 'positive' : 'neutral'}`}>{delta > 0 ? '+' : delta < 0 ? '−' : ''}{formatMoney(Math.abs(delta).toFixed(2))}</span></td></tr> })}</tbody></table></div>
      </Card>
      <div className="result-side-column">
        <Card className="explanation-card"><div className="explanation-top"><span className="explanation-icon"><Info size={15} /></span><span>AI EXPLANATION</span></div><h3>What drives this estimate</h3>{loadingExplanation ? <p>Preparing a qualitative explanation…</p> : explanation ? <><p>{explanation.summary}</p>{explanation.drivers.map((driver) => <div className="explanation-driver" key={driver.metric}><strong>{driver.metric.replace('_', ' ')} · {driver.direction}</strong><p>{driver.explanation}</p></div>)}<div className="explanation-separator" /><p className="explanation-caveat">{explanation.limitations.join(' ')}</p></> : <><p>Numerical results remain available above. The AI explanation could not be loaded.</p><p className="explanation-caveat">{explanationError}</p></>}</Card>
        <Card className="scenario-range-card"><div className="section-title">Scenario range</div><div className="section-subtitle">Based on explicitly provided alternatives</div>{calculation.comparison.range_available && calculation.comparison.optimistic && calculation.comparison.pessimistic ? <div className="range-values"><div><span>Optimistic profit</span><strong>{formatMoney(calculation.comparison.optimistic.net_profit)}</strong></div><div><span>Pessimistic profit</span><strong>{formatMoney(calculation.comparison.pessimistic.net_profit)}</strong></div></div> : <p>{calculation.comparison.range_reason}</p>}<div className="range-caption"><span>Cash-flow projection: unavailable</span><span>Monthly</span></div></Card>
      </div>
    </div>
    <div className="assumptions-panel"><div><div className="assumptions-title"><Info size={16} /> Confirmed assumptions & limitations</div><p>{Object.entries(calculation.assumptions).map(([name, value]) => `${name.replaceAll('_', ' ')}: ${value}`).join(' · ')}. {calculation.limitations.join(' ')}</p><p>{calculation.cash_flow.reason}</p></div><div className="assumptions-foot"><span>{scenarioInput ? 'Temporary browser session run' : `Scenario #${scenarioId}`}</span><Button to="/history" variant="secondary" size="sm">View scenario history <ArrowRight size={14} /></Button></div></div>
  </>
}

function DemoResults({ selectedEvent }: { selectedEvent?: string }) {
  return <>
    <PageHeader eyebrow="DEMO RESULT PREVIEW · 14 NOV 2026" title="Scenario results" description="A structured view of the potential financial impact." action={<Button variant="ghost" size="sm" onClick={() => window.print()}><Download size={15} /> Print / PDF</Button>} />
    <DemoNotice>Fixed demonstration fixture only. This page does not use assumptions entered through predefined event templates.</DemoNotice>
    {selectedEvent && <div className="selected-event-note"><Info size={15} /><span>You selected <strong>{selectedEvent}</strong>. The example below is a separate supplier cost fixture for interface demonstration.</span></div>}
    <div className="result-title-row"><div><span className="result-event-icon"><ArrowDownRight size={18} /></span><div><div className="eyebrow">REFERENCE EXAMPLE</div><h2>{demoResult.title}</h2><span className="result-date">Created {demoResult.date} <i /> Supplier expenses increase by 20%</span></div></div><Link className="back-link result-back" to="/simulator"><ArrowLeft size={14} /> Edit scenario</Link></div>
    <Card className="comparison-card"><div className="section-title">Static reference example</div><p className="section-subtitle">Run a supported custom event from the simulator to see a calculation based on confirmed inputs.</p></Card>
  </>
}
