/** Phase 32: backward-compatible optional additions to phase30 FuelProduct. */
import type {FuelProduct} from '../phase30/fueling'
export type FuelKind=FuelProduct['kind']
export type FuelUnit='g'|'ml'|'piece'
export type TrafficLight='green'|'yellow'|'red'
export interface EnrichedProduct extends FuelProduct {
 profileId?:string;createdAt?:string;updatedAt?:string;
 brand?:string;servingUnit?:FuelUnit;packageQuantity?:number;packageUnit?:FuelUnit;packagePriceEuro?:number;
 glucoseFructoseRatio?:string;proteinGrams?:number;fatGrams?:number;caffeineMg?:number;
 sodiumSource?:'label'|'salt-converted'|'unknown';notes?:string;
 manualTolerance?:TrafficLight|'unset';manuallyBlocked?:boolean;
}
export interface FuelExperience {id:string;profileId?:string;date:string;sessionId?:string;createdAt:string;updatedAt:string;
 productIds:string[];productServings?:Record<string,number>;tolerance:TrafficLight;nextMorning?:TrafficLight;
 additionalCarbsGrams:number;actualTotalCarbsGrams?:number;actualCarbsHour?:number;actualFluidHour?:number;notes:string;
}
export const isProduct=(x:{id:string})=>x.id.startsWith('fuel-product:')
export const isExperience=(x:{id:string})=>x.id.startsWith('fuel-experience:')
export const isValidDay=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)
export function followingDay(date:string):string{
 if(!isValidDay(date))return ''
 const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)
}
export function piecePrice(p:EnrichedProduct):number|null{
 const qty=p.packageQuantity??0, price=p.packagePriceEuro
 if(!Number.isFinite(qty)||qty<=0||price===undefined||!Number.isFinite(price)||price<0)return null
 if(p.packageUnit==='piece')return price/qty
 if(p.servingUnit==='piece'||p.packageUnit&&p.servingUnit&&p.packageUnit!==p.servingUnit)return null
 if(p.servingGrams<=0)return null
 return price*p.servingGrams/qty
}
export function suspicionCount(productId:string, experiences:FuelExperience[]):number{
 // One negative observation per training, never count two check-ins on the same ride twice.
 return new Set(experiences.filter(x=>x.productIds.includes(productId)&&(x.tolerance==='red'||x.nextMorning==='red')).map(x=>x.id)).size
}
export function statusForProduct(product:EnrichedProduct, experiences:FuelExperience[]):{tone:TrafficLight|'unrated';blocked:boolean;reason:string}{
 if(product.manuallyBlocked||product.manualTolerance==='red')return {tone:'red',blocked:true,reason:'In der Bibliothek manuell gesperrt'}
 const count=suspicionCount(product.id,experiences)
 if(count>=2)return {tone:'red',blocked:true,reason:`${count} getrennte Unverträglichkeitsmeldungen`}
 if(count===1)return {tone:'yellow',blocked:false,reason:'Einmal auffällig · zunächst beobachten'}
 if(product.manualTolerance==='yellow')return {tone:'yellow',blocked:false,reason:'Manuell als okay bewertet'}
 if(product.manualTolerance==='green')return {tone:'green',blocked:false,reason:'Manuell sehr gut verträglich'}
 return {tone:'unrated',blocked:false,reason:'Verträglichkeit noch nicht bewertet'}
}
export function productUsable(product:EnrichedProduct,experiences:FuelExperience[]):boolean{return !statusForProduct(product,experiences).blocked}
export const saltGramsToSodiumMg=(g:number)=>Math.round(g*400)
export function validateEnrichedProduct(product:EnrichedProduct):string|null{
 if(!product.name.trim()||product.name.length>80)return 'Bitte einen Produktnamen (maximal 80 Zeichen) eingeben.'
 if(!Number.isFinite(product.servingGrams)||product.servingGrams<=0||product.servingGrams>2000)return 'Portionsgröße überprüfen.'
 if(!Number.isFinite(product.carbsGrams)||product.carbsGrams<0||product.carbsGrams>2000)return 'Kohlenhydrate überprüfen.'
 if(product.servingUnit!=='ml'&&product.servingUnit!=='piece'&&product.carbsGrams>product.servingGrams+5)return 'Kohlenhydrate dürfen das Portionsgewicht nicht übersteigen.'
 for(const [key,value] of [['Natrium',product.sodiumMg],['Eiweiß',product.proteinGrams??0],['Fett',product.fatGrams??0],['Koffein',product.caffeineMg??0],['Verpackungsmenge',product.packageQuantity??0],['Verpackungspreis',product.packagePriceEuro??0]] as [string,number][])if(!Number.isFinite(value)||value<0||value>100000)return `${key} überprüfen.`
 return null
}
/** Parse only explicitly written relations; ingredient order doesn't establish a ratio. */
export function ratioFromLabel(text:string):string{
 const normalized=text.replaceAll(',','.')
 const hit=normalized.match(/(?:glucose|glukose|maltodextrin)[\s\S]{0,85}?(?:fructose|fruktose)[^\d]{0,30}(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/i)
 || normalized.match(/(?:glucose|glukose)[-/ ](?:fructose|fruktose)[^\d]{0,25}(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/i)
 return hit?`${hit[1]}:${hit[2]}`:''
}
/** Best effort OCR extraction; all fields require human confirmation. */
export function nutritionFromOcr(text:string):Partial<EnrichedProduct>{
 const raw=text.replaceAll(',','.');const val=(pattern:RegExp)=>{const match=raw.match(pattern);return match?Number(match[1]):undefined}
 const carbsGrams=val(/(?:kohlenhydrate|carbohydrates|carbs)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b/i)
 const proteinGrams=val(/(?:eiwei[ßs]|protein)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b/i)
 const fatGrams=val(/(?:fett|fat)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b/i)
 const sodiumMg=val(/(?:natrium|sodium)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg\b/i)
 const saltGrams=val(/(?:salz|salt)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b/i)
 const caffeineMg=val(/(?:koffein|caffeine)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg\b/i)
 return {...(carbsGrams!==undefined&&{carbsGrams}),...(proteinGrams!==undefined&&{proteinGrams}),...(fatGrams!==undefined&&{fatGrams}),...(sodiumMg!==undefined?{sodiumMg,sodiumSource:'label' as const}:saltGrams!==undefined?{sodiumMg:saltGramsToSodiumMg(saltGrams),sodiumSource:'salt-converted' as const}:{}),...(caffeineMg!==undefined&&{caffeineMg}),...(ratioFromLabel(raw)&&{glucoseFructoseRatio:ratioFromLabel(raw)})}
}
export const freshProduct=():EnrichedProduct=>({id:'',name:'',kind:'gel',servingGrams:40,servingUnit:'g',carbsGrams:30,sodiumMg:0,waterMl:0,manualTolerance:'unset',manuallyBlocked:false,packageUnit:'piece'})

/** Conservative trend: two corroborated, successful uses before raising the next target.
 * Never override an athlete-entered target, nor the 0 g/h choice for short easy workouts. */
export function adaptiveCarbTarget(defaultGoal:number,history:FuelExperience[],durationMin:number):{goal:number;reason:string}{
 if(durationMin<75||defaultGoal===0)return {goal:defaultGoal,reason:'Kurze Belastung: keine automatische Steigerung'}
 const confirmed=history.filter(e=>e.actualCarbsHour!==undefined&&e.tolerance==='green'&&e.nextMorning==='green').sort((a,b)=>b.date.localeCompare(a.date))
 if(confirmed.length<2)return {goal:defaultGoal,reason:'Noch mindestens zwei vollständig gut verträgliche Trainings nötig'}
 const recent=confirmed.slice(0,3).map(e=>e.actualCarbsHour??0)
 const safe=Math.min(...recent)
 const goal=Math.min(90,Math.max(defaultGoal,Math.min(Math.round(safe/5)*5+5,defaultGoal+5)))
 return {goal,reason:goal>defaultGoal?'Aus wiederholt gut verträglicher KH-Zufuhr: höchstens +5 g/h für den nächsten Versuch':'Noch keine zusätzliche Steigerung sinnvoll'}
}
