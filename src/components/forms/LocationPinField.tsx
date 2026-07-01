import { useState } from 'react'
import { MapPin, Navigation, ExternalLink, Loader } from 'lucide-react'
import type { LocationPin } from '../../types'

interface Props {
  value: LocationPin
  onChange: (pin: LocationPin) => void
  error?: string
}

export function LocationPinField({ value, onChange, error }: Props) {
  const [loading,    setLoading]    = useState(false)
  const [geoError,   setGeoError]   = useState('')
  const [showManual, setShowManual] = useState(false)
  const [geocoding,  setGeocoding]  = useState(false)

  async function reverseGeocode(lat: string, lng: string): Promise<string> {
    try {
      setGeocoding(true)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
        { headers: { 'User-Agent': 'FencraftOps/1.0' } },
      )
      const data = await res.json()
      return (data.display_name as string) ?? ''
    } catch {
      return ''
    } finally {
      setGeocoding(false)
    }
  }

  function pinCurrent() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported.')
      setShowManual(true)
      return
    }
    setLoading(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat  = pos.coords.latitude.toFixed(6)
        const lng  = pos.coords.longitude.toFixed(6)
        const link = `https://maps.google.com/?q=${lat},${lng}`
        // Set pin immediately, then fetch address
        onChange({ latitude: lat, longitude: lng, mapLink: link, label: '' })
        setLoading(false)
        setShowManual(false)
        const address = await reverseGeocode(lat, lng)
        onChange({ latitude: lat, longitude: lng, mapLink: link, label: address })
      },
      () => {
        setGeoError('Location access denied.')
        setShowManual(true)
        setLoading(false)
      },
      { timeout: 10000, maximumAge: 0 },
    )
  }

  const pinned  = value.latitude || value.mapLink.trim()
  const openUrl = value.mapLink.trim() || (value.latitude ? `https://maps.google.com/?q=${value.latitude},${value.longitude}` : '')

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
        Google Map Location Pin <span className="text-red-500">*</span>
      </label>

      {!pinned && (
        <button
          type="button"
          onClick={pinCurrent}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-colors
            ${error ? 'border-red-300 bg-red-50 text-red-600' : 'border-teal-300 bg-teal-50 text-teal-700'}
            text-sm font-semibold active:opacity-70 disabled:opacity-50`}
        >
          {loading
            ? <><Loader size={15} className="animate-spin" /> Detecting location…</>
            : <><Navigation size={15} /> Pin Current Location</>
          }
        </button>
      )}

      {pinned && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-teal-500 flex-shrink-0" />
            <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">Location Pinned Successfully</p>
          </div>
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-teal-700 underline">
              <ExternalLink size={13} />
              Open in Google Maps
            </a>
          )}
          <button type="button" onClick={() => { onChange({ latitude: '', longitude: '', mapLink: '', label: '' }); setGeoError('') }}
            className="text-[11px] text-slate-400 underline">
            Clear &amp; re-pin
          </button>
        </div>
      )}

      {/* Address box — shown after pin */}
      {pinned && (
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
            Address {geocoding && <span className="text-teal-500">· Fetching…</span>}
          </label>
          <textarea
            rows={2}
            value={value.label ?? ''}
            onChange={e => onChange({ ...value, label: e.target.value })}
            placeholder="Address auto-filled from location pin — you can edit"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400 resize-none"
          />
        </div>
      )}

      {geoError && (
        <p className="text-[11px] text-amber-600 font-medium">{geoError}</p>
      )}

      {(showManual || geoError) && !pinned && (
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">
            Or paste Google Maps link
          </label>
          <input
            type="url"
            inputMode="url"
            value={value.mapLink}
            onChange={e => onChange({ ...value, mapLink: e.target.value })}
            placeholder="https://maps.google.com/?q=..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
      )}

      {error && !pinned && (
        <p className="text-[11px] text-red-500 font-semibold">{error}</p>
      )}
    </div>
  )
}
