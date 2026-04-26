import { supabase } from './supabase'

export async function createNotification(
  teamId: string,
  userId: string,
  type: string,
  title: string,
  body?: string,
  data?: Record<string, unknown>,
) {
  await supabase.from('notifications').insert({
    team_id: teamId,
    user_id: userId,
    type,
    title,
    body: body ?? null,
    data: data ?? {},
  })
}
