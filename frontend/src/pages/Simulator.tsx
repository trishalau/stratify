import { useState } from 'react'
import { ArrowRight, Check, ChevronLeft, CircleHelp, MessageSquareText, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, DemoNotice, Field, PageHeader } from '../components/ui'
import { getBusinessProfile, money, scenarios } from '../data/demo-data'
import { Activity, Landmark, Package, Store, Target, TrendingDown, UserRoundX } from 'lucide-react'

const icons = { package: Package, 'trending-down': TrendingDown, 'user-round-x': UserRoundX, target: Target, landmark: Landmark, store: Store }

const templates: Record<string, { assumptionLabel: string; assumption: string; suffix?: string; prefix?: string; baselineKey?: 'supplierCosts' | 'revenue'; missingInfo?: boolean; description: string }> = {
  supplier: { assumptionLabel: 'Supplier cost increase', assumption: '20', suffix: '%', baselineKey: 'supplierCosts', description: 'Change to your monthly supplier expenses.' },
  sales: { assumptionLabel: 'Monthly sales decrease', assumption: '15', suffix: '%', baselineKey: 'revenue', description: 'Change to monthly revenue.' },
  customer: { assumptionLabel: 'Share of revenue from customer', assumption: '', suffix: '%', missingInfo: true, description: 'This information is not included in the demo profile.' },
  competitor: { assumptionLabel: 'Estimated revenue change', assumption: '', suffix: '%', missingInfo: true, description: 'No impact estimate is provided in this prototype.' },
  interest: { assumptionLabel: 'Interest rate increase', assumption: '', suffix: 'points', missingInfo: true, description: 'Loan balance and current interest costs are not available.' },
  branch: { assumptionLabel: 'Estimated monthly branch cost', assumption: '', prefix: 'RM', missingInfo: true, description: 'Branch setup and operating cost details are not available.' },
}

