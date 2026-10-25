/** Pure, privacy-preserving diagnostics for ambiguous Garmin/FIT assignments. */
export type AssignmentRow={activity:{garminActivityId:string;title:string;date:string};status:string}
export type AssignmentConflict={targetId:string;activityIds:string[];activityNames:string[]}
export function findAssignmentConflicts(rows:AssignmentRow[],choices:Record<string,string>):AssignmentConflict[]{
 const byTarget=new Map<string,AssignmentRow[]>()
 for(const row of rows){
  if(row.status==='already')continue
  const target=choices[row.activity.garminActivityId]
  if(!target||target==='new'||target==='skip')continue
  byTarget.set(target,[...(byTarget.get(target)??[]),row])
 }
 return [...byTarget].filter(([,items])=>items.length>1).map(([targetId,items])=>({
  targetId,activityIds:items.map(item=>item.activity.garminActivityId),
  activityNames:items.map(item=>`${item.activity.title} (${item.activity.date})`),
 }))
}
