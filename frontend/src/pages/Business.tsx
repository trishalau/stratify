import { useState } from 'react'
import { Check, MapPin, Plus, Save, Store, Trash2 } from 'lucide-react'
import { Button, Card, DemoNotice, Field, PageHeader } from '../components/ui'
import { useDemoBusiness } from '../components/demo-business-context'

export default function Business() {
  const { business, setBusiness } = useDemoBusiness()
  const [newVariableName, setNewVariableName] = useState('')
  const [newVariableValue, setNewVariableValue] = useState('')
  const [saved, setSaved] = useState(false)
  const form = business
  const monthlyExpenses = Number(form.supplier_costs || 0) + Number(form.rent || 0) + Number(form.staff_salaries || 0) + Number(form.other_expenses || 0) + form.custom_monthly_variables.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const monthlyProfit = Number(form.monthly_revenue || 0) - monthlyExpenses
  const formatValue = (value: number) => `${business.currency ?? 'MYR'} ${value.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`

  const update = (key: keyof typeof business) => (value: string) => {
    setSaved(false)
    setBusiness((current) => ({ ...current, [key]: value }))
  }

  const save = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3500)
  }

  const addVariable = () => {
    const name = newVariableName.trim()
    if (!name || !newVariableValue || form.custom_monthly_variables.some((item) => item.name.toLowerCase() === name.toLowerCase())) return
    setBusiness((current) => ({ ...current, custom_monthly_variables: [...current.custom_monthly_variables, { name, value: newVariableValue }] }))
    setNewVariableName('')
    setNewVariableValue('')
    setSaved(false)
  }

  const removeVariable = (index: number) => setBusiness((current) => ({ ...current, custom_monthly_variables: current.custom_monthly_variables.filter((_, i) => i !== index) }))

  return <>
    <PageHeader eyebrow="BUSINESS PROFILE" title="My business" description="Edit the demo baseline for this browser session." action={<Button onClick={save}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Applied' : 'Apply changes'}</Button>} />
    <DemoNotice>Fictional KL Electronics demo data. Your edits stay in memory while navigating and reset when the page is refreshed.</DemoNotice>
    <div className="business-layout">
      <div className="business-main">
        <Card className="form-card">
          <div className="form-card-head"><div className="form-icon"><Store size={17} /></div><div><h2>Business details</h2><p>Basic information about your company</p></div></div>
          <div className="field-grid"><Field label="Business name" value={form.name} onChange={update('name')} /><Field label="Industry" value={form.industry} onChange={update('industry')} /><Field label="Location" value={form.location} onChange={update('location')} /></div>
        </Card>
        <Card className="form-card">
          <div className="form-card-head"><div className="form-icon"><span className="ringgit-icon">RM</span></div><div><h2>Monthly financials</h2><p>Use your typical month as the baseline</p></div></div>
          <div className="field-grid two-cols">
            <Field label="Revenue" type="number" prefix="RM" value={form.monthly_revenue} onChange={update('monthly_revenue')} />
            <Field label="Supplier costs" type="number" prefix="RM" value={form.supplier_costs} onChange={update('supplier_costs')} />
            <Field label="Rent" type="number" prefix="RM" value={form.rent} onChange={update('rent')} />
            <Field label="Staff salaries" type="number" prefix="RM" value={form.staff_salaries} onChange={update('staff_salaries')} />
            <Field label="Other expenses" type="number" prefix="RM" value={form.other_expenses} onChange={update('other_expenses')} />
            <Field label="Cash balance" type="number" prefix="RM" value={form.cash_balance} onChange={update('cash_balance')} />
          </div>
          <div className="custom-monthly-form">
            <div className="custom-monthly-title"><strong>Additional monthly variables</strong><small>Add any monthly value you want to keep on your business profile.</small></div>
            {form.custom_monthly_variables.map((item, index) => <div className="custom-monthly-box" key={`${item.name}-${index}`}>
              <div className="custom-monthly-box-head"><strong>{item.name || 'New monthly variable'}</strong><Button aria-label={`Remove ${item.name}`} title={`Remove ${item.name}`} size="sm" variant="secondary" onClick={() => removeVariable(index)}><Trash2 size={14} />Remove</Button></div>
              <div className="custom-monthly-row"><Field label="Variable name" value={item.name} onChange={(name) => { setSaved(false); setBusiness((current) => ({ ...current, custom_monthly_variables: current.custom_monthly_variables.map((entry, i) => i === index ? { ...entry, name } : entry) })) }} /><Field label="Monthly amount" type="number" prefix="RM" value={item.value} onChange={(value) => { setSaved(false); setBusiness((current) => ({ ...current, custom_monthly_variables: current.custom_monthly_variables.map((entry, i) => i === index ? { ...entry, value } : entry) })) }} /></div>
            </div>)}
            <div className="custom-monthly-add"><Field label="New variable name" value={newVariableName} onChange={setNewVariableName} /><Field label="Monthly amount" type="number" prefix="RM" value={newVariableValue} onChange={setNewVariableValue} /><Button size="sm" variant="secondary" disabled={!newVariableName.trim() || !newVariableValue} onClick={addVariable}><Plus size={14} />Add variable</Button></div>
            <small>Custom variables can be used in supported scenario calculations. Edits are not stored outside this page session.</small>
          </div>
          <div className="form-card-foot"><span>Net profit is calculated from revenue and operating expenses.</span><strong>Deterministic engine</strong></div>
        </Card>
      </div>
      <aside className="business-aside">
        <Card className="profile-summary"><div className="summary-top"><div className="summary-logo">KL</div><span className="verified-pill"><span />Demo profile</span></div><h2>{form.name}</h2><p>{form.industry}</p><div className="summary-location"><MapPin size={13} />{form.location}</div><div className="position-separator" /><div className="summary-line"><span>Monthly revenue</span><strong>{formatValue(Number(form.monthly_revenue || 0))}</strong></div><div className="summary-line"><span>Monthly expenses</span><strong>{formatValue(monthlyExpenses)}</strong></div><div className="summary-line summary-profit-row"><span>Net profit</span><strong className={monthlyProfit >= 0 ? 'summary-profit' : 'negative'}>{formatValue(monthlyProfit)}</strong></div><div className="summary-line"><span>Cash balance</span><strong>{formatValue(Number(form.cash_balance || 0))}</strong></div><div className="summary-session-note">Calculated from this session’s profile values</div></Card>
        <Card className="note-card"><div className="note-mark">i</div><div><strong>Keep your baseline current</strong><p>Scenario comparisons are only as useful as the information behind them. Update your figures when your business changes.</p></div></Card>
      </aside>
    </div>
  </>
}
