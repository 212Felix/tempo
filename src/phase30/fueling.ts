/** Transparent, conservative sport nutrition rules. Not a metabolic-model claim. */
export type Sport='cycling'|'running';
export type Intensity='easy'|'tempo'|'hard';
export type ProductType='gel'|'powder'|'bar'|'food';
export interface FuelProduct {id:string;name:string;kind:ProductType;servingGrams:number;carbsGrams:number;sodiumMg:number;waterMl:number}
export type RouteSummary={fileName:string;distanceKm:number;elevationGainM:number;points:number};
export type NutritionInput={sport:Sport;durationMin:number;intensity:Intensity;temperatureC:number;gutTraining:'start'|'building'|'trained';targetCarbsHour?:number;targetFluidsHour?:number; bottleMl:number;route?:RouteSummary;startTime?:string}
export type FuelEvent={minute:number;label:string;carbs:number;waterMl:number};
export type FuelPlan={carbsHour:number;fluidHour:number;totalCarbs:number;totalFluidMl:number;gelCount:number;powderTotalGrams:number;powderPerBottleGrams:number;powderCarbsTotal:number;bottleCount:number;events:FuelEvent[];warnings:string[];startingCarbs:number;startingFluid:number};
export const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export function recommendCarbsHour(input:NutritionInput):number{
 const h=input.durationMin/60;
 if(h<.75)return 0;
 if(h<1.25)return input.intensity==='easy'?0:20;
 if(h<2.5)return input.intensity==='easy'?30:input.intensity==='hard'?60:45;
 const cap=input.gutTraining==='start'?60:input.gutTraining==='building'?75:90;
 return Math.min(cap,input.intensity==='easy'?60:input.intensity==='tempo'?75:90);
}
export function recommendFluidHour(input:NutritionInput):number{
 const base=input.sport==='running'?500:550;
 const temp=input.temperatureC>=28?220:input.temperatureC>=23?120:input.temperatureC<=8?-130:0;
 return clamp(base+temp,350,850);
}
const round=(n:number)=>Math.round(n*10)/10;
export function calculateFuel(input:NutritionInput,gel?:FuelProduct,powder?:FuelProduct):FuelPlan {
 if(!Number.isFinite(input.durationMin)||input.durationMin<=0||input.durationMin>1800)throw Error('Dauer zwischen 1 und 1.800 Minuten eingeben.');
 if(input.bottleMl<250||input.bottleMl>1500)throw Error('Flaschengröße zwischen 250 und 1.500 ml wählen.');
 const carbsHour=clamp(input.targetCarbsHour??recommendCarbsHour(input),0,120);
 const fluidHour=clamp(input.targetFluidsHour??recommendFluidHour(input),200,1200);
 const hours=input.durationMin/60,totalCarbs=Math.round(carbsHour*hours),totalFluidMl=Math.round(fluidHour*hours/10)*10;
 const bottleCount=Math.max(1,Math.ceil(totalFluidMl/input.bottleMl));
 const gelCarbs=gel?.carbsGrams??0;
 // Gel contribution up to ~40% of target carbs; distribute over the session.
 const gelCount=gelCarbs>0&&carbsHour>0?Math.min(30,Math.floor(totalCarbs*.42/gelCarbs)):0;
 const residual=Math.max(0,totalCarbs-gelCount*gelCarbs);
 const powderRate=powder&&powder.servingGrams>0?powder.carbsGrams/powder.servingGrams:0;
 const powderTotalGrams=powderRate>0?round(residual/powderRate):0;
 const powderCarbsTotal=powderRate>0?round(powderTotalGrams*powderRate):0;
 const powderPerBottleGrams=round(powderTotalGrams/bottleCount);
 const warnings:string[]=[];
 if(input.targetCarbsHour!==undefined&&input.targetCarbsHour>recommendCarbsHour(input)+20)warnings.push('KH-Ziel über dem für diese Dauer/Verträglichkeitsstufe vorgeschlagenen Bereich: nur schrittweise steigern und im Training erproben.');
 if(carbsHour>90)warnings.push('Über 90 g KH/h ist eine fortgeschrittene Strategie; nicht ohne dokumentierte Verträglichkeit und geeignete Zuckerzusammensetzung einsetzen.');
 if(!powderRate&&residual>0)warnings.push(`${Math.round(residual)} g KH sind mit den gewählten Produkten noch nicht abgedeckt. Pulver oder weitere Nahrung ergänzen.`);
 if(powderRate&&powderCarbsTotal/bottleCount/(input.bottleMl/100)>9)warnings.push('Pulverkonzentration über 9 g KH/100 ml: Verträglichkeit prüfen und ggf. zusätzliche Wasserflasche verwenden.');
 if(input.temperatureC>=28)warnings.push('Hitze: Trinkmenge und Natrium anhand deiner Schweißrate, Wetter und verfügbaren Verpflegungsstellen prüfen. Nicht zwanghaft mehr als den Durst-/Schweißbedarf trinken.');
 if(gelCount&&gel&&gel.sodiumMg>0)warnings.push(`Natrium aus Gels: etwa ${Math.round(gelCount*gel.sodiumMg)} mg insgesamt; weitere Getränke/Produkte gesondert berücksichtigen.`);
 const events:FuelEvent[]=[];
 const steps=Math.ceil(input.durationMin/20);
 let distributedGels=0;
 for(let i=1;i<=steps;i++){
  const minute=Math.min(i*20,input.durationMin);
  const gelTarget=Math.floor(gelCount*minute/input.durationMin);
  const addGels=gelTarget-distributedGels;distributedGels=gelTarget;
  const waterMl=Math.round(fluidHour*Math.min(20,input.durationMin-(i-1)*20)/60/10)*10;
  events.push({minute,label:addGels?`${addGels} × ${gel?.name??'Gel'} + trinken`:'Getränk in kleinen Schlucken',carbs:round(addGels*gelCarbs+(powderCarbsTotal*(Math.min(20,input.durationMin-(i-1)*20)/input.durationMin))),waterMl});
 }
 return {carbsHour,fluidHour,totalCarbs,totalFluidMl,gelCount,powderTotalGrams,powderPerBottleGrams,powderCarbsTotal,bottleCount,events,warnings,startingCarbs:Math.round(Math.min(totalCarbs,carbsHour*.5)),startingFluid:Math.round(Math.min(totalFluidMl,fluidHour*.5))};
}
export function parseGpx(xml:string,fileName:string):RouteSummary{
 if(xml.length>6_000_000)throw Error('GPX-Datei ist zu groß (max. 6 MB).');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('GPX-Dateien mit DTD oder externen Entitäten werden aus Sicherheitsgründen nicht angenommen.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('Die GPX-Datei ist ungültig.');
 const nodes=[...doc.getElementsByTagName('trkpt')];
 if(nodes.length<2)nodes.push(...doc.getElementsByTagName('rtept'));
 if(nodes.length<2||nodes.length>150000)throw Error('Die GPX-Strecke benötigt 2 bis 150.000 Streckenpunkte.');
 let distanceKm=0,elevationGainM=0,prevLat=NaN,prevLon=NaN,prevElev=NaN,points=0;
 for(const node of nodes){
  if(!node.hasAttribute('lat')||!node.hasAttribute('lon'))continue;
  const lat=Number(node.getAttribute('lat')),lon=Number(node.getAttribute('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
  if(Number.isFinite(prevLat)){
   const a=(lat-prevLat)*Math.PI/180,b=(lon-prevLon)*Math.PI/180;
   const h=Math.sin(a/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(prevLat*Math.PI/180)*Math.sin(b/2)**2;
   const km=2*6371*Math.asin(Math.min(1,Math.sqrt(h)));
   // Ignore large GPS jumps; do not retain coordinates.
   if(km<1.2)distanceKm+=km;
  }
  const elevNode=node.getElementsByTagName('ele')[0];
  const elev=elevNode?Number(elevNode.textContent):NaN;
  if(Number.isFinite(elev)&&Number.isFinite(prevElev)&&elev-prevElev>=3&&elev-prevElev<150)elevationGainM+=elev-prevElev;
  if(Number.isFinite(elev))prevElev=elev;
  prevLat=lat;prevLon=lon;points++;
 }
 if(points<2||distanceKm===0)throw Error('Strecke konnte nicht ausgewertet werden.');
 return {fileName:fileName.slice(0,160),distanceKm:round(distanceKm),elevationGainM:Math.round(elevationGainM),points};
}
export const productIsValid=(p:FuelProduct)=>p.name.trim().length>0&&p.name.length<=80&&Number.isFinite(p.servingGrams)&&p.servingGrams>0&&p.servingGrams<=500&&Number.isFinite(p.carbsGrams)&&p.carbsGrams>=0&&p.carbsGrams<=p.servingGrams+5&&Number.isFinite(p.sodiumMg)&&p.sodiumMg>=0&&p.sodiumMg<=3000&&Number.isFinite(p.waterMl)&&p.waterMl>=0&&p.waterMl<=1500;
