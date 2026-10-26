/** TEMPO Phase 39 – Garmin Connect PERSONAL API private bridge.
 * No personal data, GPS, API tokens or credentials are logged or published.
 * Deploy independently on Cloudflare Workers Free, with private D1 and Worker secrets.
 */
const GARMIN_BASE = 'https://personal.connectapi.garmin.com'
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token'
const DAY = 86400_000
const MAX = 50
const bounds = (n, max) => Number.isFinite(n) && n >= 0 && n <= max ? n : undefined
const metric = (o, keys, max) => {
  for (const key of keys) {
    const n = Number(o?.[key])
    if (o?.[key] !== null && o?.[key] !== undefined && bounds(n, max) !== undefined) return n
  }
  return undefined
}
function safeSport(v) {
  const key = String(v?.activityType?.typeKey ?? v?.activityType ?? v?.sport ?? v?.type ?? '').toLowerCase()
  if (/cycling|biking|road_bike|mountain_bike|gravel|indoor_cycling|virtual_ride/.test(key)) return 'cycling'
  if (/running|trail_running|treadmill/.test(key)) return 'running'
  if (/swimming|pool_swim|open_water/.test(key)) return 'swimming'
  return null
}
export function normalizeActivity(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.activityId ?? '')
  const sport = safeSport(raw)
  const start = raw.startTimeGMT || raw.startTimeLocal
  if (!/^\d{5,20}$/.test(id) || !sport || typeof start !== 'string') return null
  const date = /^\d{4}-\d\d-\d\d/.exec(start)?.[0]
  if (!date || !Number.isFinite(Date.parse(date+'T12:00:00Z'))) return null
  const seconds = metric(raw, ['duration','elapsedDuration','elapsedTime'], 172800)
  if (seconds === undefined || seconds <= 0) return null
  const title = String(raw.activityName || ({cycling:'Radfahren',running:'Laufen',swimming:'Schwimmen'})[sport]).slice(0,140)
  const s = String(start).replace(' ','T')
  const normalized = {garminActivityId:id,date,startedAt:s,title,sport,
    activityType:String(raw.activityType?.typeKey ?? sport).slice(0,60),durationSeconds:seconds}
  const numeric = {
    movingSeconds:metric(raw,['movingDuration','movingTime'],172800),
    elapsedSeconds:metric(raw,['elapsedDuration','elapsedTime'],172800),
    distanceKm:(v=>v===undefined?undefined:Math.round(v)/1000)(metric(raw,['distance'],500000)),
    elevationM:metric(raw,['elevationGain','totalAscent'],25000),
    avgHrBpm:metric(raw,['averageHR','averageHeartRate'],260),
    maxHrBpm:metric(raw,['maxHR','maxHeartRate'],260),
    avgPowerW:metric(raw,['averagePower','avgPower'],3000),
    maxPowerW:metric(raw,['maxPower'],4000),
    normalizedPowerW:metric(raw,['normPower','normalizedPower'],3000),
    avgCadence:metric(raw,['averageBikingCadence','averageRunningCadence','averageCadence'],250),
    avgSpeedKmh:(v=>v===undefined?undefined:Math.round(v*360)/100)(metric(raw,['averageSpeed'],60)),
    maxSpeedKmh:(v=>v===undefined?undefined:Math.round(v*360)/100)(metric(raw,['maxSpeed'],100)),
    calories:metric(raw,['calories'],20000),
  }
  for (const [key,value] of Object.entries(numeric)) if (value!==undefined) normalized[key]=value
  return normalized
}
function cors(origin, env) {
  const allowed = String(env.TEMPO_ALLOWED_ORIGIN || 'https://212felix.github.io')
  return origin === allowed ? {'Access-Control-Allow-Origin':allowed,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'} : {}
}
function json(data, status=200, headers={}) {return new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})}
async function secureEqual(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length<24 || b.length<24) return false
  const enc = new TextEncoder()
  const [x,y] = await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))])
  return [...new Uint8Array(x)].every((byte,index)=>byte===new Uint8Array(y)[index])
}
// Cloudflare Workers support manual/follow redirect modes; we explicitly reject unexpected redirects.
// Never follow an unexpected Garmin redirect with an Authorization header.
function rejectGarminRedirect(response) {
  if (response.status >= 300 && response.status < 400) {
    throw new Error('Garmin hat eine unerwartete Weiterleitung gesendet. Die Anfrage wurde aus Sicherheitsgründen abgebrochen.')
  }
  return response
}
async function garminGet(path, token) {
  const response = rejectGarminRedirect(await fetch(GARMIN_BASE+path,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual'}))
  if (!response.ok) throw new Error(`Garmin antwortet mit HTTP ${response.status}`)
  return response.json()
}
async function fetchToken(env) {
  if (!env.GARMIN_PERSONAL_API_KEY) throw new Error('Garmin-Key ist noch nicht als Worker-Secret eingerichtet.')
  // Garmin's official Personal API returns a JWT as plain text, not a JSON object.
  // Match Garmin's reference client: Accept */* on the token endpoint.
  const response = rejectGarminRedirect(await fetch(GARMIN_BASE + TOKEN_PATH, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${env.GARMIN_PERSONAL_API_KEY}`,
      Accept: '*/*',
    },
    redirect: 'manual',
  }))
  if (!response.ok) throw new Error(`Garmin-Authentifizierung fehlgeschlagen (HTTP ${response.status}).`)
  const token = (await response.text()).trim()
  // The official Personal API returns a three-part JWT, rather than {access_token: ...}.
  // Never include the response or the API key in logs or user-facing errors.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('Garmin hat keinen gültigen Zugangstoken geliefert.')
  }
  return token
}
async function sync(env) {
  if (!env.DB) throw new Error('Private D1-Datenbank ist noch nicht verbunden.')
  const token=await fetchToken(env)
  const end=new Date().toISOString().slice(0,10)
  const from=new Date(Date.now()-45*DAY).toISOString().slice(0,10)
  let seen=0,upserts=0,scanned=0,detailsLeft=8
  const known=await env.DB.prepare('SELECT id FROM activities ORDER BY created_at DESC LIMIT 10000').all()
  const knownIds=new Set(known.results.map(row=>String(row.id)))
  const inserts=[]
  for(let offset=0;offset<100;offset+=MAX){
    const path=`/activitylist-service/activities/search/activities?start=${offset}&limit=${MAX}&startDate=${from}&endDate=${end}`
    const payload=await garminGet(path,token)
    const list=Array.isArray(payload)?payload:Array.isArray(payload?.activities)?payload.activities:[]
    if(!Array.isArray(list))throw new Error('Unerwartete Antwort beim Garmin-Abruf.')
    for(const summary of list){
      scanned++
      const basic=normalizeActivity(summary)
      if(!basic)continue
      seen++
      if(knownIds.has(basic.garminActivityId))continue
      knownIds.add(basic.garminActivityId)
      // Fetch details for any new supported activity; no GPS/track data is retained.
      let details=basic
      try {if(detailsLeft-->0){const more=await garminGet(`/activity-service/activity/${basic.garminActivityId}`,token)
        details={...basic,...(normalizeActivity({...summary,...(more?.summaryDTO||more?.activity||more),activityId:basic.garminActivityId})||{})}}
      } catch { /* summary remains usable; the next sync does not fabricate values */ }
      inserts.push(env.DB.prepare('INSERT OR IGNORE INTO activities (id, started_at, payload, created_at) VALUES (?,?,?,?)')
        .bind(basic.garminActivityId,basic.startedAt,JSON.stringify(details),new Date().toISOString()))
      upserts++
    }
    if(list.length<MAX)break
  }
  if(inserts.length)await env.DB.batch(inserts)
  const completedAt=new Date().toISOString()
  await env.DB.prepare('INSERT INTO sync_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('last_success',completedAt).run()
  return {scanned,supported:seen,newStored:upserts,lastSuccess:completedAt}
}

/** Optional Garmin Personal API wellness. Persist only bounded daily summaries in private sync_meta. */
const wellnessNum=(x,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max?x:undefined
function firstNumber(source,fields,max){
 if(!source||typeof source!=='object')return undefined
 for(const field of fields){const n=wellnessNum(source[field],max);if(n!==undefined)return n}
 return undefined
}
export function normalizeWellness(date,sleep,hrv,battery){
 const sd=sleep?.dailySleepDTO??sleep?.sleepData??sleep
 const hd=hrv?.hrvSummary??hrv?.summary??hrv
 const sleepSeconds=firstNumber(sd,['sleepTimeSeconds','totalSleepSeconds','sleepDurationInSeconds'],86400)
 const sleepHours=sleepSeconds!==undefined?Math.round(sleepSeconds/360)/10:undefined
 const hrvMs=firstNumber(hd,['lastNightAvg','lastNightAverage'],250)
 // Garmin's Body Battery response varies; only explicitly measured numeric readings are accepted.
 const reports=Array.isArray(battery)?battery:Array.isArray(battery?.reports)?battery.reports:[]
 const latest=reports.at(-1)??battery
 let bodyBattery=firstNumber(latest,['bodyBattery','endValue','currentValue'],100)
 const values=latest?.bodyBatteryValues??latest?.bodyBatteryValueDescriptorDTOList
 if(bodyBattery===undefined&&Array.isArray(values)){
  for(const v of [...values].reverse()){
   const n=Array.isArray(v)?wellnessNum(v[1],100):firstNumber(v,['bodyBattery','value','bodyBatteryLevel'],100)
   if(n!==undefined){bodyBattery=n;break}
  }
 }
 const result={date,fetchedAt:new Date().toISOString()}
 if(sleepHours!==undefined)result.sleepHours=sleepHours
 if(hrvMs!==undefined)result.hrvMs=hrvMs
 if(bodyBattery!==undefined)result.bodyBattery=bodyBattery
 result.available=['sleepHours','hrvMs','bodyBattery'].filter(k=>result[k]!==undefined)
 return result
}
async function fetchWellness(env,date){
 const token=await fetchToken(env)
 const end=date
 const paths=[`/sleep-service/sleep/dailySleep?date=${date}`,`/hrv-service/hrv/${date}`,`/wellness-service/wellness/bodyBattery/reports/daily?startDate=${date}&endDate=${end}`]
 const [sleep,hrv,battery]=await Promise.all(paths.map(path=>garminGet(path,token).catch(()=>null)))
 const result=normalizeWellness(date,sleep,hrv,battery)
 await env.DB.prepare('INSERT INTO sync_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('wellness:'+date,JSON.stringify(result)).run()
 return result
}
async function cachedWellness(env,date){
 const row=await env.DB.prepare('SELECT value FROM sync_meta WHERE key=?').bind('wellness:'+date).first()
 if(row?.value){try{const cached=JSON.parse(row.value);if(Date.now()-Date.parse(cached.fetchedAt)<6*3600_000)return cached}catch{/* refetch */}}
 return fetchWellness(env,date)
}

const api = {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||''
    const h=cors(origin,env)
    if (request.method==='OPTIONS')return origin===env.TEMPO_ALLOWED_ORIGIN?new Response(null,{status:204,headers:h}):json({error:'Origin nicht freigeschaltet.'},403)
    if(!request.url.startsWith('https://'))return json({error:'HTTPS erforderlich.'},400,h)
    if(origin && !h['Access-Control-Allow-Origin'])return json({error:'Origin nicht freigeschaltet.'},403)
    const parsed=new URL(request.url)
    const path=parsed.pathname
    if(!['/v1/status','/v1/activities','/v1/sync','/v1/wellness'].includes(path))return json({error:'Nicht gefunden.'},404,h)
    if(!env.TEMPO_BRIDGE_TOKEN || !await secureEqual(request.headers.get('Authorization')?.replace(/^Bearer /,'')||'',env.TEMPO_BRIDGE_TOKEN))return json({error:'Zugangscode ungültig.'},401,h)
    if(!env.DB)return json({error:'D1-Datenbank fehlt.'},503,h)
    try{
      if (path==='/v1/status' && request.method==='GET'){
        const result=await env.DB.prepare('SELECT value FROM sync_meta WHERE key=?').bind('last_success').first()
        const count=await env.DB.prepare('SELECT COUNT(*) as total FROM activities').first()
        return json({connected:!!env.GARMIN_PERSONAL_API_KEY,lastSuccess:result?.value||null,stored:Number(count?.total)||0},200,h)
      }
      if(path==='/v1/activities' && request.method==='GET'){
        const data=await env.DB.prepare('SELECT payload FROM activities ORDER BY started_at DESC LIMIT 250').all()
        return json({activities:data.results.map(r=>JSON.parse(r.payload))},200,h)
      }
      if(path==='/v1/wellness'&&request.method==='GET'){
        const date=parsed.searchParams.get('date')||new Date().toISOString().slice(0,10)
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z')))return json({error:'Ungültiges Datum.'},400,h)
        if(Math.abs(Date.now()-Date.parse(date+'T12:00:00Z'))>32*DAY)return json({error:'Erholungsdaten nur für die letzten 31 Tage verfügbar.'},400,h)
        return json(await cachedWellness(env,date),200,h)
      }
      if(path==='/v1/sync'&&request.method==='POST'){
        return json({ok:true,...await sync(env)},200,h)
      }
      return json({error:'Methode nicht erlaubt.'},405,h)
    }catch(err){ // Avoid logging API responses, tokens or activity data.
      return json({error:err instanceof Error ? err.message.slice(0,140):'Synchronisierung fehlgeschlagen.'},502,h)
    }
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(sync(env).catch(()=>{/* no sensitive logging */}))},
}
export default api
