import { useState } from 'react'
import { Check, Globe2, SlidersHorizontal, UserRound, Database, Save } from 'lucide-react'
import { Button, Card, DemoNotice, Field, PageHeader } from '../components/ui'

export default function Settings() {
  const [currency, setCurrency] = useState('MYR — Malaysian Ringgit')
  const [period, setPeriod] = useState('Monthly')
  const [saved, setSaved] = useState(false)
  return <>
    <PageHeader eyebrow="PREFERENCES" title="Settings" description="Set how Stratify presents your business information." action={<Button onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 3000) }}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Saved for this session' : 'Save settings'}</Button>} />
    <DemoNotice>Preferences are stored in this page session only in the Phase 1 prototype.</DemoNotice>
    <div className="settings-stack">
      <Card className="settings-card"><div className="settings-card-title"><div className="form-icon"><UserRound size={17} /></div><div><h2>Business profile</h2><p>Workspace and business identity</p></div></div><div className="settings-fields"><Field label="Business name" value="KL Electronics Sdn. Bhd." /><Field label="Reporting location" value="Kuala Lumpur, Malaysia" /></div><div className="settings-link-row"><span>Business financial information</span><Button to="/business" variant="secondary" size="sm">Edit profile</Button></div></Card>
      <Card className="settings-card"><div className="settings-card-title"><div className="form-icon"><Globe2 size={17} /></div><div><h2>Regional preferences</h2><p>Set the formats used throughout your workspace</p></div></div><div className="settings-fields"><label className="field"><span className="field-label">Default currency</span><select value={currency} onChange={(e) => { setCurrency(e.target.value); setSaved(false) }}><option>MYR — Malaysian Ringgit</option><option>SGD — Singapore Dollar</option><option>USD — US Dollar</option></select></label><label className="field"><span className="field-label">Reporting period</span><select value={period} onChange={(e) => { setPeriod(e.target.value); setSaved(false) }}><option>Monthly</option><option>Quarterly</option><option>Annually</option></select></label></div></Card>
      <Card className="settings-card"><div className="settings-card-title"><div className="form-icon"><SlidersHorizontal size={17} /></div><div><h2>Planning preferences</h2><p>Control how scenario information is presented</p></div></div><div className="preference-row"><div><strong>Show demonstration labels</strong><span>Keep demo and illustrative figures clearly identified</span></div><label className="switch"><input type="checkbox" defaultChecked /><span /></label></div><div className="preference-row"><div><strong>Ask before showing demo results</strong><span>Require reviewed assumptions before opening the result preview</span></div><label className="switch"><input type="checkbox" defaultChecked /><span /></label></div></Card>
      <Card className="settings-card data-settings"><div className="settings-card-title"><div className="form-icon"><Database size={17} /></div><div><h2>Data management</h2><p>The fictional KL Electronics demo profile and saved scenarios are stored in the connected PostgreSQL database.</p></div></div><div className="data-state"><span className="status-dot" />Demo data · PostgreSQL</div></Card>
    </div>
  </>
}
