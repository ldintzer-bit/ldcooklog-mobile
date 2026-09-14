import { withSupabase } from 'npm:@supabase/server@^1'

const FIREBOARD_BASE = 'https://fireboard.io/api/v1'
const USER_AGENT = 'LDCookLog/1.23.5 fireboard metadata diagnostics'

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

async function fireboardFetch(path: string) {
  const token = Deno.env.get('FIREBOARD_TOKEN')
  if (!token) {
    throw new Error('FIREBOARD_TOKEN is not configured in Supabase Edge Function secrets.')
  }

  const response = await fetch(`${FIREBOARD_BASE}${path}`, {
    headers: {
      Authorization: `Token ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data && typeof data === 'object' ? JSON.stringify(data) : response.statusText
    throw new Error(`FireBoard API ${response.status}: ${detail}`)
  }
  return data
}

function chartSource(raw: any) {
  return Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.channels)
      ? raw.channels
      : Array.isArray(raw?.data)
        ? raw.data
        : []
}

function safeChartMetadata(channel: any) {
  const metadata: Record<string, unknown> = {}
  if (!channel || typeof channel !== 'object') return metadata
  for (const [key, value] of Object.entries(channel)) {
    if (key === 'x' || key === 'y') continue
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      metadata[key] = value
    }
  }
  return metadata
}

function summarizeChart(raw: any, includeSamples = false) {
  const channels = chartSource(raw).map((channel: any, index: number) => {
    const x = Array.isArray(channel?.x) ? channel.x : []
    const y = Array.isArray(channel?.y) ? channel.y : []
    const pairedCount = Math.min(x.length, y.length)
    const numeric = y.map((value: any) => Number(value)).filter((value: number) => Number.isFinite(value))
    const degreeType = channel?.degreetype ?? channel?.degree_type ?? channel?.unit ?? null
    const result: any = {
      series_index: index,
      index,
      label: channel?.label ?? channel?.title ?? channel?.name ?? `Series ${index + 1}`,
      device_uuid: channel?.device ?? channel?.device_uuid ?? channel?.UUID ?? channel?.uuid ?? null,
      degree_type: degreeType,
      degree_unit: Number(degreeType) === 1 ? 'C' : Number(degreeType) === 2 ? 'F' : null,
      raw_keys: channel && typeof channel === 'object' ? Object.keys(channel).filter(key => key !== 'x' && key !== 'y') : [],
      raw_metadata: safeChartMetadata(channel),
      sample_count: pairedCount,
      first_timestamp: pairedCount ? x[0] : null,
      last_timestamp: pairedCount ? x[pairedCount - 1] : null,
      min_temperature: numeric.length ? Math.min(...numeric) : null,
      max_temperature: numeric.length ? Math.max(...numeric) : null,
    }

    if (includeSamples) {
      result.samples = []
      for (let i = 0; i < pairedCount; i += 1) {
        const temperature = Number(y[i])
        if (!Number.isFinite(temperature)) continue
        result.samples.push({
          observed_at: x[i],
          temperature_value: temperature,
        })
      }
    }

    return result
  })

  return { channels, count: channels.length }
}

function normalizeSession(session: any) {
  return {
    id: session.id,
    title: session.title || `FireBoard Session ${session.id}`,
    start_time: session.start_time ?? null,
    end_time: session.end_time ?? null,
    duration: session.duration ?? null,
    description: session.description ?? null,
    devices: Array.isArray(session.devices)
      ? session.devices.map((device: any) => ({
          id: device?.id ?? null,
          uuid: device?.UUID ?? device?.uuid ?? null,
          title: device?.title ?? null,
          hardware_id: device?.hardware_id ?? null,
        }))
      : [],
  }
}

function sessionDeviceUuids(session: any) {
  return new Set((Array.isArray(session?.devices) ? session.devices : [])
    .map((device: any) => device?.UUID ?? device?.uuid ?? null)
    .filter(Boolean)
    .map(String))
}

function liveDeviceUuids(devices: any[]) {
  const now = Date.now()
  const recentCutoff = 90 * 1000
  return new Set(devices.filter((device: any) => {
    const latestTemps = Array.isArray(device?.latest_temps) ? device.latest_temps : []
    if (latestTemps.length) return true
    const last = Date.parse(device?.last_templog ?? '')
    return Number.isFinite(last) && (now - last) >= 0 && (now - last) <= recentCutoff
  }).map((device: any) => device?.UUID ?? device?.uuid ?? null).filter(Boolean).map(String))
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    try {
      const url = new URL(req.url)
      const sessionId = url.searchParams.get('session_id')

      if (sessionId) {
        if (!/^\d+$/.test(sessionId)) {
          return json({ error: 'Invalid FireBoard session ID.' }, 400)
        }
        const rawChart = await fireboardFetch(`/sessions/${sessionId}/chart.json`)
        const includeSamples = url.searchParams.get('samples') === '1'
        const summary = summarizeChart(rawChart, includeSamples)
        return json({ session_id: sessionId, ...summary })
      }

      const [rawSessions, rawDevices] = await Promise.all([
        fireboardFetch('/sessions.json'),
        fireboardFetch('/devices.json'),
      ])
      const sessions = Array.isArray(rawSessions) ? rawSessions : (rawSessions?.results ?? [])
      const devices = Array.isArray(rawDevices) ? rawDevices : (rawDevices?.results ?? [])
      const sorted = sessions.slice().sort((a: any, b: any) => {
        const at = Date.parse(a?.start_time ?? a?.created ?? 0)
        const bt = Date.parse(b?.start_time ?? b?.created ?? 0)
        return bt - at
      })

      const liveUuids = liveDeviceUuids(devices)
      const explicitlyOpen = sorted.filter((session: any) => session?.start_time && !session?.end_time)

      const realtimeCandidates = sorted.filter((session: any) => {
        if (!session?.start_time || !liveUuids.size) return false
        const uuids = sessionDeviceUuids(session)
        return [...uuids].some(uuid => liveUuids.has(uuid))
      })

      const activeRaw = explicitlyOpen.length ? explicitlyOpen : realtimeCandidates.slice(0, 1)
      const activeIds = new Set(activeRaw.map((session: any) => String(session.id)))
      const active = activeRaw.slice(0, 5).map(normalizeSession)

      const completed = sorted
        .filter((session: any) => session?.end_time && !activeIds.has(String(session.id)))
        .slice(0, 10)
        .map(normalizeSession)

      return json({
        active_sessions: active,
        active_count: active.length,
        active_detection: explicitlyOpen.length ? 'open-session' : (active.length ? 'live-device' : 'none'),
        live_device_count: liveUuids.size,
        sessions: completed,
        count: completed.length,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return json({ error: message }, 502)
    }
  }),
}
