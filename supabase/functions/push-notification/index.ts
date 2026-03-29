import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface Payload {
  recipientId: string
  title: string
  body: string
  data?: Record<string, string>
}

Deno.serve(async (req: Request) => {
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Use service role client to read push tokens (server-side lookup)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', payload.recipientId)
    .single()

  if (!profile?.push_token) {
    return new Response(JSON.stringify({ ok: false, reason: 'no_token' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: profile.push_token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
      priority: 'high',
    }),
  })

  const result = await pushRes.json()
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
