/**
 * Audit trail helper — logs every Create / Update / Delete action to activity_logs.
 * Fails silently so a logging error never breaks the main operation.
 */

import { supabase } from './supabase'

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'restock'
  | 'receiving'
  | 'export'

export type ActivityTarget =
  | 'inventory'
  | 'recipe'
  | 'supplier'
  | 'menu'
  | 'purchase_order'
  | 'ingredient_supplier'

export interface LogActivityParams {
  teamId: string
  userId: string
  action: ActivityAction
  targetType: ActivityTarget
  targetId?: string
  targetName?: string
  details?: Record<string, unknown>
}

/**
 * Fire-and-forget audit log entry.
 * Never throws — logging must not disrupt the calling operation.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const { teamId, userId, action, targetType, targetId, targetName, details } = params
  try {
    await supabase.from('activity_logs').insert({
      team_id:     teamId,
      user_id:     userId,
      action,
      target_type: targetType,
      target_id:   targetId   ?? null,
      target_name: targetName ?? null,
      details:     details    ?? null,
    })
  } catch {
    // intentionally swallowed
  }
}
