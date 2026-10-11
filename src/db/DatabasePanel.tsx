import { useEffect, useState, type ChangeEvent } from 'react'
import { exportTempoBackup, getRecord, getStoreCounts, importTempoBackup, saveRecord } from './storage'
import { STORE_NAMES, type ProfileRecord, type StoreName } from './types'
import './database-panel.css'
import HelpDisclosure from '../ui/HelpDisclosure'

const PROFILE_ID = 'local-primary-profile'

function parseOptionalNumber(value: string, label: string, max: number): number | undefined {
  const normalized = value.trim().replace(',', '.')
  if (normalized === '') return undefined
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) throw new Error(`${label}: bitte eine gültige positive Zahl eingeben.`)
  return parsed
}

export default function DatabasePanel() {
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('')
  const [ftp, setFtp] = useState('')
  const [maxHr, setMaxHr] = useState('')
  const [commuteKm, setCommuteKm] = useState('')
  const [counts, setCounts] = useState<Record<StoreName, number> | null>(null)
  const [createdAt, setCreatedAt] = useState('')
  const [notice, setNotice] = useState('Datenbank wird geöffnet …')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [storedProfile, nextCounts] = await Promise.all([
      getRecord<ProfileRecord>('profiles', PROFILE_ID), getStoreCounts(),
    ])
    setCounts(nextCounts)
    setName(storedProfile?.displayName ?? '')
    setWeight(storedProfile?.weightKg == null ? '' : String(storedProfile.weightKg))
    setFtp(storedProfile?.ftpWatts == null ? '' : String(storedProfile.ftpWatts))
    setMaxHr(storedProfile?.maxHeartRateBpm == null ? '' : String(storedProfile.maxHeartRateBpm))
    setCommuteKm(storedProfile?.commuteOneWayKm == null ? '' : String(storedProfile.commuteOneWayKm))
    setCreatedAt(storedProfile?.createdAt ?? '')
    setNotice(storedProfile ? 'Persönliches Profil lokal geladen.' : 'Datenbank bereit. Noch kein persönliches Profil angelegt.')
  }

  useEffect(() => {
    let mounted = true
    void Promise.all([getRecord<ProfileRecord>('profiles', PROFILE_ID), getStoreCounts()])
      .then(([profile, totals]) => {
        if (!mounted) return
        setCounts(totals)
        setName(profile?.displayName ?? '')
        setWeight(profile?.weightKg == null ? '' : String(profile.weightKg))
        setFtp(profile?.ftpWatts == null ? '' : String(profile.ftpWatts))
        setMaxHr(profile?.maxHeartRateBpm == null ? '' : String(profile.maxHeartRateBpm))
        setCommuteKm(profile?.commuteOneWayKm == null ? '' : String(profile.commuteOneWayKm))
        setCreatedAt(profile?.createdAt ?? '')
        setNotice(profile ? 'Persönliches Profil lokal geladen.' : 'Datenbank bereit. Noch kein persönliches Profil angelegt.')
      })
      .catch(err => { if (mounted) setNotice(`Datenbankfehler: ${String(err)}`) })
    return () => { mounted = false }
  }, [])

  async function saveProfile() {
    setBusy(true)
    try {
      const weightKg = parseOptionalNumber(weight, 'Gewicht', 500)
      const ftpWatts = parseOptionalNumber(ftp, 'FTP', 2000)
      const maxHeartRateBpm = parseOptionalNumber(maxHr, 'Maximale Herzfrequenz', 250)
      const commuteOneWayKm = parseOptionalNumber(commuteKm, 'Arbeitsweg je Richtung', 300)
      const record: ProfileRecord = {
        id: PROFILE_ID,
        createdAt,
        updatedAt: '',
        displayName: name.trim(),
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(ftpWatts !== undefined ? { ftpWatts } : {}),
        ...(maxHeartRateBpm !== undefined ? { maxHeartRateBpm } : {}),
        ...(commuteOneWayKm !== undefined ? { commuteOneWayKm } : {}),
      }
      await saveRecord('profiles', record)
      await refresh()
      setNotice('Profil gespeichert – ausschließlich im Browser dieses Geräts.')
    } catch (err) {
      setNotice(`Speichern nicht möglich: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setBusy(false) }
  }

  async function downloadBackup() {
    setBusy(true)
    try {
      const backup = await exportTempoBackup()
      const contents = JSON.stringify(backup, null, 2)
      const blob = new Blob([contents], { type: 'application/json' })
      const address = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = address
      a.download = `tempo-backup-${new Date().toISOString().slice(0,10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(address), 1000)
      setNotice('Backup erstellt. Bewahre diese persönliche Datei sicher auf.')
    } catch (err) {
      setNotice(`Backup fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setBusy(false) }
  }

  async function uploadBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm('Achtung: Der Import ersetzt ALLE bisher auf diesem Gerät gespeicherten TEMPO-Daten. Fortfahren?')) return
    setBusy(true)
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Datei ist größer als 20 MB.')
      const json: unknown = JSON.parse(await file.text())
      await importTempoBackup(json, 'replace')
      await refresh()
      setNotice('Backup erfolgreich importiert.')
    } catch (err) {
      setNotice(`Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setBusy(false) }
  }

  return <div className="tempo-db">
    <section className="panel tempo-db-panel">
      <div className="eyebrow">PHASE 2 · DATENBANK</div>
      <h2>Dein lokales TEMPO-Profil</h2>
      <HelpDisclosure id="profile-data"><p>Die App ist neutral. Deine Werte werden erst hier auf deinem Gerät gespeichert und nicht in den öffentlichen GitHub-Code geschrieben.</p></HelpDisclosure>
      <div className="tempo-db-fields">
        <label>Anzeigename <input type="text" maxLength={70} value={name} onChange={e => setName(e.target.value)} placeholder="Optional" autoComplete="off" /></label>
        <label>Gewicht (kg) <input type="text" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Noch nicht eingetragen" /></label>
        <label>FTP (W) <input type="text" inputMode="numeric" value={ftp} onChange={e => setFtp(e.target.value)} placeholder="Noch nicht eingetragen" /></label>
        <label>Maximale HF (bpm) <input type="text" inputMode="numeric" value={maxHr} onChange={e => setMaxHr(e.target.value)} placeholder="Noch nicht eingetragen" /></label>
        <label>Radpendeln je Richtung (km) <input type="text" inputMode="decimal" value={commuteKm} onChange={e => setCommuteKm(e.target.value)} placeholder="z. B. 48" /></label>
      </div>
      <button className="tempo-db-primary" disabled={busy} onClick={() => void saveProfile()}>Profil lokal speichern</button>
    </section>
    <section className="panel tempo-db-panel">
      <div className="eyebrow">SECOND BRAIN · BASIS</div>
      <h2>Datenbankstatus</h2>
      <HelpDisclosure id="profile-database"><p>20 vorbereitete Datenbereiche für Profil, Dienstplanung, Training, Events, Fueling und Recovery.</p></HelpDisclosure>
      <div className="tempo-db-stats"><strong>{counts ? STORE_NAMES.length : '–'}</strong><span>Datenbereiche</span><strong>{counts ? Object.values(counts).reduce((a, b) => a + b, 0) : '–'}</strong><span>Gespeicherte Einträge</span></div>
      <div className="tempo-db-message" role="status">{notice}</div>
    </section>
    <section className="panel tempo-db-panel">
      <div className="eyebrow">DATENSICHERUNG</div>
      <h2>Backup & Wiederherstellung</h2>
      <HelpDisclosure id="profile-backup"><p>Browser-Daten sind gerätegebunden und können bei Löschung der Website-Daten verloren gehen. Sichere deine Daten regelmäßig als JSON-Datei.</p></HelpDisclosure>
      <div className="tempo-db-actions">
        <button disabled={busy} onClick={() => void downloadBackup()}>Backup herunterladen (.json)</button>
        <label className={`tempo-db-import ${busy ? 'disabled' : ''}`}>Backup importieren <input type="file" accept=".json,application/json" disabled={busy} onChange={e => void uploadBackup(e)} /></label>
      </div>
      <p className="tempo-db-warning">Achtung: Import ersetzt vorhandene Daten. Die Backup-Datei kann private Informationen enthalten – niemals ins öffentliche Repository hochladen.</p>
    </section>
  </div>
}
