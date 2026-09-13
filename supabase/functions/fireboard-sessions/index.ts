import { withSupabase } from 'npm:@supabase/server@^1'

const FIREBOARD_BASE = 'https://fireboard.io/api/v1'
const USER_AGENT = 'LDCookLog/1.22 fireboard integration'

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

function summarizeChart(raw: any, includeSamples = false) {
  const channels = chartSource(raw).map((channel: any, index: number) => {
    const x = Array.isArray(channel?.x) ? channel.x : []
    const y = Array.isArray(channel?.y) ? channel.y : []
    const pairedCount = Math.min(x.length, y.length)
    const numeric = y.map((value: any) => Number(value)).filter((value: number) => Number.isFinite(value))
    const degreeType = channel?.degreetype ?? channel?.degree_type ?? channel?.unit ?? null
    const result: any = {
      index,
      label: channel?.label ?? channel?.title ?? channel?.name ?? `Channel ${index + 1}`,
      device_uuid: channel?.device ?? channel?.device_uuid ?? channel?.UUID ?? channel?.uuid ?? null,
      degree_type: degreeType,
      degree_unit: Number(degreeType) === 1 ? 'C' : Number(degreeType) === 2 ? 'F' : null,
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

      const raw = await fireboardFetch('/sessions.json')
      const sessions = Array.isArray(raw) ? raw : (raw?.results ?? [])

      const completed = sessions
        .filter((session: any) => session?.end_time)
        .sort((a: any, b: any) => {
          const at = Date.parse(a?.start_time ?? a?.created ?? 0)
          const bt = Date.parse(b?.start_time ?? b?.created ?? 0)
          return bt - at
        })
        .slice(0, 10)
        .map((session: any) => ({
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
        }))

      return json({ sessions: completed, count: completed.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return json({ error: message }, 502)
    }
  }),
}
