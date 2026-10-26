/** German presentation format only. Keep ISO values unchanged in storage and inputs. */
export function germanDate(iso:string):string {
 const match=/^(\d{4})-(\d{2})-(\d{2})(?=$|T|\s)/.exec(iso)
 if(!match)return iso
 const [,year,month,day]=match
 const parsed=new Date(`${year}-${month}-${day}T12:00:00Z`)
 if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==`${year}-${month}-${day}`)return iso
 return `${day}.${month}.${year}`
}
export function germanDateInLabel(text:string):string {
 return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g,match=>germanDate(match))
}
