import { useState } from 'react'
import { ArrowRight, Clock3, Filter, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card, DemoNotice, PageHeader } from '../components/ui'
import { recentScenarios } from '../data/demo-data'

const extraRows = [
  ...recentScenarios,
  { title: 'Opening costs increase by 10%', type: 'Growth', date: '04 Nov 2026', impact: 'Illustrative only', tone: 'neutral' },
  { title: 'Interest rates rise by 1%', type: 'Finance', date: '29 Oct 2026', impact: 'Insufficient data', tone: 'neutral' },
]

export default function History() {
  const [filter, setFilter] = useState('All scenarios')
  const [search, setSearch] = useState('')
  const rows = extraRows.filter((row) => (filter === 'All scenarios' || row.type === filter) && row.title.toLowerCase().includes(search.toLowerCase()))
  return <>
    <PageHeader eyebrow="YOUR WORKSPACE" title="Scenario history" description="Review the scenarios created in this demonstration workspace." action={<Button to="/simulator"><Plus size={16} /> New simulation</Button>} />
    <DemoNotice>Fictional demonstration entries only. Simulations are not saved to a database in this prototype.</DemoNotice>
    <Card className="history-card">
      <div className="history-toolbar"><div className="history-count"><strong>Recent scenarios</strong><span>{rows.length} entries</span></div><div className="history-filters"><label className="search-field"><Search size={15} /><input aria-label="Search scenarios" placeholder="Search scenarios" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-select"><Filter size={14} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All scenarios</option><option>Cost pressure</option><option>Revenue risk</option><option>Growth</option><option>Finance</option></select></label></div></div>
      <div className="table-wrap"><table className="scenario-table history-table"><thead><tr><th>SCENARIO</th><th>EVENT TYPE</th><th>CREATED</th><th>MONTHLY IMPACT</th><th>STATUS</th><th /></tr></thead><tbody>{rows.map((scenario) => <tr key={scenario.title}><td><strong>{scenario.title}</strong><span className="table-type">KL Electronics Sdn. Bhd.</span></td><td><span className="history-category">{scenario.type}</span></td><td className="date-cell"><Clock3 size={13} />{scenario.date}</td><td><span className={`impact-text ${scenario.tone}`}>{scenario.impact}</span></td><td><span className="status-pill">Demo entry</span></td><td><Link to="/results" state={{ selectedEvent: scenario.title }} className="row-arrow" aria-label={`Open ${scenario.title}`}><ArrowRight size={15} /></Link></td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-state"><Search size={20} /><strong>No matching scenarios</strong><span>Try a different search or event type.</span></div>}</div>
      <div className="history-footer"><span>Showing {rows.length} demonstration {rows.length === 1 ? 'scenario' : 'scenarios'}</span><span>Entries are sample content</span></div>
    </Card>
    <div className="history-note"><Clock3 size={15} /><span>In a future phase, confirmed scenarios will be stored and available to revisit here.</span></div>
  </>
}
