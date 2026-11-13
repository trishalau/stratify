import { useState } from 'react'
import { Check, Save, Store } from 'lucide-react'
import { Card, DemoNotice, Field, PageHeader, Button } from '../components/ui'
import { business, getBusinessProfile, money, saveBusinessProfile } from '../data/demo-data'

export default function Business() {
  const [form, setForm] = useState(() => {
    const profile = getBusinessProfile()
    return { name: profile.name, industry: profile.industry, location: profile.location,
      revenue: String(profile.revenue), supplierCosts: String(profile.supplierCosts), rent: String(profile.rent),
      salaries: String(profile.salaries), otherExpenses: String(profile.otherExpenses), cash: String(profile.cash) }
  })
  const [saved, setSaved] = useState(false)
  const update = (key: keyof typeof form) => (value: string) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })) }
  const save = () => {
    saveBusinessProfile({ ...business, name: form.name, industry: form.industry, location: form.location,
      revenue: Number(form.revenue) || 0, supplierCosts: Number(form.supplierCosts) || 0, rent: Number(form.rent) || 0,
      salaries: Number(form.salaries) || 0, otherExpenses: Number(form.otherExpenses) || 0, cash: Number(form.cash) || 0 })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3500)
  }

  return <>
    <PageHeader eyebrow="BUSINESS PROFILE" title="My business" description="Manage the information used as a starting point for scenario planning." action={<Button onClick={save}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Saved for this session' : 'Save changes'}</Button>} />
    <DemoNotice>Demo profile. Changes are held in this browser session only and are not sent to a database.</DemoNotice>
    <div className="business-layout">
      <div className="business-main">
        <Card className="form-card">
          <div className="form-card-head"><div className="form-icon"><Store size={17} /></div><div><h2>Business details</h2><p>Basic information about your company</p></div></div>
          <div className="field-grid"><Field label="Business name" value={form.name} onChange={update('name')} /><Field label="Industry" value={form.industry} onChange={update('industry')} /><Field label="Location" value={form.location} onChange={update('location')} /></div>
        </Card>
        <Card className="form-card">
          <div className="form-card-head"><div className="form-icon"><span className="ringgit-icon">RM</span></div><div><h2>Monthly financials</h2><p>Use your typical month as the baseline</p></div></div>
          <div className="field-grid two-cols">
            <Field label="Revenue" type="number" prefix="RM" value={form.revenue} onChange={update('revenue')} />
            <Field label="Supplier costs" type="number" prefix="RM" value={form.supplierCosts} onChange={update('supplierCosts')} />
            <Field label="Rent" type="number" prefix="RM" value={form.rent} onChange={update('rent')} />
            <Field label="Staff salaries" type="number" prefix="RM" value={form.salaries} onChange={update('salaries')} />
            <Field label="Other expenses" type="number" prefix="RM" value={form.otherExpenses} onChange={update('otherExpenses')} />
            <Field label="Cash balance" type="number" prefix="RM" value={form.cash} onChange={update('cash')} />
          </div>
          <div className="form-card-foot"><span>Net profit is not recalculated in this frontend prototype.</span><strong>Calculation engine · Phase 3</strong></div>
        </Card>
        <Card className="form-card">
          <div className="form-card-head"><div className="form-icon"><span className="simple-grid-icon">▦</span></div><div><h2>Additional information</h2><p>Optional details for a more complete picture</p></div></div>
          <div className="additional-info-row"><div><strong>Inventory value</strong><span>No demo value provided</span></div><span className="unknown-tag">Not available</span></div>
          <div className="additional-info-row"><div><strong>Outstanding liabilities</strong><span>No demo value provided</span></div><span className="unknown-tag">Not available</span></div>
          <p className="field-help full-help">Unknown values are left blank. The prototype will not estimate them.</p>
        </Card>
      </div>
      <aside className="business-aside">
        <Card className="profile-summary"><div className="summary-top"><div className="summary-logo">KL</div><span className="verified-pill"><span />Demo profile</span></div><h2>{form.name}</h2><p>{form.industry}</p><div className="summary-location">⌖ &nbsp;{form.location}</div><div className="position-separator" /><div className="summary-line"><span>Monthly revenue</span><strong>{money(Number(form.revenue) || 0)}</strong></div><div className="summary-line"><span>Cash balance</span><strong>{money(Number(form.cash) || 0)}</strong></div><div className="summary-session-note">Current session values · not saved to a database</div></Card>
        <Card className="note-card"><div className="note-mark">i</div><div><strong>Keep your baseline current</strong><p>Scenario comparisons are only as useful as the information behind them. Update your figures when your business changes.</p></div></Card>
      </aside>
    </div>
  </>
}
