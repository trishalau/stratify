import { useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, CircleHelp, LoaderCircle, MessageSquareText, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, DemoNotice, Field, PageHeader } from '../components/ui'
import { useDemoBusiness } from '../components/demo-business-context'
import { money, scenarios } from '../data/demo-data'
import { Activity, Landmark, Package, Store, Target, TrendingDown, UserRoundX } from 'lucide-react'
import { confirmScenario, createScenario, interpretScenarioWithDemoProfile, listBusinesses, simulateScenario, type ChatMessage, type ScenarioInterpretation } from '../lib/api'

const icons = { package: Package, 'trending-down': TrendingDown, 'user-round-x': UserRoundX, target: Target, landmark: Landmark, store: Store }

const templates: Record<string, { assumptionLabel: string; assumption: string; suffix?: string; prefix?: string; baselineKey?: 'supplierCosts' | 'revenue'; missingInfo?: boolean; description: string }> = {
  supplier: { assumptionLabel: 'Supplier cost increase', assumption: '20', suffix: '%', baselineKey: 'supplierCosts', description: 'Change to your monthly supplier expenses.' },
  sales: { assumptionLabel: 'Monthly sales decrease', assumption: '15', suffix: '%', baselineKey: 'revenue', description: 'Change to monthly revenue.' },
  customer: { assumptionLabel: 'Share of revenue from customer', assumption: '', suffix: '%', missingInfo: true, description: 'This information is not included in the demo profile.' },
  competitor: { assumptionLabel: 'Estimated revenue change', assumption: '', suffix: '%', missingInfo: true, description: 'No impact estimate is provided in this prototype.' },
  interest: { assumptionLabel: 'Interest rate increase', assumption: '', suffix: 'points', missingInfo: true, description: 'Loan balance and current interest costs are not available.' },
  branch: { assumptionLabel: 'Estimated monthly branch cost', assumption: '', prefix: 'RM', missingInfo: true, description: 'Branch setup and operating cost details are not available.' },
}

const monthlyVariableCatalog = [
  { key: 'monthly_revenue', label: 'Monthly revenue', profileKey: 'monthly_revenue' as const, coverage: 'Sales-decrease scenarios' },
  { key: 'supplier_costs', label: 'Supplier costs', profileKey: 'supplier_costs' as const, coverage: 'Supplier and expense-change scenarios' },
  { key: 'rent', label: 'Rent', profileKey: 'rent' as const, coverage: 'Expense-change scenarios' },
  { key: 'staff_salaries', label: 'Staff salaries', profileKey: 'staff_salaries' as const, coverage: 'Expense-change scenarios' },
  { key: 'other_expenses', label: 'Other expenses', profileKey: 'other_expenses' as const, coverage: 'Expense-change scenarios' },
  { key: 'cash_balance', label: 'Cash balance', profileKey: 'cash_balance' as const, coverage: 'Current balance only; cash-flow projection unavailable' },
]

const baseExpenseOptions = [
  { key: 'supplier_costs', label: 'Supplier costs', profileKey: 'supplier_costs' as const, description: 'Products and materials bought from suppliers.' },
  { key: 'rent', label: 'Rent', profileKey: 'rent' as const, description: 'Premises or equipment rent.' },
  { key: 'staff_salaries', label: 'Staff salaries', profileKey: 'staff_salaries' as const, description: 'Payroll, salaries, and wages.' },
  { key: 'other_expenses', label: 'Other expenses', profileKey: 'other_expenses' as const, description: 'Other operating expenses saved in the business profile.' },
]

