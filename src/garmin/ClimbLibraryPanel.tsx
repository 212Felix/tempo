import {useEffect,useMemo,useState} from 'react'
import {listRecords} from '../db/storage'
import type {GarminActivity} from './csv'
import type {FitTrace} from './fit'
import {buildClimbLibrary,comparisonNotes,type LibraryClimb} from './climbLibrary'
import './climb-library.css'

const PROFILE_ID='local-primary-profile'
const decimal=(n:number,places=1)=>n.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:places})
const number=(n:number|undefined,unit:string)=>n===undefined?'–':`${decimal(n,0)} ${unit}`
const duration=(seconds:number)=>`${Math.round(seconds/60)} min`
const dateLabel=(date:string)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${date}T12:00:00`))

type Filter='all'|'short'|'middle'|'long'
const inFilter=(c:LibraryClimb,filter:Filter)=>{
  const min=c.climb.elapsedSeconds/60 // Elapsed span, NOT confirmed pedalling time.
  if(filter==='short')return min<20
  if(filter==='middle')return min>=20 && min<30
  if(filter==='long')return min>=30
  return true
}

export default function ClimbLibraryPanel({activities,refreshVersion=0}:{activities:GarminActivity[],refreshVersion?:number}){
  const [traces,setTraces]=useState<FitTrace[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [filter,setFilter]=useState<Filter>('all')
  const [selectedA,setSelectedA]=useState<string|null>(null)
  const [selectedB,setSelectedB]=useState<string|null>(null)
  const [showAll,setShowAll]=useState(false)
  const [reloadCount,setReloadCount]=useState(0)
  useEffect(()=>{
    let active=true
    setLoading(true)
    setError('')
    void listRecords<FitTrace>('performanceEntries').then(records=>{
      if(!active)return
      setTraces(records.filter(row=>row.profileId===PROFILE_ID && row.kind==='garmin-fit-trace'))
      setLoading(false)
    }).catch(err=>{
      if(!active)return
      setError(`Anstiegsbibliothek konnte nicht geladen werden: ${err instanceof Error?err.message:String(err)}`)
      setLoading(false)
    })
    return()=>{active=false}
  },[refreshVersion,reloadCount])

  const entries=useMemo(()=>buildClimbLibrary(traces,activities),[traces,activities])
  const filtered=useMemo(()=>entries.filter(c=>inFilter(c,filter)),[entries,filter])
  const byKey=useMemo(()=>new Map(entries.map(c=>[c.key,c])),[entries])
  const a=selectedA?byKey.get(selectedA):undefined
  const b=selectedB?byKey.get(selectedB):undefined
  const shown=showAll?filtered:filtered.slice(0,30)
  function choose(key:string){
    if(key===selectedA){setSelectedA(selectedB);setSelectedB(null);return}
    if(key===selectedB){setSelectedB(null);return}
    if(!selectedA || !byKey.has(selectedA)){setSelectedA(key);return}
    setSelectedB(key)
  }
  function filterChange(f:Filter){setFilter(f);setShowAll(false)}
  const difference=(first:number|undefined,second:number|undefined,unit:string)=>first===undefined||second===undefined?'–':`${second-first>0?'+':''}${decimal(second-first,0)} ${unit}`
  return <section className="tempo-garmin-panel tempo-climb-library" aria-labelledby="tempo-climb-library-title">
    <div className="eyebrow">LEISTUNGSBIBLIOTHEK · GARMIN FIT</div>
    <div className="tempo-climb-library-head"><div><h2 id="tempo-climb-library-title">Anstiege vergleichen</h2><p>Erkannte Anstiege aus allen gespeicherten Rad-FIT-Dateien sammeln und zwei Abschnitte gegenüberstellen.</p></div>
      <button type="button" className="tempo-climb-library-refresh" onClick={()=>setReloadCount(n=>n+1)}>Aktualisieren</button></div>
    <div className="tempo-climb-library-overview">
      <div><strong>{entries.length}</strong><small>Anstiegskandidaten</small></div>
      <div><strong>{new Set(entries.map(x=>x.activityId)).size}</strong><small>FIT-Fahrten mit Anstiegen</small></div>
    </div>
    {loading?<p className="tempo-climb-library-note">FIT-Verläufe werden lokal ausgewertet …</p>:error?<p role="alert" className="tempo-climb-library-warning">{error}</p>:!entries.length?<p className="tempo-climb-library-note">Noch keine auswertbaren Anstiege vorhanden. Importiere eine Rad-FIT-Datei oder prüfe, ob ihre Höhen- und Distanzwerte vollständig sind.</p>:<>
      <p className="tempo-climb-library-note">Tippe auf zwei Anstiege: Die erste Auswahl wird <strong>A</strong>, die zweite <strong>B</strong>. Erneutes Tippen entfernt die Auswahl. Die Dauer ist die verstrichene Abschnittszeit – mögliche Pausen sind nicht als aktive Fahrzeit nachgewiesen.</p>
      <div className="tempo-climb-library-filters" role="group" aria-label="Anstiege nach Zeitspanne filtern">
        {([['all','Alle'],['short','Unter 20 min'],['middle','20–30 min'],['long','30+ min']] as const).map(([key,label])=><button key={key} type="button" className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>filterChange(key)}>{label}</button>)}
      </div>
      {!filtered.length?<p className="tempo-climb-library-note">Für diese Zeitspanne wurden noch keine Anstiege erkannt.</p>:<div className="tempo-climb-library-list">
        {shown.map((item)=>{
          const marker=item.key===selectedA?'A':item.key===selectedB?'B':null
          return <button key={item.key} type="button" className={`tempo-climb-library-choice ${marker?'selected':''}`} aria-pressed={marker!==null} onClick={()=>choose(item.key)}>
            <span className="tempo-climb-library-choice-title"><span className="tempo-climb-library-marker">{marker??'+'}</span><span><strong>{dateLabel(item.date)} · {item.activityTitle}</strong><small>Anstieg {item.climbNumber} · km {decimal(item.climb.startKm)}–{decimal(item.climb.endKm)}</small></span></span>
            <span className="tempo-climb-library-choice-stats">{duration(item.climb.elapsedSeconds)} · Ø {decimal(item.climb.gradePct)} % · {number(item.analysis?.all.powerW??item.climb.averagePowerW,'W')}</span>
          </button>
        })}
      </div>}
      {!showAll && filtered.length>30 && <button type="button" className="tempo-climb-library-refresh" onClick={()=>setShowAll(true)}>Alle {filtered.length} Kandidaten anzeigen</button>}
      <div className="tempo-climb-library-compare">
        <div className="tempo-climb-library-compare-heading"><h3>Vergleich A und B</h3><button type="button" className="tempo-climb-library-refresh" onClick={()=>{setSelectedA(null);setSelectedB(null)}} disabled={!selectedA&&!selectedB}>Auswahl löschen</button></div>
        {!a||!b?<p className="tempo-climb-library-note">{a?'Anstieg A gewählt – bitte noch Anstieg B auswählen.':'Bitte zuerst zwei Anstiege aus der Liste wählen.'}</p>:<>
          <div className="tempo-climb-library-compare-names"><div><span className="tempo-climb-library-marker">A</span><strong>{a.activityTitle}</strong><small>{dateLabel(a.date)} · km {decimal(a.climb.startKm)}–{decimal(a.climb.endKm)}</small></div>
          <div><span className="tempo-climb-library-marker">B</span><strong>{b.activityTitle}</strong><small>{dateLabel(b.date)} · km {decimal(b.climb.startKm)}–{decimal(b.climb.endKm)}</small></div></div>
          <div className="tempo-climb-library-comparison" role="table" aria-label="Anstiege A und B im Vergleich">
            <div role="row"><strong role="columnheader">Messwert</strong><strong role="columnheader">A</strong><strong role="columnheader">B</strong></div>
            {([
              ['Zeitspanne',duration(a.climb.elapsedSeconds),duration(b.climb.elapsedSeconds)],
              ['Länge',`${decimal(a.climb.distanceKm)} km`,`${decimal(b.climb.distanceKm)} km`],
              ['Höhengewinn',number(a.climb.riseM,'hm'),number(b.climb.riseM,'hm')],
              ['Ø Steigung',`${decimal(a.climb.gradePct)} %`,`${decimal(b.climb.gradePct)} %`],
              ['Ø Watt',number(a.analysis?.all.powerW??a.climb.averagePowerW,'W'),number(b.analysis?.all.powerW??b.climb.averagePowerW,'W')],
              ['Ø Puls',number(a.analysis?.all.heartRateBpm??a.climb.averageHrBpm,'bpm'),number(b.analysis?.all.heartRateBpm??b.climb.averageHrBpm,'bpm')],
              ['Ø Kadenz',number(a.analysis?.all.cadenceRpm,'rpm'),number(b.analysis?.all.cadenceRpm,'rpm')],
              ['Watt zweite – erste Hälfte',a.analysis?difference(a.analysis.firstHalf.powerW,a.analysis.secondHalf.powerW,'W'):'–',b.analysis?difference(b.analysis.firstHalf.powerW,b.analysis.secondHalf.powerW,'W'):'–']
            ] as const).map(([name,av,bv])=><div role="row" key={name}><span role="cell">{name}</span><span role="cell">{av}</span><span role="cell">{bv}</span></div>)}
          </div>
          <div className="tempo-climb-library-warning"><strong>Einordnung</strong>{comparisonNotes(a,b).map((x,i)=><p key={i}>{x}</p>)}</div>
        </>}
      </div>
    </>}
    <p className="tempo-climb-library-note">Die Bibliothek ist eine beschreibende Analyse aus lokal gespeicherten 5-Sekunden-FIT-Stichproben. Gleiche Watt oder Herzfrequenz bedeuten nicht automatisch gleiche Form. Noch keine automatische Trainingsänderung oder Freigabe von Intervallstrecken.</p>
  </section>
}
