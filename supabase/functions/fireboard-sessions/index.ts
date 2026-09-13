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

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    try {
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