export default function Simulator() {
  const [selected, setSelected] = useState('supplier')
  const [step, setStep] = useState<'choose' | 'assumptions'>('choose')
  const [assumption, setAssumption] = useState(templates.supplier.assumption)
  const [confirmed, setConfirmed] = useState(false)
  const [customEvent, setCustomEvent] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [interpretation, setInterpretation] = useState<ScenarioInterpretation | null>(null)
  const { business, setBusiness } = useDemoBusiness()
  const [apiError, setApiError] = useState('')
  const [busy, setBusy] = useState(false)
  const [interpretationConfirmed, setInterpretationConfirmed] = useState(false)
  const [expenseMapping, setExpenseMapping] = useState('')
  const navigate = useNavigate()
  const active = scenarios.find((scenario) => scenario.id === selected) ?? scenarios[0]
  const activeTemplate = templates[selected]
  const Icon = icons[active.icon as keyof typeof icons] ?? Activity
  const visibleMonthlyVariables = monthlyVariableCatalog

  useEffect(() => {
    listBusinesses()
      .then((items) => {
        const demoBusiness = items.find((item) => item.name === 'KL Electronics Sdn. Bhd.') ?? items[0]
        if (!demoBusiness) throw new Error('No saved business was found. Add a business profile before creating a scenario.')
        setBusiness((current) => ({ ...current, id: demoBusiness.id }))
      })
      .catch((error: Error) => setApiError(error.message))
  }, [setBusiness])

  const reviewCustomEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = customEvent.trim()
    if (!text || !business || busy) return
    const updatedMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }]
    setChatMessages(updatedMessages)
    setCustomEvent('')
    setInterpretation(null)
    setInterpretationConfirmed(false)
    setExpenseMapping('')
    setApiError('')
    setBusy(true)
    try {
      const result = await interpretScenarioWithDemoProfile(business.id, updatedMessages, business)
      setInterpretation(result)
      const assistantText = [result.summary, ...result.follow_up_questions].join('\n')
      setChatMessages([...updatedMessages, { role: 'assistant', content: assistantText }])
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not interpret this event.')
    } finally {
      setBusy(false)
    }
  }

  const submitClarification = async (message: string) => {
    if (!business || busy) return
    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      { role: 'user', content: message },
    ]
    setChatMessages(updatedMessages)
    setInterpretation(null)
    setInterpretationConfirmed(false)
    setApiError('')
    setBusy(true)
    try {
      const result = await interpretScenarioWithDemoProfile(business.id, updatedMessages, business)
      setInterpretation(result)
      const assistantText = [result.summary, ...result.follow_up_questions].join('\n')
      setChatMessages([...updatedMessages, { role: 'assistant', content: assistantText }])
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not clarify the expense line.')
    } finally {
      setBusy(false)
    }
  }

  const useExpenseMapping = () => {
    const option = [...baseExpenseOptions, ...(business?.custom_monthly_variables ?? []).map((item) => ({ key: `custom:${item.name}`, label: item.name }))].find((item) => item.key === expenseMapping)
    if (option) void submitClarification(`For this expense change, use the saved expense line "${option.label}".`)
  }

  const confirmCategorySuggestion = () => {
    const suggestion = interpretation?.expense_category_suggestion
    if (suggestion) void submitClarification(`Yes, I meant ${suggestion.label}. Use that saved expense line for this change.`)
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
      const calculation = await simulateScenario(scenario.id, business)
      navigate('/results', { state: { calculation, scenarioId: scenario.id } })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not run the confirmed scenario.')
    } finally {
      setBusy(false)
    }
  }

  const runTemplateScenario = async () => {
    if (!confirmed || busy || !business || !['supplier', 'sales'].includes(selected)) return
    const value = Number(assumption)
    if (!Number.isFinite(value) || value < 0) return
    setBusy(true)
    setApiError('')
    try {
      const supplierEvent = selected === 'supplier'
      const scenario = await createScenario(business.id, {
        title: `${active.title} by ${value}%`,
        event_type: supplierEvent ? 'supplier_price_increase' : 'sales_decrease',
        description: `${active.title} by ${value}%.`,
        assumptions: { [supplierEvent ? 'supplier_cost_increase_percent' : 'sales_decrease_percent']: value },
        missing_information: [],
      })
      await confirmScenario(scenario.id)
      const calculation = await simulateScenario(scenario.id, business)
      navigate('/results', { state: { calculation, scenarioId: scenario.id } })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not calculate this demo scenario.')
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
              <details className="ai-guidance"><summary>How to describe an event</summary><div><p>Helpful details include what changes, which business item is affected, and the percentage or amount if you know it. Write figures with digits and units, such as 20% or RM 10,000. You don't need to use special commands; if a detail is unknown, say so.</p><p>Expense changes can affect <b>supplier costs</b>, <b>rent</b>, <b>staff salaries</b>, <b>other expenses</b>, and custom monthly variables added in My Business. If you mention a cost that isn't listed there, Stratify will ask which saved variable to use.</p><small>Examples: “Supplier costs increase by 20%”; “Payroll drops by 10%”; “Monthly sales decrease by 15%”.</small></div></details>
              <div className="monthly-variables-panel">
                <div className="monthly-variables-heading">
                  <div>
                    <strong>Monthly financial variables</strong>
                    <small>These profile values can be referenced in scenario descriptions.</small>
                  </div>
                </div>
                <div className="monthly-variables-grid">
                  {visibleMonthlyVariables.map((variable) => {
                    const value = business?.[variable.profileKey] ?? null
                    return <div className="monthly-variable-row" key={variable.key}>
                      <div><strong>{variable.label}</strong><small>{variable.coverage}</small></div>
                      <b>{value === null ? 'Not recorded' : `${business?.currency ?? 'MYR'} ${Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</b>
                    </div>
                  })}
                  {(business?.custom_monthly_variables ?? []).map((variable, index) => <div className="monthly-variable-row optional-variable-row" key={`${variable.name}-${index}`}>
                    <div><strong>{variable.name}</strong><small>Custom profile value · context only, not calculated</small></div>
                    <b>{business?.currency ?? 'MYR'} {Number(variable.value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </div>)}
                </div>
                <p className="monthly-variables-note">The engine currently calculates changes to revenue, supplier costs, rent, salaries, and other expenses. Cash balance, inventory, and liabilities are context only and are not projected.</p>
              </div>
              {chatMessages.length > 0 && <div className="scenario-chat" aria-live="polite">{chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`scenario-chat-message ${message.role}`}><span>{message.role === 'user' ? 'You' : 'Stratify'}</span><p>{message.content}</p></div>)}</div>}
              <form onSubmit={reviewCustomEvent}><textarea value={customEvent} onChange={(event) => setCustomEvent(event.target.value)} placeholder="e.g. Our supplier costs will increase by 20% next month…" rows={3} /><div className="custom-event-bottom"><span><Sparkles size={13} /> {business ? `Using ${business.name}` : 'Connecting to your saved business…'}</span><Button type="submit" variant="secondary" size="sm" disabled={!customEvent.trim() || !business || busy}>{busy ? <><LoaderCircle className="spin-icon" size={14} /> Working…</> : <>Review event <ArrowRight size={14} /></>}</Button></div></form>
              {apiError && <div className="inline-error" role="alert">{apiError}</div>}
                {interpretation && <div className="interpretation-panel"><div className="interpretation-heading"><div><span className="eyebrow">AI INTERPRETATION · REVIEW REQUIRED</span><h3>{interpretation.title}</h3></div><span className={interpretation.simulation_supported && interpretation.missing_information.length === 0 ? 'support-badge' : 'unsupported-badge'}>{interpretation.missing_information.length > 0 ? 'Needs clarification' : interpretation.simulation_supported ? 'Calculation available' : 'Clarification only'}</span></div><p>{interpretation.summary}</p>
                {Object.keys(interpretation.assumptions).length > 0 && <div className="interpretation-assumptions"><strong>Proposed assumptions</strong>{Object.entries(interpretation.assumptions).map(([name, value]) => <div key={name}><span>{name.replaceAll('_', ' ')}</span><b>{String(value)}{name.endsWith('_percent') ? '%' : ''}</b><small>Evidence: “{interpretation.assumption_evidence[name]}”</small></div>)}</div>}
                {interpretation.expense_category_suggestion && <div className="category-suggestion-panel"><div><strong>Did you mean {interpretation.expense_category_suggestion.label}?</strong><p>You wrote “{interpretation.expense_category_suggestion.mentioned}”. Confirming will use the saved {interpretation.expense_category_suggestion.label.toLowerCase()} line.</p></div><Button size="sm" variant="secondary" disabled={busy} onClick={confirmCategorySuggestion}>Yes, use {interpretation.expense_category_suggestion.label} <Check size={13} /></Button></div>}
                {interpretation.event_type === 'expense_change' && !('expense_category' in interpretation.assumptions) && <div className="expense-mapping-panel"><div><strong>Choose which saved expense line to use</strong><p>Select a built-in expense or one of your custom monthly variables. Revenue has its own event; cash, inventory, and liabilities are not calculated as expenses.</p></div><div className="expense-option-list">{[...baseExpenseOptions.map((option) => ({ ...option, value: business?.[option.profileKey] ?? '0' })), ...(business?.custom_monthly_variables ?? []).map((item) => ({ key: `custom:${item.name}`, label: item.name, description: 'Custom monthly expense from your business profile.', value: item.value }))].map((option) => <label className={`expense-option ${expenseMapping === option.key ? 'expense-option-selected' : ''}`} key={option.key}><input type="radio" name="expense-mapping" value={option.key} checked={expenseMapping === option.key} onChange={() => setExpenseMapping(option.key)} /><span className="expense-option-check"><Check size={12} /></span><span className="expense-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span><b>{business ? `${business.currency} ${Number(option.value).toLocaleString('en-MY')}` : '—'}</b></label>)}</div><div className="expense-mapping-action"><small>This choice is sent back as your clarification. You will review the resulting assumptions before any calculation.</small><Button size="sm" variant="secondary" disabled={!expenseMapping || busy} onClick={useExpenseMapping}>{busy ? 'Clarifying…' : 'Use selected line'} <ArrowRight size={14} /></Button></div></div>}
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
              {activeTemplate.baselineKey && <div className="baseline-reference"><div><span>Business baseline</span><strong>{activeTemplate.baselineKey === 'revenue' ? `Monthly revenue · ${money(Number(business.monthly_revenue))}` : `Monthly supplier costs · ${money(Number(business.supplier_costs))}`}</strong></div><span className="baseline-source">Current demo session</span></div>}
              {activeTemplate.missingInfo && <div className="inline-notice">Some information needed for this scenario is not in the demo profile. This prototype will not fill in unknown values.</div>}
            </div>
            <div className="confirmation-box"><label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span className="custom-check"><Check size={12} /></span><span><strong>I have reviewed this assumption</strong><small>Calculation uses your current in-memory demo financials.</small></span></label></div>
            {apiError && <div className="inline-error" role="alert">{apiError}</div>}
            {!['supplier', 'sales'].includes(selected) && <div className="inline-notice">This predefined scenario is not supported by the current financial engine. Use a supported custom event to calculate an estimate.</div>}
            <div className="sim-footer"><span><ChevronLeft size={14} /> Assumption review</span><Button disabled={!confirmed || !assumption || busy || !['supplier', 'sales'].includes(selected)} onClick={runTemplateScenario}>{busy ? 'Calculating…' : 'Confirm & calculate'} <ArrowRight size={15} /></Button></div>
          </>}
        </Card>
      </div>
      <aside className="simulator-aside">
        <Card className="how-card"><div className="how-card-icon"><Sparkles size={16} /></div><h3>Built for clear decisions</h3><p>Stratify is designed to separate your assumptions from the numbers, so you can see what drives each result.</p><div className="how-step"><span>01</span><div><strong>Choose an event</strong><small>Select a business change to explore</small></div></div><div className="how-step"><span>02</span><div><strong>Confirm assumptions</strong><small>Review the inputs before calculation</small></div></div><div className="how-step"><span>03</span><div><strong>Compare outcomes</strong><small>See the potential financial impact</small></div></div></Card>
        <Card className="baseline-card"><div className="baseline-head"><span className="baseline-icon"><Activity size={15} /></span><span>DEMO BUSINESS BASELINE</span></div><strong>{business.name}</strong><div className="baseline-metric"><span>Revenue</span><b>{business.currency} {Number(business.monthly_revenue).toLocaleString('en-MY')}</b></div><div className="baseline-metric"><span>Supplier costs</span><b>{business.currency} {Number(business.supplier_costs).toLocaleString('en-MY')}</b></div><div className="baseline-metric"><span>Cash balance</span><b>{business.currency} {Number(business.cash_balance).toLocaleString('en-MY')}</b></div><div className="baseline-foot">Temporary in-memory values · refresh resets sample data</div></Card>
        <div className="sim-disclaimer"><CircleHelp size={15} /><p>Scenario results are estimates based on available information and assumptions. They are not guaranteed predictions or financial advice.</p></div>
      </aside>
    </div>
  </>
}
