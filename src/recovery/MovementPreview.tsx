/** Simple original TEMPO position sketches. Not photos, and not a medical movement prescription. */
import type {ReactNode} from 'react'
import './movement-preview.css'
type Pose='breath'|'spine'|'hip'|'twist'|'lunge'|'bridge'|'stretch'|'wall'|'leg'|'stand'
export function classifyPose(name:string):Pose{
 const n=name.toLowerCase()
 if(/atmen|atmung|entspannen|ankommen|ausschütteln/.test(n))return 'breath'
 if(/katze|kuh|vierfüßler/.test(n))return 'spine'
 if(/90\/90|hüftrotation/.test(n))return 'hip'
 if(/brustwirbelsäul|rotier|aufdrehen/.test(n))return 'twist'
 if(/ausfallschritt|hüftbeuger|knie.zur.wand/.test(n))return 'lunge'
 if(/brücke|bridge|thrust/.test(n))return 'bridge'
 if(/kindhaltung|beinrückseite|waden|sprunggelenk/.test(n))return 'stretch'
 if(/türrahmen|wall slides|brustöffnung|außenrotation/.test(n))return 'wall'
 if(/bein|fuß/.test(n))return 'leg'
 return 'stand'
}
const human=(headX:number,headY:number,lines:number[][]):ReactNode=><g><circle cx={headX} cy={headY} r="6"/>{lines.map((pts,i)=><polyline key={i} points={pts.join(' ')}/>)}</g>
function poseIllustration(pose:Pose,end:boolean):ReactNode{
 const t=end?1:0
 switch(pose){
 case 'breath': return <>{human(55,28,[[55,35,55,67],[55,45,38,60],[55,45,72,60],[55,67,39,85],[55,67,71,85]])}<path className="tempo-motion" d={end?'M79 41q9 8 0 16 M87 39q11 11 0 22':'M24 42q-8 8 0 16 M16 40q-10 11 0 22'}/></>
 case 'spine':return <>{human(29+t*3,43-t*4,[[35,47,53,45-t*11,77,45],[45,50,42,74],[70,50,77,74]])}<path className="tempo-ground" d="M20 77H88"/></>
 case 'hip':return <>{human(54,30,[[54,37,54,60],[54,49,38,65],[54,49,73,65],[54,60,32,81],[54,60,79,76+t*6]])}<path className="tempo-ground" d="M20 84H90"/></>
 case 'twist':return <>{human(46,58,[[38,62,22,76],[46,60,62,77],[40,64,59,69],[59,69,80,69]])}<path d={t?'M42 59 Q60 30 83 34':'M43 59Q63 56 83 59'}/><path className="tempo-motion" d={t?'M76 35L84 35L82 44':''}/></>
 case 'lunge':return <>{human(53+t*6,23,[[53,30,53+t*8,56],[53,37,41,53],[53,37,67,53],[53+t*8,56,40,66,36,81],[53+t*8,56,73,68,86,80]])}<path className="tempo-ground" d="M15 83H95"/></>
 case 'bridge':return <>{human(22,70,[[28,70,48,64-t*17,67,62],[67,62,80,79],[48,64-t*17,44,79]])}<path className="tempo-ground" d="M14 82H93"/></>
 case 'stretch':return <>{human(43,30+t*9,[[43,37+t*9,49,61],[45,49,30,63],[49,61,31,81],[49,61,72,76]])}<path className="tempo-ground" d="M17 84H91"/></>
 case 'wall':return <><path className="tempo-wall" d="M86 14V89"/>{human(50,25,[[50,32,50,62],[50,42,69+t*12,44-t*14],[50,42,37,54],[50,62,40,83],[50,62,64,83]])}</>
 case 'leg':return <>{human(52,26,[[52,33,52,59],[52,43,38,53],[52,43,66,53],[52,59,37+t*9,80],[52,59,74-t*11,80]])}<path className="tempo-ground" d="M20 85H91"/></>
 default:return <>{human(50,25,[[50,32,50,62],[50,43,35,55],[50,43,67,55-t*12],[50,62,38,82],[50,62,64,82]])}<path className="tempo-ground" d="M20 85H91"/></>
 }
}
export default function MovementPreview({name}:{name:string}){
 const type=classifyPose(name),same=type==='breath'
 return <div className="tempo-movement-preview" aria-label={same?'Illustration: ruhige Atmung':'Skizze mit Ausgangs- und Bewegungsposition'}>
   <div className="tempo-movement-pair">
     <div className="tempo-movement-frame"><span>{same?'Einatmen':'Startposition'}</span><svg viewBox="0 0 110 99" aria-hidden="true">{poseIllustration(type,false)}</svg></div>
     <span className="tempo-movement-arrow" aria-hidden="true">→</span>
     <div className="tempo-movement-frame"><span>{same?'Ausatmen':'Dehnung / Bewegung'}</span><svg viewBox="0 0 110 99" aria-hidden="true">{poseIllustration(type,true)}</svg></div>
   </div>
   <small>Vereinfachte Skizze. Anleitung lesen, ruhig bewegen und nur im schmerzfreien Bereich bleiben.</small>
 </div>
}
