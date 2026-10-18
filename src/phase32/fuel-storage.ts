import {listRecords,saveRecord,getRecord} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {PROFILE_ID} from '../planning/engine'
import {isExperience,isProduct,productUsable,type EnrichedProduct,type FuelExperience} from './fuel-model'
export async function loadFuelProducts():Promise<EnrichedProduct[]>{const rows=await listRecords<EnrichedProduct&TempoRecord>('settings');return rows.filter(x=>x.profileId===PROFILE_ID&&isProduct(x))}
export async function loadExperiences():Promise<FuelExperience[]>{const rows=await listRecords<FuelExperience&TempoRecord>('fuelingFollowups');return rows.filter(x=>x.profileId===PROFILE_ID&&isExperience(x))}
export async function loadUsableProducts():Promise<EnrichedProduct[]>{const [p,e]=await Promise.all([loadFuelProducts(),loadExperiences()]);return p.filter(x=>productUsable(x,e))}
export function experienceId(date:string,sessionId?:string){return `fuel-experience:${PROFILE_ID}:${sessionId||date}`}
export async function saveExperience(input:FuelExperience):Promise<void>{
 const previous=await getRecord<FuelExperience&TempoRecord>('fuelingFollowups',input.id)
 await saveRecord('fuelingFollowups',{...previous,...input,profileId:PROFILE_ID,createdAt:previous?.createdAt??'',updatedAt:''})
 window.dispatchEvent(new Event('tempo:fuel-change'))
}
export async function saveProductSettings(product:EnrichedProduct):Promise<void>{
 const previous=product.id?await getRecord<TempoRecord>('settings',product.id):undefined
 await saveRecord('settings',{...previous,...product,profileId:PROFILE_ID,createdAt:previous?.createdAt??'',updatedAt:''} as EnrichedProduct&TempoRecord)
 window.dispatchEvent(new Event('tempo:fuel-change'))
}
