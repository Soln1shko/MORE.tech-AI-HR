import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserRole, checkAuth } from '../services/api'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
  redirectTo?: string
  requireAuth?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles = [], 
  redirectTo,
  requireAuth = true 
}) => {
  const navigate = useNavigate()

  useEffect(() => {
    // Проверяем авторизацию если требуется
    if (requireAuth && !checkAuth()) {
      navigate('/login')
      return
    }

    // Если указаны разрешенные роли, проверяем роль пользователя
    if (allowedRoles.length > 0) {
      const userRole = getUserRole()
      
      if (!userRole || !allowedRoles.includes(userRole)) {
        // Определяем куда перенаправить в зависимости от роли
        if (redirectTo) {
          navigate(redirectTo)
        } else if (userRole === 'company') {
          navigate('/company-dashboard')
        } else if (userRole === 'user') {
          navigate('/welcomescreen')
        } else {
          navigate('/login')
        }
        return
      }
    }
  }, [navigate, allowedRoles, redirectTo, requireAuth])

  return <>{children}</>
}

export default ProtectedRoute
