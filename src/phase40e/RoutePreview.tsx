import type {FitTrace} from '../garmin/fit'
/** Local SVG – no GPS positions sent to a map provider. */
export default function RoutePreview({trace}:{trace:FitTrace}){
 const points=trace.points.filter(p=>typeof p.lat==='number'&&Number.isFinite(p.lat)&&typeof p.lon==='number'&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180)
 if(points.length<3)return null
 const lats=points.map(p=>p.lat!),lons=points.map(p=>p.lon!)
 const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons)
 const latSpan=Math.max(0.00001,maxLat-minLat),lonSpan=Math.max(0.00001,maxLon-minLon)
 const midLat=(minLat+maxLat)/2,scaledLon=lonSpan*Math.max(.2,Math.cos(midLat*Math.PI/180)),scale=Math.min(290/scaledLon,135/latSpan)
 const centerLat=(minLat+maxLat)/2,centerLon=(minLon+maxLon)/2
 const coords=points.map((p,i)=>`${i===0?'M':'L'}${(160+(p.lon!-centerLon)*Math.cos(midLat*Math.PI/180)*scale).toFixed(1)},${(83-(p.lat!-centerLat)*scale).toFixed(1)}`).join(' ')
 return <div className="tempo40e-route" data-tempo-no-swipe><h4>GPS-Streckenverlauf · lokal</h4><svg width="100%" viewBox="0 0 320 170" role="img" aria-label="Streckenprofil aus tatsächlich gespeicherten Garmin-GPS-Positionen, ohne Kartenhintergrund"><rect x="1" y="1" width="318" height="168" fill="#91b0c8" fillOpacity=".07" stroke="#91b0c8" strokeOpacity=".3" rx="12"/><path d={coords} fill="none" stroke="#4bb59e" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/><circle cx={160+(points[0].lon!-centerLon)*Math.cos(midLat*Math.PI/180)*scale} cy={83-(points[0].lat!-centerLat)*scale} r="4.5" fill="#61bddf"/><circle cx={160+(points.at(-1)!.lon!-centerLon)*Math.cos(midLat*Math.PI/180)*scale} cy={83-(points.at(-1)!.lat!-centerLat)*scale} r="4.5" fill="#e3a564"/></svg><small>Blau = Start, Orange = Ende. Reine Routenskizze ohne Straßenkarte. Deine Koordinaten bleiben im Browser.</small></div>
}
