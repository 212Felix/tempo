import {Component,type ErrorInfo,type ReactNode} from 'react'

/** Kalender-Abstuerze auf diesen Teilbereich begrenzen, ohne lokale Daten anzufassen. */
type Props={children:ReactNode;onBack:()=>void}
type State={failed:boolean}
export default class CalendarSafeguard extends Component<Props,State>{
  state:State={failed:false}
  static getDerivedStateFromError():State{return {failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){
    console.error('TEMPO: Die Kalenderansicht konnte nicht dargestellt werden.',error,info.componentStack)
  }
  render(){
    if(this.state.failed)return <section className="panel" role="alert" aria-live="assertive">
      <h2>Kalender konnte nicht geladen werden</h2>
      <p>Beim Anzeigen des Kalenders ist ein Fehler aufgetreten. Deine lokal gespeicherten Trainings- und Dienstdaten wurden nicht verändert.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <button type="button" className="secondary-button" onClick={()=>this.setState({failed:false})}>Kalender erneut öffnen</button>
        <button type="button" className="secondary-button" onClick={this.props.onBack}>Zur Startseite</button>
      </div>
    </section>
    return this.props.children
  }
}
