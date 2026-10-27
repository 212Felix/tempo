/** Velocity-aware gestures used only between four primary pages. */
export function gestureDirection(dx:number,dy:number,elapsedMs:number,startX:number,screenWidth:number): -1|0|1 {
 if(startX<25||startX>screenWidth-25||!Number.isFinite(dx)||!Number.isFinite(dy))return 0
 const ax=Math.abs(dx),ay=Math.abs(dy)
 if(ax<32||ax<ay*1.35)return 0
 const velocity=ax/Math.max(16,elapsedMs)
 if(ax<Math.min(100,screenWidth*.22)&&velocity<.46)return 0
 return dx<0?1:-1
}
export function dragOffset(dx:number,screenWidth:number):number{
 if(!Number.isFinite(dx)||screenWidth<=0)return 0
 const ratio=Math.min(1,Math.abs(dx)/(screenWidth*.6))
 return Math.sign(dx)*screenWidth*.22*(1-Math.pow(1-ratio,1.55))
}
