import { supabase } from './supabase'

export function whLog(
  userId: string | undefined,
  username: string | undefined,
  role: string | undefined,
  action: string,
  target?: string | null,
  details?: string | null,
) {
  void supabase.from('wh_activity_logs').insert({
    user_id: userId ?? null,
    username: username ?? null,
    role: role ?? null,
    action,
    target: target ?? null,
    details: details ?? null,
  })
}
