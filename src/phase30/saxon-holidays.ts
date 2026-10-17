/** Sachsen: landesweite Feiertage; Fronleichnam gilt nur in einzelnen Gemeinden. */
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function easter(year:number){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(year,month-1,day,12);}
const offset=(date:Date,days:number)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+days,12);
export function holidaySaxony(iso:string):string|undefined{
 const y=Number(iso.slice(0,4));if(y<2000||y>2100)return;
 const e=easter(y), entries:Record<string,string>={
  [`${y}-01-01`]:'Neujahr', [`${y}-05-01`]:'Tag der Arbeit', [`${y}-10-03`]:'Tag der Deutschen Einheit', [`${y}-10-31`]:'Reformationstag', [`${y}-12-25`]:'1. Weihnachtstag', [`${y}-12-26`]:'2. Weihnachtstag',
  [key(offset(e,-2))]:'Karfreitag',[key(offset(e,1))]:'Ostermontag',[key(offset(e,39))]:'Christi Himmelfahrt',[key(offset(e,50))]:'Pfingstmontag',
  [key(offset(e,60))]:'Fronleichnam (nur regional)',[key(offset(e,ewDay(y)))]: 'Buß- und Bettag'
 };
 return entries[iso];
}
function ewDay(year:number):number{const e=easter(year);const nov22=new Date(year,10,22,12);const wed=offset(nov22,-((nov22.getDay()+4)%7));return Math.round((wed.getTime()-e.getTime())/86400000);}
export function isWeekendOrHoliday(iso:string):boolean {const d=new Date(`${iso}T12:00:00`);return d.getDay()===0||d.getDay()===6||Boolean(holidaySaxony(iso)&&!holidaySaxony(iso)?.includes('nur regional'));}
