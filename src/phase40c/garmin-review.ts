/** Never store the Worker password or Garmin API key alongside review decisions. */
export function unresolvedIds(rows:{activity:{garminActivityId:string};status:string}[],choices:Record<string,string>){
 return rows.filter(x=>x.status==='review'&&!choices[x.activity.garminActivityId]).map(x=>x.activity.garminActivityId)
}
export function selectedRows<T extends {activity:{garminActivityId:string};status:string}>(rows:T[],choices:Record<string,string>):T[]{
 return rows.filter(x=>x.status==='review'&&!!choices[x.activity.garminActivityId])
}
export function pendingRows<T extends {activity:{garminActivityId:string};status:string}>(rows:T[],skipped:string[]):T[]{
 const ignore=new Set(skipped)
 return rows.filter(x=>x.status!=='already'&&!ignore.has(x.activity.garminActivityId))
}
