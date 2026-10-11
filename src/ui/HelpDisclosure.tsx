import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import './help.css'

type HelpContextValue = {openId: string | null; toggle:(id:string)=>void}
const HelpContext = createContext<HelpContextValue|null>(null)

/** Exactly one explanation open per page. */
export function HelpProvider({children}:{children:ReactNode}) {
  const [openId,setOpenId] = useState<string|null>(null)
  return <HelpContext.Provider value={{openId,toggle:(id)=>setOpenId(current=>current===id?null:id)}}>{children}</HelpContext.Provider>
}

export default function HelpDisclosure({id,children,label='Erklärung'}:{id:string;children:ReactNode;label?:string}) {
  const context=useContext(HelpContext)
  const contentId=useId()
  if(!context)throw new Error('HelpDisclosure benötigt einen HelpProvider.')
  const expanded=context.openId===id
  return <div className="tempo-help">
    <button type="button" className="tempo-help-toggle" aria-label={`${label} ${expanded?'ausblenden':'anzeigen'}`}
      title={`${label} ${expanded?'ausblenden':'anzeigen'}`} aria-expanded={expanded} aria-controls={contentId}
      onClick={()=>context.toggle(id)}><span aria-hidden="true">?</span></button>
    <div id={contentId} className="tempo-help-body" hidden={!expanded}>{children}</div>
  </div>
}
