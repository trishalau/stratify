import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Plus, Save, Store, Trash2 } from 'lucide-react'
import { Button, Card, DemoNotice, Field, PageHeader } from '../components/ui'
import { listBusinesses, updateBusiness, type Business as BusinessRecord } from '../lib/api'

type BusinessForm = {
  name: string
  industry: string
  location: string
  monthly_revenue: string
  supplier_costs: string
  rent: string
  staff_salaries: string
  other_expenses: string
  cash_balance: string
  custom_monthly_variables: { name: string; value: string }[]
}

const toForm = (business: BusinessRecord): BusinessForm => ({
  name: business.name,
  industry: business.industry,
  location: business.location,
  monthly_revenue: business.monthly_revenue,
  supplier_costs: business.supplier_costs,
  rent: business.rent,
  staff_salaries: business.staff_salaries,
  other_expenses: business.other_expenses,
  cash_balance: business.cash_balance,
  custom_monthly_variables: business.custom_monthly_variables ?? [],
})

export default function Business() {
  const [business, setBusiness] = useState<BusinessRecord | null>(null)
  const [form, setForm] = useState<BusinessForm | null>(null)
  const [newVariableName, setNewVariableName] = useState('')
  const [newVariableValue, setNewVariableValue] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listBusinesses()
      .then((items) => {
        const demo = items.find((item) => item.name === 'KL Electronics Sdn. Bhd.') ?? items[0]
        if (!demo) throw new Error('No business profile was found.')
        setBusiness(demo)
        setForm(toForm(demo))
      })
      .catch((loadError: Error) => setError(loadError.message))
  }, [])

  const update = (key: keyof BusinessForm) => (value: string) => {
    setSaved(false)
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  const save = async () => {
    if (!business || !form || busy) return
    setBusy(true)
    setError('')
    try {
      const updated = await updateBusiness(business.id, {
        name: form.name,
        industry: form.industry,
        location: form.location,
        monthly_revenue: form.monthly_revenue,
        supplier_costs: form.supplier_costs,
        rent: form.rent,
        staff_salaries: form.staff_salaries,
        other_expenses: form.other_expenses,
        cash_balance: form.cash_balance,
        custom_monthly_variables: form.custom_monthly_variables,
      })
      setBusiness(updated)
      setForm(toForm(updated))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3500)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save business changes.')
    } finally {
      setBusy(false)
    }
  }

  const addVariable = async () => {
    const name = newVariableName.trim()
    if (!business || !form || !name || !newVariableValue || busy || form.custom_monthly_variables.some((item) => item.name.toLowerCase() === name.toLowerCase())) return
    const variables = [...form.custom_monthly_variables, { name, value: newVariableValue }]
    setBusy(true)
    setError('')
    try {
      const updated = await updateBusiness(business.id, { custom_monthly_variables: variables })
      setBusiness(updated)
      setForm((current) => current ? { ...current, custom_monthly_variables: updated.custom_monthly_variables } : current)
      setNewVariableName('')
      setNewVariableValue('')
      setSaved(true)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add this variable.')
    } finally {
      setBusy(false)
    }
  }

  const removeVariable = async (index: number) => {
    if (!business || !form || busy) return
    const remaining = form.custom_monthly_variables.filter((_, itemIndex) => itemIndex !== index)
    setBusy(true)
    setError('')
    try {
      const updated = await updateBusiness(business.id, { custom_monthly_variables: remaining })
      setBusiness(updated)
      setForm((current) => current ? { ...current, custom_monthly_variables: updated.custom_monthly_variables } : current)
      setSaved(true)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove this variable.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <PageHeader eyebrow="BUSINESS PROFILE" title="My business" description="Manage the information used as a starting point for scenario planning." action={<Button onClick={save} disabled={!business || busy}>{busy ? <LoaderCircle className="spin-icon" size={16} /> : saved ? <Check size={16} /> : <Save size={16} />}{busy ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</Button>} />
    <DemoNotice>KL Electronics is fictional demonstration data. Profile changes are saved to the connected development database.</DemoNotice>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {!form ? <Card className="form-card">{error ? 'Business profile unavailable.' : 'Loading business profile…'}</Card> : <div className="business-layout">
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
              <div className="custom-monthly-box-head"><strong>{item.name || 'New monthly variable'}</strong><Button aria-label={`Remove ${item.name}`} title={`Remove ${item.name}`} disabled={busy} size="sm" variant="secondary" onClick={() => void removeVariable(index)}><Trash2 size={14} />Remove</Button></div>
              <div className="custom-monthly-row"><Field label="Variable name" value={item.name} onChange={(name) => { setSaved(false); setForm((current) => current ? { ...current, custom_monthly_variables: current.custom_monthly_variables.map((entry, i) => i === index ? { ...entry, name } : entry) } : current) }} /><Field label="Monthly amount" type="number" prefix="RM" value={item.value} onChange={(value) => { setSaved(false); setForm((current) => current ? { ...current, custom_monthly_variables: current.custom_monthly_variables.map((entry, i) => i === index ? { ...entry, value } : entry) } : current) }} /></div>
            </div>)}
            <div className="custom-monthly-add"><Field label="New variable name" value={newVariableName} onChange={setNewVariableName} /><Field label="Monthly amount" type="number" prefix="RM" value={newVariableValue} onChange={setNewVariableValue} /><Button size="sm" variant="secondary" disabled={!newVariableName.trim() || !newVariableValue || busy} onClick={() => void addVariable()}>{busy ? <LoaderCircle className="spin-icon" size={14} /> : <Plus size={14} />}Add variable</Button></div>
            <small>Saved custom variables appear in the simulator for context and are not included in calculations.</small>
          </div>
          <div className="form-card-foot"><span>Net profit is calculated from revenue and operating expenses.</span><strong>Deterministic engine</strong></div>
        </Card>
      </div>
      <aside className="business-aside">
        <Card className="profile-summary"><div className="summary-top"><div className="summary-logo">KL</div><span className="verified-pill"><span />Demo profile</span></div><h2>{form.name}</h2><p>{form.industry}</p><div className="summary-location">⌖ &nbsp;{form.location}</div><div className="position-separator" /><div className="summary-line"><span>Monthly revenue</span><strong>{business?.currency ?? 'MYR'} {Number(form.monthly_revenue || 0).toLocaleString('en-MY')}</strong></div><div className="summary-line"><span>Cash balance</span><strong>{business?.currency ?? 'MYR'} {Number(form.cash_balance || 0).toLocaleString('en-MY')}</strong></div><div className="summary-session-note">Saved business baseline</div></Card>
        <Card className="note-card"><div className="note-mark">i</div><div><strong>Keep your baseline current</strong><p>Scenario comparisons are only as useful as the information behind them. Update your figures when your business changes.</p></div></Card>
      </aside>
    </div>}
  </>
}
