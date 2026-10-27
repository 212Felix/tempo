/** Inspect Garmin's ZIP export without third-party decompressors. Unsupported browsers show a clear message. */
export async function fitFromZip(buffer:ArrayBuffer,filename='garmin.fit'):Promise<File>{
 if(buffer.byteLength<22||buffer.byteLength>75_000_000)throw Error('FIT-ZIP ist leer oder zu groß.')
 const v=new DataView(buffer),bytes=new Uint8Array(buffer)
 let end=-1
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(v.getUint32(i,true)===0x06054b50){end=i;break}}
 if(end<0)throw Error('Ungültiges ZIP-Verzeichnis.')
 const entries=v.getUint16(end+10,true),dirOffset=v.getUint32(end+16,true)
 if(entries<1||entries>64||dirOffset>=bytes.length)throw Error('ZIP-Verzeichnis nicht unterstützt.')
 const decoder=new TextDecoder(),max=75_000_000
 let offset=dirOffset
 for(let i=0;i<entries;i++){
  if(offset+46>bytes.length||v.getUint32(offset,true)!==0x02014b50)throw Error('ZIP-Einträge beschädigt.')
  const compression=v.getUint16(offset+10,true),compressed=v.getUint32(offset+20,true),rawLength=v.getUint32(offset+24,true)
  const nameLength=v.getUint16(offset+28,true),extraLength=v.getUint16(offset+30,true),commentLength=v.getUint16(offset+32,true),localOffset=v.getUint32(offset+42,true)
  const endName=offset+46+nameLength
  if(endName>bytes.length)throw Error('ZIP-Name beschädigt.')
  const name=decoder.decode(bytes.slice(offset+46,endName))
  offset=endName+extraLength+commentLength
  if(!/\.fit$/i.test(name)||name.includes('..')||name.startsWith('/'))continue
  if(rawLength<18||rawLength>max||compressed>max||localOffset+30>bytes.length||v.getUint32(localOffset,true)!==0x04034b50)throw Error('FIT-ZIP überschreitet Sicherheitsgrenzen.')
  const start=localOffset+30+v.getUint16(localOffset+26,true)+v.getUint16(localOffset+28,true)
  if(start+compressed>bytes.length)throw Error('FIT-Daten beschädigt.')
  let output:Uint8Array
  if(compression===0)output=bytes.slice(start,start+compressed)
  else if(compression===8){
   if(typeof DecompressionStream==='undefined')throw Error('Automatisches ZIP-Entpacken auf diesem Gerät nicht unterstützt. FIT kann weiterhin manuell importiert werden.')
   try{
    const decompressor=new DecompressionStream('deflate-raw')
    const response=new Response(new Blob([bytes.slice(start,start+compressed)]).stream().pipeThrough(decompressor))
    const result=await response.arrayBuffer()
    if(result.byteLength!==rawLength||result.byteLength>max)throw Error('Entpackte FIT-Größe ungültig.')
    output=new Uint8Array(result)
   }catch(e){throw Error(e instanceof Error?`Automatisches ZIP-Entpacken: ${e.message}`:'ZIP-Entpacken nicht unterstützt.')}
  }else throw Error('Unbekannte ZIP-Kompression.')
  if(output.length!==rawLength)throw Error('FIT-Länge stimmt nicht.')
  // BlobPart requires an owned ArrayBuffer (not a Uint8Array<ArrayBufferLike>).
  const fileBuffer = new ArrayBuffer(output.byteLength)
  new Uint8Array(fileBuffer).set(output)
  return new File([fileBuffer],filename,{type:'application/octet-stream'})
 }
 throw Error('Im Garmin-Archiv wurde keine FIT-Datei gefunden.')
}