export default function Simulator() {
  const [selected, setSelected] = useState('supplier')
  const [step, setStep] = useState<'choose' | 'assumptions'>('choose')
  const [assumption, setAssumption] = useState(templates.supplier.assumption)
  const [confirmed, setConfirmed] = useState(false)
  const [customEvent, setCustomEvent] = useState('')
  const [aiMessage, setAiMessage] = useState(false)
  const navigate = useNavigate()
  const profile = getBusinessProfile()
  const active = scenarios.find((scenario) => scenario.id === selected) ?? scenarios[0]
  const activeTemplate = templates[selected]
  const Icon = icons[active.icon as keyof typeof icons] ?? Activity

  const selectScenario = (id: string) => {
    setSelected(id)
    setAssumption(templates[id].assumption)
    setConfirmed(false)
    setStep('choose')
  }

  return <>
    <PageHeader eyebrow="WHAT-IF PLANNING" title="Scenario simulator" description="Explore how a change could affect your business, one assumption at a time." />
    <DemoNotice>Prototype workflow. No calculations are run and no AI interpretation is connected yet.</DemoNotice>
    <div className="simulator-layout">
      <div className="simulator-main">
        <Card className="simulator-card">
          <div className="stepper"><div className={`step-item ${step === 'choose' ? 'step-active' : 'step-complete'}`}><span>{step === 'assumptions' ? <Check size={13} /> : '1'}</span><b>Choose an event</b></div><i /><div className={`step-item ${step === 'assumptions' ? 'step-active' : ''}`}><span>2</span><b>Review assumptions</b></div><i /><div className="step-item step-muted"><span>3</span><b>View preview</b></div></div>
          {step === 'choose' ? <>
            <div className="sim-section-heading"><div><h2>What would you like to explore?</h2><p>Choose a common business event to start your scenario.</p></div><button className="plain-icon" aria-label="About scenario events"><CircleHelp size={16} /></button></div>
            <div className="event-grid">{scenarios.map((scenario) => {
              const ScenarioIcon = icons[scenario.icon as keyof typeof icons]
              return <button key={scenario.id} className={`event-card ${selected === scenario.id ? 'event-selected' : ''}`} onClick={() => selectScenario(scenario.id)} aria-pressed={selected === scenario.id}>
                <span className="event-icon"><ScenarioIcon size={17} /></span><span className="event-tag">{scenario.tag}</span><strong>{scenario.title}</strong><span className="event-description">{scenario.description}</span><span className="event-select-mark">{selected === scenario.id && <Check size={12} />}</span>
              </button>
            })}</div>
            <div className="custom-event-box"><div className="custom-event-icon"><MessageSquareText size={16} /></div><div className="custom-event-content"><strong>Describe a custom event</strong><p>Tell us what might change in your business.</p><textarea value={customEvent} onChange={(event) => { setCustomEvent(event.target.value); setAiMessage(false) }} placeholder="e.g. Our largest supplier is increasing prices next quarter…" rows={3} /><div className="custom-event-bottom"><span><Sparkles size={13} /> AI interpretation planned for Phase 4</span><Button variant="secondary" size="sm" disabled={!customEvent.trim()} onClick={() => setAiMessage(true)}>Review event <ArrowRight size={14} /></Button></div>{aiMessage && <div className="inline-notice">Custom event interpretation is not available in this prototype. Use a predefined event to review the workflow.</div>}</div></div>
            <div className="sim-footer"><span>Step 1 of 3 <i /> Your inputs are not saved</span><Button onClick={() => setStep('assumptions')}>Review assumptions <ArrowRight size={15} /></Button></div>
          </> : <>
            <button className="back-link" onClick={() => { setStep('choose'); setConfirmed(false) }}><ChevronLeft size={15} /> Back to event selection</button>
            <div className="assumption-heading"><span className="event-icon large-event-icon"><Icon size={19} /></span><div><div className="eyebrow">SELECTED EVENT</div><h2>{active.title}</h2><p>{active.description}</p></div></div>
            <div className="assumption-form"><Field label={activeTemplate.assumptionLabel} type="number" value={assumption} prefix={activeTemplate.prefix} suffix={activeTemplate.suffix} onChange={(value) => { setAssumption(value); setConfirmed(false) }} help={activeTemplate.description} />
              {activeTemplate.baselineKey && <div className="baseline-reference"><div><span>Business baseline</span><strong>{activeTemplate.baselineKey === 'revenue' ? `Monthly revenue · ${money(profile.revenue)}` : `Monthly supplier costs · ${money(profile.supplierCosts)}`}</strong></div><span className="baseline-source">Saved in this session</span></div>}
              {activeTemplate.missingInfo && <div className="inline-notice">Some information needed for this scenario is not in the demo profile. This prototype will not fill in unknown values.</div>}
            </div>
            <div className="confirmation-box"><label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span className="custom-check"><Check size={12} /></span><span><strong>I have reviewed this assumption</strong><small>I understand the result preview is illustrative and will not use this input.</small></span></label></div>
            <div className="sim-footer"><span><ChevronLeft size={14} /> Assumption review</span><Button disabled={!confirmed || !assumption} onClick={() => navigate('/results', { state: { selectedEvent: active.title } })}>View demo preview <ArrowRight size={15} /></Button></div>
          </>}
        </Card>
      </div>
      <aside className="simulator-aside">
        <Card className="how-card"><div className="how-card-icon"><Sparkles size={16} /></div><h3>Built for clear decisions</h3><p>Stratify is designed to separate your assumptions from the numbers, so you can see what drives each result.</p><div className="how-step"><span>01</span><div><strong>Choose an event</strong><small>Select a business change to explore</small></div></div><div className="how-step"><span>02</span><div><strong>Confirm assumptions</strong><small>Review the inputs before calculation</small></div></div><div className="how-step"><span>03</span><div><strong>Compare outcomes</strong><small>See the potential financial impact</small></div></div></Card>
        <Card className="baseline-card"><div className="baseline-head"><span className="baseline-icon"><Activity size={15} /></span><span>YOUR BASELINE</span></div><strong>Current month</strong><div className="baseline-metric"><span>Revenue</span><b>{money(profile.revenue)}</b></div><div className="baseline-metric"><span>Expenses</span><b>{money(profile.expenses)}</b></div><div className="baseline-metric"><span>Net profit</span><b className="baseline-profit">{money(profile.profit)}</b></div><div className="baseline-foot">Demonstration data · profit is not recalculated</div></Card>
        <div className="sim-disclaimer"><CircleHelp size={15} /><p>Scenario results are estimates based on available information and assumptions. They are not guaranteed predictions or financial advice.</p></div>
      </aside>
    </div>
  </>
}
