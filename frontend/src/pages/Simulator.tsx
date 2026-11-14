import { useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, CircleHelp, LoaderCircle, MessageSquareText, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, DemoNotice, Field, PageHeader } from '../components/ui'
import { getBusinessProfile, money, scenarios } from '../data/demo-data'
import { Activity, Landmark, Package, Store, Target, TrendingDown, UserRoundX } from 'lucide-react'
import { confirmScenario, createScenario, interpretScenario, listBusinesses, simulateScenario, type Business, type ChatMessage, type ScenarioInterpretation } from '../lib/api'

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [interpretation, setInterpretation] = useState<ScenarioInterpretation | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [apiError, setApiError] = useState('')
  const [busy, setBusy] = useState(false)
  const [interpretationConfirmed, setInterpretationConfirmed] = useState(false)
  const navigate = useNavigate()
  const profile = getBusinessProfile()
  const active = scenarios.find((scenario) => scenario.id === selected) ?? scenarios[0]
  const activeTemplate = templates[selected]
  const Icon = icons[active.icon as keyof typeof icons] ?? Activity

  useEffect(() => {
    listBusinesses()
      .then((items) => {
        const demoBusiness = items.find((item) => item.name === 'KL Electronics Sdn. Bhd.') ?? items[0]
        if (!demoBusiness) throw new Error('No saved business was found. Add a business profile before creating a scenario.')
        setBusiness(demoBusiness)
      })
      .catch((error: Error) => setApiError(error.message))
  }, [])

  const reviewCustomEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = customEvent.trim()
    if (!text || !business || busy) return
    const updatedMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }]
    setChatMessages(updatedMessages)
    setCustomEvent('')
    setInterpretation(null)
    setInterpretationConfirmed(false)
    setApiError('')
    setBusy(true)
    try {
      const result = await interpretScenario(business.id, updatedMessages)
      setInterpretation(result)
      const assistantText = [result.summary, ...result.follow_up_questions].join('\n')
      setChatMessages([...updatedMessages, { role: 'assistant', content: assistantText }])
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not interpret this event.')
    } finally {
      setBusy(false)
    }
  }

  const runConfirmedScenario = async () => {
    if (!business || !interpretation?.ready_for_confirmation || !interpretationConfirmed || busy) return
    setBusy(true)
    setApiError('')
    try {
      const description = chatMessages.filter((message) => message.role === 'user').map((message) => message.content).join('\n')
      const scenario = await createScenario(business.id, {
        title: interpretation.title,
        event_type: interpretation.event_type,
        description,
        assumptions: interpretation.assumptions,
        missing_information: [],
      })
      await confirmScenario(scenario.id)
      const calculation = await simulateScenario(scenario.id)
      navigate('/results', { state: { calculation, scenarioId: scenario.id } })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not run the confirmed scenario.')
    } finally {
      setBusy(false)
    }
  }

  const selectScenario = (id: string) => {
    setSelected(id)
    setAssumption(templates[id].assumption)
    setConfirmed(false)
    setStep('choose')
  }

  return <>
    <PageHeader eyebrow="WHAT-IF PLANNING" title="Scenario simulator" description="Explore how a change could affect your business, one assumption at a time." />
    <DemoNotice>AI interpretation is connected for custom events. Only explicitly confirmed assumptions reach the deterministic financial engine.</DemoNotice>
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
            <div className="custom-event-box"><div className="custom-event-icon"><MessageSquareText size={16} /></div><div className="custom-event-content"><strong>Describe a custom event</strong><p>Use your own words. Stratify will ask when it needs a clearer detail.</p>
              <details className="ai-guidance"><summary>How to describe an event</summary><div><p>Helpful details include what changes, which business item is affected, and the percentage or amount if you know it. Write figures with digits and units, such as 20% or RM 10,000. You don't need to use special commands; if a detail is unknown, say so.</p><p>For expense changes, saved lines are <b>supplier costs</b>, <b>rent</b>, <b>staff salaries</b>, and <b>other expenses</b>. If you mention another item, such as marketing or utilities, Stratify will ask which saved line to use.</p><small>Examples: “Supplier costs increase by 20%”; “Payroll drops by 10%”; “Monthly sales decrease by 15%”.</small></div></details>
              {chatMessages.length > 0 && <div className="scenario-chat" aria-live="polite">{chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`scenario-chat-message ${message.role}`}><span>{message.role === 'user' ? 'You' : 'Stratify'}</span><p>{message.content}</p></div>)}</div>}
              <form onSubmit={reviewCustomEvent}><textarea value={customEvent} onChange={(event) => setCustomEvent(event.target.value)} placeholder="e.g. Our supplier costs will increase by 20% next month…" rows={3} /><div className="custom-event-bottom"><span><Sparkles size={13} /> {business ? `Using ${business.name}` : 'Connecting to your saved business…'}</span><Button type="submit" variant="secondary" size="sm" disabled={!customEvent.trim() || !business || busy}>{busy ? <><LoaderCircle className="spin-icon" size={14} /> Working…</> : <>Review event <ArrowRight size={14} /></>}</Button></div></form>
              {apiError && <div className="inline-error" role="alert">{apiError}</div>}
                {interpretation && <div className="interpretation-panel"><div className="interpretation-heading"><div><span className="eyebrow">AI INTERPRETATION · REVIEW REQUIRED</span><h3>{interpretation.title}</h3></div><span className={interpretation.simulation_supported && interpretation.missing_information.length === 0 ? 'support-badge' : 'unsupported-badge'}>{interpretation.missing_information.length > 0 ? 'Needs clarification' : interpretation.simulation_supported ? 'Calculation available' : 'Clarification only'}</span></div><p>{interpretation.summary}</p>
                {Object.keys(interpretation.assumptions).length > 0 && <div className="interpretation-assumptions"><strong>Proposed assumptions</strong>{Object.entries(interpretation.assumptions).map(([name, value]) => <div key={name}><span>{name.replaceAll('_', ' ')}</span><b>{String(value)}{name.endsWith('_percent') ? '%' : ''}</b><small>Evidence: “{interpretation.assumption_evidence[name]}”</small></div>)}</div>}
                {interpretation.missing_information.length > 0 && <div className="inline-notice"><strong>Information needed</strong><ul>{interpretation.missing_information.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                {!interpretation.simulation_supported && !interpretation.clarification_only && <div className="inline-notice">This event is understood, but the deterministic engine does not yet calculate it. No financial result will be generated.</div>}
                {interpretation.ready_for_confirmation && interpretation.simulation_supported && <label className="check-row interpretation-confirm"><input type="checkbox" checked={interpretationConfirmed} onChange={(event) => setInterpretationConfirmed(event.target.checked)} /><span className="custom-check"><Check size={12} /></span><span><strong>I reviewed and confirm these assumptions</strong><small>Stratify will save this scenario and run its deterministic monthly calculation.</small></span></label>}
                <div className="interpretation-actions"><span>{interpretation.ready_for_confirmation ? 'Ready after your confirmation' : 'Resolve missing information to continue'}</span>{interpretation.ready_for_confirmation && interpretation.simulation_supported && <Button size="sm" disabled={!interpretationConfirmed || busy} onClick={runConfirmedScenario}>{busy ? 'Running…' : 'Confirm & run'} <ArrowRight size={14} /></Button>}</div>
              </div>}
            </div></div>
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
        <Card className="baseline-card"><div className="baseline-head"><span className="baseline-icon"><Activity size={15} /></span><span>SAVED BUSINESS BASELINE</span></div><strong>{business?.name ?? 'Connecting to business profile…'}</strong>{business && <><div className="baseline-metric"><span>Revenue</span><b>{business.currency} {Number(business.monthly_revenue).toLocaleString('en-MY')}</b></div><div className="baseline-metric"><span>Supplier costs</span><b>{business.currency} {Number(business.supplier_costs).toLocaleString('en-MY')}</b></div><div className="baseline-metric"><span>Cash balance</span><b>{business.currency} {Number(business.cash_balance).toLocaleString('en-MY')}</b></div></>}<div className="baseline-foot">Read from the backend business profile</div></Card>
        <div className="sim-disclaimer"><CircleHelp size={15} /><p>Scenario results are estimates based on available information and assumptions. They are not guaranteed predictions or financial advice.</p></div>
      </aside>
    </div>
  </>
}
