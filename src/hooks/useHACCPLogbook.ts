import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  HACCPAppliance, HACCPApplianceInsert,
  HACCPTemperatureLog, HACCPShift,
} from '../types/database.types'

export function useHACCPLogbook(dateIso: string, shift: HACCPShift) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null

  const [appliances, setAppliances]         = useState<HACCPAppliance[]>([])
  const [logs, setLogs]                     = useState<HACCPTemperatureLog[]>([])
  const [loadingAppliances, setLoadingAppliances] = useState(true)
  const [loadingLogs, setLoadingLogs]       = useState(true)
  const [error, setError]                   = useState<string | null>(null)

  const loadAppliances = useCallback(async () => {
    if (!teamId) { setAppliances([]); setLoadingAppliances(false); return }
    const { data, error: err } = await supabase
      .from('haccp_appliances')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order')
      .order('name')
    setAppliances((data ?? []) as HACCPAppliance[])
    if (err) setError(err.message)
    setLoadingAppliances(false)
  }, [teamId])

  const loadLogs = useCallback(async () => {
    if (!teamId) { setLogs([]); setLoadingLogs(false); return }
    setLoadingLogs(true)
    const { data, error: err } = await supabase
      .from('haccp_temperature_logs')
      .select('*')
      .eq('team_id', teamId)
      .eq('logged_date', dateIso)
      .eq('shift', shift)
    setLogs((data ?? []) as HACCPTemperatureLog[])
    if (err) setError(err.message)
    setLoadingLogs(false)
  }, [teamId, dateIso, shift])

  useEffect(() => { void loadAppliances() }, [loadAppliances])
  useEffect(() => { void loadLogs() }, [loadLogs])

  const logTemperature = useCallback(async (
    applianceId: string,
    temperature: number,
    correctiveAction?: string | null,
  ): Promise<HACCPTemperatureLog> => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase
      .from('haccp_temperature_logs')
      .upsert({
        team_id:           teamId,
        appliance_id:      applianceId,
        temperature,
        shift,
        corrective_action: correctiveAction ?? null,
        user_id:           userId,
        logged_date:       dateIso,
      }, { onConflict: 'appliance_id,logged_date,shift' })
      .select('*')
      .single()
    if (err) throw err
    const row = data as HACCPTemperatureLog
    setLogs((prev) => {
      const without = prev.filter((l) => l.appliance_id !== applianceId)
      return [...without, row]
    })
    return row
  }, [teamId, userId, shift, dateIso])

  const deleteLog = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('haccp_temperature_logs').delete().eq('id', id)
    if (err) throw err
    setLogs((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const createAppliance = useCallback(async (insert: HACCPApplianceInsert): Promise<HACCPAppliance> => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase
      .from('haccp_appliances')
      .insert({ ...insert, team_id: teamId })
      .select('*')
      .single()
    if (err) throw err
    const row = data as HACCPAppliance
    setAppliances((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    return row
  }, [teamId])

  const deleteAppliance = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('haccp_appliances').delete().eq('id', id)
    if (err) throw err
    setAppliances((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const getLog = (applianceId: string) => logs.find((l) => l.appliance_id === applianceId)
  const isLogged = (applianceId: string) => logs.some((l) => l.appliance_id === applianceId)
  const isPass = (log: HACCPTemperatureLog, appliance: HACCPAppliance) =>
    log.temperature >= appliance.min_temp && log.temperature <= appliance.max_temp

  return {
    appliances, logs, loadingAppliances, loadingLogs, error,
    reloadLogs: loadLogs, reloadAppliances: loadAppliances,
    logTemperature, deleteLog,
    createAppliance, deleteAppliance,
    getLog, isLogged, isPass,
  }
}
