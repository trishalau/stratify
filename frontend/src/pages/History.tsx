import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Clock3, Filter, LoaderCircle, Plus, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, DemoNotice, PageHeader } from '../components/ui'
import { listBusinesses, listScenarios, simulateScenario, type Business, type SavedScenario, type SimulationCalculation } from '../lib/api'

const eventLabels: Record<string, string> = {
  supplier_price_increase: 'Cost pressure',
  sales_decrease: 'Revenue risk',
  expense_change: 'Cost pressure',
  major_customer_loss: 'Customer risk',
  new_competitor: 'Market change',
  interest_rate_increase: 'Finance',
  new_branch: 'Growth',
  custom: 'Custom event',
}

type HistoryItem = { scenario: SavedScenario; calculation: SimulationCalculation | null }

export default function History() {
  const [filter, setFilter] = useState('All scenarios')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<HistoryItem[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    async function loadHistory() {
      try {
        const businesses = await listBusinesses()
        const selectedBusiness = businesses.find((item) => item.name === 'KL Electronics Sdn. Bhd.') ?? businesses[0]
        if (!selectedBusiness) {
          if (active) { setBusiness(null); setItems([]) }
          return
        }
        const scenarios = await listScenarios(selectedBusiness.id)
        const hydrated = await Promise.all(scenarios.map(async (scenario) => {
          if (scenario.status !== 'confirmed') return { scenario, calculation: null }
          try {
            return { scenario, calculation: await simulateScenario(scenario.id) }
          } catch {
            return { scenario, calculation: null }
          }
        }))
        if (active) { setBusiness(selectedBusiness); setItems(hydrated) }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load scenario history.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadHistory()
    return () => { active = false }
  }, [])

  const categories = useMemo(() => [...new Set(items.map(({ scenario }) => eventLabels[scenario.event_type] ?? 'Other'))], [items])
  const rows = items.filter(({ scenario }) =>
    (filter === 'All scenarios' || eventLabels[scenario.event_type] === filter)
    && scenario.title.toLowerCase().includes(search.toLowerCase()),
  )

  const openScenario = (item: HistoryItem) => {
    if (item.calculation) navigate('/results', { state: { calculation: item.calculation, scenarioId: item.scenario.id } })
  }

  return <>
    <PageHeader eyebrow="YOUR WORKSPACE" title="Scenario history" description="Review and reopen scenarios saved for your business." action={<Button to="/simulator"><Plus size={16} /> New simulation</Button>} />
    <DemoNotice>Confirmed scenarios are saved in the backend and recalculated from their stored assumptions when you open history.</DemoNotice>
    <Card className="history-card">
      <div className="history-toolbar"><div className="history-count"><strong>Saved scenarios</strong><span>{loading ? 'Loading…' : `${rows.length} entries`}</span></div><div className="history-filters"><label className="search-field"><Search size={15} /><input aria-label="Search scenarios" placeholder="Search scenarios" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-select"><Filter size={14} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All scenarios</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div></div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="table-wrap"><table className="scenario-table history-table"><thead><tr><th>SCENARIO</th><th>EVENT TYPE</th><th>CREATED</th><th>MONTHLY PROFIT</th><th>STATUS</th><th /></tr></thead><tbody>{rows.map((item) => { const scenario = item.scenario; const created = new Date(scenario.created_at); return <tr key={scenario.id}>
        <td><strong>{scenario.title}</strong><span className="table-type">{business?.name ?? 'Saved business'}</span></td>
        <td><span className="history-category">{eventLabels[scenario.event_type] ?? scenario.event_type}</span></td>
        <td className="date-cell"><Clock3 size={13} />{Number.isNaN(created.valueOf()) ? '—' : created.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td><span className={`impact-text ${item.calculation ? 'neutral' : 'neutral'}`}>{item.calculation ? `${item.calculation.currency} ${Number(item.calculation.estimate.net_profit).toLocaleString('en-MY', { minimumFractionDigits: 2 })} estimated` : scenario.status === 'draft' ? 'Under review' : 'Calculation unavailable'}</span></td>
        <td><span className="status-pill">{scenario.status === 'confirmed' ? 'Confirmed' : 'Draft'}</span></td>
        <td>{item.calculation ? <button className="row-arrow" onClick={() => openScenario(item)} aria-label={`Open ${scenario.title}`}><ArrowRight size={15} /></button> : scenario.status === 'draft' ? <Link className="row-arrow" to="/simulator" aria-label="Continue scenario"><ArrowRight size={15} /></Link> : <span className="row-arrow disabled" title="No calculation is available"><ArrowRight size={15} /></span>}</td>
      </tr> })}</tbody></table>
        {loading && <div className="empty-state"><LoaderCircle className="spin-icon" size={20} /><strong>Loading saved scenarios</strong><span>Connecting to the business workspace.</span></div>}
        {!loading && !error && rows.length === 0 && <div className="empty-state"><Search size={20} /><strong>{items.length ? 'No matching scenarios' : 'No scenarios saved yet'}</strong><span>{items.length ? 'Try a different search or event type.' : 'Run and confirm an AI-assisted scenario to see it here.'}</span></div>}
      </div>
      <div className="history-footer"><span>Showing {rows.length} saved {rows.length === 1 ? 'scenario' : 'scenarios'}</span><span>{business?.name ?? 'Backend business data'}</span></div>
    </Card>
    <div className="history-note"><Clock3 size={15} /><span>Reopened results are recalculated from the confirmed assumptions and current saved business profile.</span></div>
  </>
}
