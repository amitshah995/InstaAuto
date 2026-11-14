/**
 * Setup wizard progress. Pure.
 *
 * Who calls this: app/api/ai-agent/status (server) and components/ai-agent/SetupWizard.tsx (display).
 * Why: "done / not done" for each step must be one rule, not re-derived in the UI.
 */
export interface WizardFacts {
  connectorConfigured: boolean
  connectorSkipped: boolean
  knowledgeCount: number
  settingsSaved: boolean
  ruleActive: boolean
  agentEnabled: boolean
}
export interface WizardStep { id: 1 | 2 | 3 | 4; title: string; done: boolean; optional: boolean }

export function computeWizard(f: WizardFacts): { steps: WizardStep[]; doneCount: number; nextStep: 1 | 2 | 3 | 4 | null; complete: boolean } {
  const steps: WizardStep[] = [
    { id: 1, title: "Connect AiSend (or skip)", done: f.connectorConfigured || f.connectorSkipped, optional: true },
    { id: 2, title: "Add Reel knowledge", done: f.knowledgeCount > 0, optional: false },
    { id: 3, title: "Tone, language and handoff", done: f.settingsSaved, optional: false },
    { id: 4, title: "Turn it on", done: f.ruleActive && f.agentEnabled, optional: false },
  ]
  const next = steps.find((s) => !s.done)
  return { steps, doneCount: steps.filter((s) => s.done).length, nextStep: next ? next.id : null, complete: !next }
}
