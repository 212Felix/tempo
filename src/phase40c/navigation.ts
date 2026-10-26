/** Main-tab gesture recognition. Horizontal interactions and iOS edge-back stay native. */
export function swipeDelta(dx:number,dy:number,startX:number,screenWidth:number): -1|0|1 {
 if(startX<28||startX>screenWidth-28)return 0
 if(Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.6)return 0
 return dx<0?1:-1
}
export function gestureBlocked(target:EventTarget|null):boolean {
 return target instanceof Element && !!target.closest('input,select,textarea,button,a,summary,[role="slider"],[contenteditable="true"],[data-tempo-no-swipe],.tempo40c-interval-scroll')
}
