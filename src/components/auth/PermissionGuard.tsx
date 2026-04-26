import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions, type AppModule } from '../../hooks/usePermissions'

export function PermissionGuard({
  module,
  children,
}: {
  module: AppModule
  children: ReactNode
}) {
  const { can, loading } = usePermissions()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !can(module)) {
      navigate('/', { replace: true })
    }
  }, [loading, can, module, navigate])

  if (loading) return null
  if (!can(module)) return null
  return <>{children}</>
}
