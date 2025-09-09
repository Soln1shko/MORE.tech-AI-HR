import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserRole } from '../services/api'

interface TopPanelProps {
  onLogoClick?: () => void
  hideButtons?: boolean
  disableLogoClick?: boolean
}

const TopPanel: React.FC<TopPanelProps> = ({ onLogoClick, hideButtons = false, disableLogoClick = false }) => {
  const navigate = useNavigate()
  const userRole = getUserRole()

  const handleProfileClick = () => {
    // Перенаправляем в зависимости от роли
    if (userRole === 'user') {
      navigate('/profile')
    } else if (userRole === 'company') {
      navigate('/company-dashboard')
    } else {
      // Если роль неизвестна или отсутствует, перенаправляем на логин
      navigate('/login')
    }
  }

  const handleCompanyProfileClick = () => {
    // Переход на страницу профиля компании
    navigate('/company-profile')
  }

  const handleApplicationsClick = () => {
    // Перенаправляем на страницу откликов
    navigate('/applications')
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-6">
      <div className="glass rounded-2xl px-8 py-4 w-full">
        <div className="flex items-center justify-between">
          {/* Логотип/название */}
          <div 
            className={`flex items-center space-x-3 ${
              disableLogoClick 
                ? '' 
                : 'cursor-pointer group transition-all duration-200 hover:scale-105'
            }`}
            onClick={disableLogoClick ? undefined : onLogoClick}
          >
            <img 
              src="/vtb.png" 
              alt="VTB Logo" 
              className={`w-10 h-10 object-contain rounded-lg ${
                disableLogoClick 
                  ? '' 
                  : 'transition-all duration-200 group-hover:opacity-80'
              }`}
            />
            <h1 className={`text-xl font-semibold text-white tracking-tight ${
              disableLogoClick 
                ? '' 
                : 'transition-all duration-200 group-hover:text-accent-blue'
            }`}>MORE.tech</h1>
          </div>

          {/* Кнопки */}
          {!hideButtons && (
            <div className="flex items-center space-x-2">
              {/* Показываем разные кнопки в зависимости от роли */}
              {userRole === 'user' && (
                <>
                  {/* Кнопка списка вакансий для пользователей */}
                  <button 
                    onClick={() => navigate('/vacancies-list')}
                    className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50"
                  >
                    <div className="flex items-center space-x-2 relative z-10">
                      <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3,5H21V7H3V5M3,13V11H21V13H3M3,19V17H21V19H3Z"/>
                      </svg>
                      <span className="text-sm font-medium">Вакансии</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                  </button>

                  {/* Кнопка откликов для пользователей */}
                  <button 
                    onClick={handleApplicationsClick}
                    className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50"
                  >
                    <div className="flex items-center space-x-2 relative z-10">
                      <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5 2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                      </svg>
                      <span className="text-sm font-medium">Отклики</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                  </button>
                </>
              )}

              {userRole === 'company' && (
                <>
                  {/* Кнопка кандидатов для компаний */}
                  <button 
                    onClick={() => navigate('/candidates')}
                    className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50"
                  >
                    <div className="flex items-center space-x-2 relative z-10">
                      <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16,4C18.11,4 19.8,5.69 19.8,7.8C19.8,9.91 18.11,11.6 16,11.6C13.89,11.6 12.2,9.91 12.2,7.8C12.2,5.69 13.89,4 16,4M16,13.4C18.67,13.4 24,14.73 24,17.4V20H8V17.4C8,14.73 13.33,13.4 16,13.4M8.8,10.4L6,7.6L4.6,9L8.8,13.2L20,2L18.6,0.6L8.8,10.4Z"/>
                      </svg>
                      <span className="text-sm font-medium">Кандидаты</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                  </button>

                  {/* Кнопка профиля компании (пока не рабочая) */}
                  <button 
                    onClick={handleCompanyProfileClick}
                    className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50"
                  >
                    <div className="flex items-center space-x-2 relative z-10">
                      <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                      </svg>
                      <span className="text-sm font-medium">Профиль</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                  </button>

                  {/* Кнопка настроек для компаний */}
                  <button 
                    onClick={handleProfileClick}
                    className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50"
                  >
                    <div className="flex items-center space-x-2 relative z-10">
                      <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.35 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                      </svg>
                      <span className="text-sm font-medium">Настройки</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                  </button>
                </>
              )}

              {/* Кнопка профиля (только для пользователей) */}
              {userRole === 'user' && (
                <button 
                  onClick={handleProfileClick}
                  className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50"
                >
                  <div className="flex items-center space-x-2 relative z-10">
                    <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                    </svg>
                    <span className="text-sm font-medium">Профиль</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TopPanel
