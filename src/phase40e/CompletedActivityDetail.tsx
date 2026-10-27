import {useState} from 'react'
import {useSessionData} from './SessionAnalysis'
import {germanDate} from '../phase40c/date'
import FitChart from '../garmin/FitChart'
import FitInsights from '../garmin/FitInsights'
import RoutePreview from './RoutePreview'
/** Standalone completed records without a matching planned session. */
export default function CompletedActivityDetail({id}:{id:string}){
 const data=useSessionData(),[expanded,setExpanded]=useState(false)
 const completion=data.completed.find(c=>c.id===id)
 const activity=completion?.externalActivityId?data.activities.find(a=>a.id===completion.externalActivityId):data.activities.find(a=>a.id===id)
 const trace=activity?.fitSeriesId?data.traces.find(t=>t.id===activity.fitSeriesId&&t.activityId===activity.id):undefined
 if(!completion&&!activity)return <p>Der abgeschlossene Trainingseintrag wurde auf diesem Gerät noch nicht geladen.</p>
 const duration=activity?.durationMin??completion?.durationMin
 return <div className="tempo40e-session-analysis"><h3>✓ {activity?.title??completion?.title??'Abgeschlossenes Training'}</h3><p>{germanDate(activity?.date??completion?.date??'')} · {duration!==undefined?Math.round(duration)+' min':'Dauer nicht erfasst'}</p>
  <div className="tempo40e-metrics"><div><small>Distanz</small><strong>{activity?.distanceKm??completion?.distanceKm??'—'} km</strong></div><div><small>Ø Puls</small><strong>{activity?.avgHrBpm??'—'} bpm</strong></div><div><small>Ø Watt</small><strong>{activity?.avgPowerW??'—'} W</strong></div><div><small>Höhenmeter</small><strong>{activity?.elevationM??completion?.elevationM??'—'} hm</strong></div></div>
  {trace&&activity?<><button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?'Garmin-Verlauf ausblenden':'Garmin-Leistungsdaten und Verlauf öffnen'}</button>{expanded&&<><FitChart trace={trace}/><FitInsights trace={trace} activity={activity}/><RoutePreview trace={trace}/></>}</>:<p>Für diesen Eintrag ist kein vollständiger FIT-Zeitverlauf gespeichert. Die vorhandene Zusammenfassung bleibt erhalten.</p>}
 </div>
}
