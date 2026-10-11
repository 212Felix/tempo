import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import './help.css'

type HelpContextValue = {
  openId: string | null
  toggle: (id: string) => void
}
const HelpContext = createContext<HelpContextValue | null>(null)

/** One open explanation at a time, scoped to the currently selected TEMPO page. */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenId(current => current === id ? null : id)
  return <HelpContext.Provider value={{openId, toggle}}>{children}</HelpContext.Provider>
}

/** Non-critical help only. Warnings, statuses, and training actions stay visible. */
export default function HelpDisclosure({ id, children, label = 'Erklärung' }: {
  id: string
  children: ReactNode
  label?: string
}) {
  const context = useContext(HelpContext)
  const controlId = useId()
  if (!context) throw new Error('HelpDisclosure benötigt einen HelpProvider.')
  const expanded = context.openId === id
  return <div className="tempo-help">
    <button type="button" className="tempo-help-toggle" aria-expanded={expanded} aria-controls={controlId}
      onClick={() => context.toggle(id)}>
      <span aria-hidden="true" className="tempo-help-symbol">{expanded ? '−' : '+'}</span>
      {label} {expanded ? 'ausblenden' : 'anzeigen'}
      <span aria-hidden="true" className="tempo-help-arrow">{expanded ? '▴' : '▾'}</span>
    </button>
    <div id={controlId} className="tempo-help-body" hidden={!expanded}>{children}</div>
  </div>
}
