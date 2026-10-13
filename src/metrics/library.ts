import type {TempoRecord} from '../db/types'

export const METRIC_OPTIONS={
  ftp:{sport:'cycling',name:'FTP',unit:'W',max:1500,kind:'number'},
  vo2:{sport:'cycling',name:'Garmin Rad-VO₂max',unit:'ml/kg/min',max:110,kind:'number'},
  p5:{sport:'cycling',name:'Bestleistung 5 Minuten',unit:'W',max:2000,kind:'number'},
  p20:{sport:'cycling',name:'Bestleistung 20 Minuten',unit:'W',max:1500,kind:'number'},
  run5k:{sport:'running',name:'5-km-Test',unit:'Zeit',max:36000,kind:'time'},
  cooper:{sport:'running',name:'Cooper-Test (tatsächlich gelaufen)',unit:'m',max:6000,kind:'number'},
  squat:{sport:'strength',name:'Kniebeuge',unit:'kg',max:650,kind:'number'},
  deadlift:{sport:'strength',name:'Kreuzheben / Trap Bar',unit:'kg',max:650,kind:'number'},
  pullup:{sport:'strength',name:'Klimmzüge sauber',unit:'Wdh.',max:100,kind:'number'},
} as const
export type MetricCode=keyof typeof METRIC_OPTIONS
export type MetricSport='cycling'|'running'|'strength'
export type PerformanceEntry=TempoRecord & {
  kind:'tempo-measured-performance';profileId:string;date:string;code:MetricCode;value:number;notes?:string
}
export function validPerformanceValue(code:MetricCode,value:number):boolean {
  const cfg=METRIC_OPTIONS[code]
  return Number.isFinite(value)&&value>0&&value<=cfg.max
}
export function latestPerMetric(entries:PerformanceEntry[]):Partial<Record<MetricCode,PerformanceEntry>> {
  const latest:Partial<Record<MetricCode,PerformanceEntry>>={}
  for(const r of [...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt))){
    if(!latest[r.code])latest[r.code]=r
  }
  return latest
}
