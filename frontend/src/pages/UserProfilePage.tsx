import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopPanel from '../components/TopPanel'
import { getUserProfile, logout, downloadUserResume, updateUserResume, getUserApplications, updateUserProfile } from '../services/api'

// Функция для форматирования имени компании (синхронизировано с бэкендом)
const formatCompanyName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/ /g, '_')
    .replace(/ооо/g, '')
    .replace(/зао/g, '')
    .replace(/оао/g, '')
    .replace(/"/g, '')
    .replace(/'/g, '')
    .replace(/«/g, '') // Русские кавычки-елочки
    .replace(/»/g, '') // Русские кавычки-елочки
    .replace(/"/g, '') // Типографские кавычки
    .replace(/"/g, '') // Типографские кавычки
    .replace(/'/g, '') // Типографские кавычки
    .replace(/'/g, '') // Типографские кавычки
    .replace(/-/g, '_')
    .replace(/_+/g, '_') // Убираем множественные подчеркивания
    .replace(/^_|_$/g, '') // Убираем подчеркивания в начале и конце
}

// Функция для поиска аватарки компании
const getCompanyAvatar = async (companyName: string): Promise<string> => {
  const formattedName = formatCompanyName(companyName)
  const extensions = ['png', 'jpg', 'jpeg', 'webp']
  
  for (const ext of extensions) {
    const avatarPath = `/company_avatars/${formattedName}.${ext}`
    try {
      // Используем Image для проверки существования файла
      const imageExists = await new Promise<boolean>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(true)
        img.onerror = () => resolve(false)
        img.src = avatarPath
      })
      
      if (imageExists) {
        return avatarPath
      }
    } catch (error) {
      continue
    }
  }
  
  // Возвращаем заглушку, если аватарка не найдена
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4KPHA+aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMMTAgMTQuMTdsNy41OS03LjU5TDE5IDhsLTkgOXoiLz4KPC9zdmc+Cjwvc3ZnPgo='
}

interface UserProfile {
  email: string
  name: string
  surname: string
  telegram_id: string
  role: string
  resume_path?: string
}

interface ApplicationStatus {
  _id: string
  company_name: string
  vacancy_title: string
  vacancy_grade: string
  vacancy_work_field: string
  status: 'active' | 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer'
  created_at: string
  resume_score?: number
  company_avatar?: string
}

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showApplications, setShowApplications] = useState(false)
  const [showStatuses, setShowStatuses] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [downloadingResume, setDownloadingResume] = useState(false)
  // const [showUpdateResume, setShowUpdateResume] = useState(false) // Временно отключено
  const [updatingResume, setUpdatingResume] = useState(false)
  const [showSuccessIcon, setShowSuccessIcon] = useState(false)
  const [resumeButtonText, setResumeButtonText] = useState('Изменить')
  const [applications, setApplications] = useState<ApplicationStatus[]>([])
  const [loadingApplications, setLoadingApplications] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ name: '', surname: '', telegram_id: '' })
  const [updatingProfile, setUpdatingProfile] = useState(false)


  useEffect(() => {
    loadUserProfile()
    loadUserApplications()
  }, [])

  const loadUserProfile = async () => {
    try {
      const response = await getUserProfile()
      if (response.success) {
        const userData = response.data
        
        // Проверяем роль пользователя
        if (userData.role === 'company') {
          // Для компаний перенаправляем на главную (пока нет отдельного профиля)
          setError('Профиль компании находится в разработке')
          setTimeout(() => {
            navigate('/welcomescreen')
          }, 2000)
          return
        } else if (userData.role !== 'user') {
          // Для других ролей показываем ошибку
          setError('Доступ к профилю разрешен только для кандидатов')
          setTimeout(() => {
            navigate('/welcomescreen')
          }, 2000)
          return
        }
        
        setProfile(userData)
        // Инициализируем данные для редактирования
        setEditData({
          name: userData.name || '',
          surname: userData.surname || '',
          telegram_id: userData.telegram_id || ''
        })
      } else {
        setError(response.error || 'Ошибка загрузки профиля')
        // Если ошибка авторизации, перенаправляем на страницу входа
        if (response.error?.includes('Токен')) {
          navigate('/login')
        }
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  const loadUserApplications = async () => {
    try {
      setLoadingApplications(true)
      const response = await getUserApplications()
      if (response.success) {
        const applicationsData = response.data || []
        
        // Загружаем аватарки для каждой компании
        const applicationsWithAvatars = await Promise.all(
          applicationsData.map(async (application: ApplicationStatus) => {
            const avatar = await getCompanyAvatar(application.company_name)
            return {
              ...application,
              company_avatar: avatar
            }
          })
        )
        
        setApplications(applicationsWithAvatars)
      } else {
        console.error('Ошибка загрузки заявок:', response.error)
      }
    } catch (err) {
      console.error('Ошибка подключения к серверу:', err)
    } finally {
      setLoadingApplications(false)
    }
  }

  const handleLogout = () => {
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    logout()
    navigate('/login')
  }

  const handleLogoClick = () => {
    navigate('/welcomescreen')
  }

  const handleDownloadResume = async () => {
    try {
      setDownloadingResume(true)
      setError('')
      await downloadUserResume()
    } catch (err) {
      setError('Ошибка при скачивании резюме')
      console.error('Ошибка скачивания резюме:', err)
    } finally {
      setDownloadingResume(false)
    }
  }

  const handleUpdateResume = async (file: File) => {
    try {
      setUpdatingResume(true)
      setError('')
      const response = await updateUserResume(file)
      
      if (response.success) {
        // Обновляем профиль пользователя
        await loadUserProfile()
        // setShowUpdateResume(false) // Временно отключено
        
        // Меняем текст кнопки на "Изменено" и показываем галочку
        setResumeButtonText('Изменено')
        setShowSuccessIcon(true)
        
        // Через 2 секунды возвращаем текст обратно и убираем галочку
        setTimeout(() => {
          setShowSuccessIcon(false)
          setResumeButtonText('Изменить')
        }, 2000)
      } else {
        setError(response.error || 'Ошибка при обновлении резюме')
      }
    } catch (err) {
      setError('Ошибка при обновлении резюме')
      console.error('Ошибка обновления резюме:', err)
    } finally {
      setUpdatingResume(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      
      if (!allowedTypes.includes(file.type)) {
        setError('Поддерживаются только файлы PDF, DOC, DOCX')
        return
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB
        setError('Размер файла не должен превышать 5MB')
        return
      }

      handleUpdateResume(file)
    }
  }

  const getStatusColor = (status: ApplicationStatus['status']) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'test_task':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'finalist':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'offer':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusText = (status: ApplicationStatus['status']) => {
    switch (status) {
      case 'active':
        return 'Активные'
      case 'completed':
        return 'Одобренные ИИ'
      case 'test_task':
        return 'Тестовое задание'
      case 'finalist':
        return 'Финалисты'
      case 'offer':
        return 'Оффер'
      case 'rejected':
        return 'Отклонено'
      default:
        return 'Неизвестно'
    }
  }

  const getStatusIcon = (status: ApplicationStatus['status']) => {
    switch (status) {
      case 'active':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,6A1.5,1.5 0 0,1 13.5,7.5A1.5,1.5 0 0,1 12,9A1.5,1.5 0 0,1 10.5,7.5A1.5,1.5 0 0,1 12,6M7.5,17.25C7.5,15.19 10.5,14.25 12,14.25C13.5,14.25 16.5,15.19 16.5,17.25V18H7.5V17.25Z"/>
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
          </svg>
        )
      case 'test_task':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V16H6V18H15M18,14V12H6V14H18Z"/>
          </svg>
        )
      case 'finalist':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z"/>
          </svg>
        )
      case 'offer':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5L16,13V16H8V13L9.2,11.5V10C9.2,8.6 10.6,7 12,7Z"/>
          </svg>
        )
      case 'rejected':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        )
      default:
        return null
    }
  }

  const handleEditProfile = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    // Восстанавливаем исходные данные
    if (profile) {
      setEditData({
        name: profile.name || '',
        surname: profile.surname || '',
        telegram_id: profile.telegram_id || ''
      })
    }
  }

  const handleSaveProfile = async () => {
    try {
      setUpdatingProfile(true)
      setError('')
      
      const response = await updateUserProfile(editData)
      
      if (response.success) {
        // Обновляем профиль
        await loadUserProfile()
        setIsEditing(false)
      } else {
        setError(response.error || 'Ошибка при обновлении профиля')
      }
    } catch (err) {
      setError('Ошибка при обновлении профиля')
      console.error('Ошибка обновления профиля:', err)
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Подсчет статистики
  const statistics = {
    total: applications.length,
    rejected: applications.filter(app => app.status === 'rejected').length,
    offers: applications.filter(app => app.status === 'offer').length,
    pending: applications.filter(app => ['active', 'completed', 'test_task', 'finalist'].includes(app.status)).length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        <TopPanel onLogoClick={handleLogoClick} />
        <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
          <div className="bg-dark-900/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-dark-600/30">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
              <span className="text-white text-sm">Загрузка профиля...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        <TopPanel onLogoClick={handleLogoClick} />
        <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
          <div className="glass rounded-3xl p-8 border border-red-500/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Ошибка</h2>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl font-medium transition-colors"
              >
                Войти в систему
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Стильный фон */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Градиентная сетка */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        ></div>
        
        {/* Радиальные градиенты для глубины */}
        <div 
          className="absolute top-0 left-0 w-96 h-96 opacity-40"
          style={{
            background: 'radial-gradient(circle at top left, rgba(59, 130, 246, 0.02) 0%, transparent 70%)'
          }}
        ></div>
        <div 
          className="absolute bottom-0 right-0 w-96 h-96 opacity-40"
          style={{
            background: 'radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.02) 0%, transparent 70%)'
          }}
        ></div>
        
        {/* Геометрические формы */}
        <div className="absolute top-1/4 left-8 w-2 h-2 bg-accent-blue/20 rounded-full"></div>
        <div className="absolute top-1/3 right-12 w-1 h-1 bg-accent-purple/30 rounded-full"></div>
        <div className="absolute bottom-1/4 left-16 w-1.5 h-1.5 bg-accent-blue/15 rounded-full"></div>
        <div className="absolute bottom-1/3 right-8 w-2 h-2 bg-accent-purple/20 rounded-full"></div>
      </div>

      {/* Верхняя панель */}
      <TopPanel onLogoClick={handleLogoClick} />
      
      {/* Основной контент */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
        <div className="w-full max-w-2xl mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-r from-accent-blue to-accent-purple rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Профиль пользователя
            </h1>
            <p className="text-dark-400 text-lg">
              Ваша личная информация и настройки
            </p>
          </div>

          {/* Карточка профиля */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30 mb-8">
            <div className="space-y-6">
              {/* Основная информация */}
              <div className="border-b border-dark-600/30 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">Основная информация</h3>
                  {!isEditing && (
                    <button
                      onClick={handleEditProfile}
                      className="px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z"/>
                      </svg>
                      <span>Редактировать</span>
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Имя
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full px-4 py-3 bg-dark-800/50 border-2 border-accent-blue/40 rounded-xl text-white placeholder-dark-400 focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all duration-300 shadow-lg shadow-accent-blue/10"
                        placeholder="Введите имя"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white transition-all duration-300 hover:bg-dark-700/30">
                        {profile?.name || 'Не указано'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Фамилия
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.surname}
                        onChange={(e) => handleInputChange('surname', e.target.value)}
                        className="w-full px-4 py-3 bg-dark-800/50 border-2 border-accent-blue/40 rounded-xl text-white placeholder-dark-400 focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all duration-300 shadow-lg shadow-accent-blue/10"
                        placeholder="Введите фамилию"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white transition-all duration-300 hover:bg-dark-700/30">
                        {profile?.surname || 'Не указано'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Контактная информация */}
              <div className="border-b border-dark-600/30 pb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Контактная информация</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">
                      Email
                    </label>
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white flex items-center">
                      <svg className="w-4 h-4 text-dark-400 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                      </svg>
                      {profile?.email}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Telegram
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.telegram_id}
                        onChange={(e) => handleInputChange('telegram_id', e.target.value)}
                        className="w-full px-4 py-3 bg-dark-800/50 border-2 border-accent-blue/40 rounded-xl text-white placeholder-dark-400 focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all duration-300 shadow-lg shadow-accent-blue/10"
                        placeholder="@username или введите Telegram ID"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white flex items-center transition-all duration-300 hover:bg-dark-700/30">
                        <svg className="w-4 h-4 text-dark-400 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.78,18.65L10.06,14.42L17.74,7.5C18.08,7.19 17.67,7.04 17.22,7.31L7.74,13.3L3.64,12C2.76,11.75 2.75,11.14 3.84,10.7L19.81,4.54C20.54,4.21 21.24,4.72 20.96,5.84L18.24,18.65C18.05,19.56 17.5,19.78 16.74,19.36L12.6,16.3L10.61,18.23C10.38,18.46 10.19,18.65 9.78,18.65Z"/>
                        </svg>
                        {profile?.telegram_id || 'Не указано'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Информация об аккаунте */}
              <div className="border-b border-dark-600/30 pb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Информация об аккаунте</h3>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">
                    Роль
                  </label>
                  <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent-blue/20 text-accent-blue">
                      {profile?.role === 'user' ? 'Кандидат' : profile?.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Резюме */}
              {profile?.resume_path && (
                <div className="border-b border-dark-600/30 pb-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Документы</h3>
                  <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                        <div>
                          <p className="text-white text-sm font-medium">Резюме</p>
                          <p className="text-dark-400 text-xs">Загружено</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* Кнопка изменить слева от скачивания */}
                        <div className="relative">
                          <input
                            type="file"
                            id="resume-update"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileSelect}
                            disabled={updatingResume || downloadingResume}
                            className="hidden"
                          />
                          <button
                            onClick={() => document.getElementById('resume-update')?.click()}
                            disabled={updatingResume || downloadingResume}
                            className="px-3 py-1 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            {updatingResume ? (
                              <>
                                <div className="w-3 h-3 border border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
                                <span>Обновление...</span>
                              </>
                            ) : showSuccessIcon ? (
                              <>
                                <svg className="w-4 h-4 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                                </svg>
                                <span>{resumeButtonText}</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z"/>
                                </svg>
                                <span>Изменить</span>
                              </>
                            )}
                          </button>
                        </div>
                        
                        {/* Кнопка скачать справа - только иконка с понятной иконкой */}
                        <button
                          onClick={handleDownloadResume}
                          disabled={downloadingResume || updatingResume}
                          className="p-2 bg-dark-600/50 hover:bg-dark-600/70 text-dark-300 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          title="Скачать резюме"
                        >
                          {downloadingResume ? (
                            <div className="w-4 h-4 border border-dark-300/30 border-t-dark-300 rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Статистика заявок */}
              <div className="border-b border-dark-600/30 pb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Статистика заявок</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-center">
                    <div className="text-2xl font-bold text-white mb-1">{statistics.total}</div>
                    <div className="text-dark-400 text-sm">Всего</div>
                  </div>
                  <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                    <div className="text-2xl font-bold text-red-400 mb-1">{statistics.rejected}</div>
                    <div className="text-red-400 text-sm">Отклоненные</div>
                  </div>
                  <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                    <div className="text-2xl font-bold text-emerald-400 mb-1">{statistics.offers}</div>
                    <div className="text-emerald-400 text-sm">Офферы</div>
                  </div>
                  <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">{statistics.pending}</div>
                    <div className="text-blue-400 text-sm">В ожидании</div>
                  </div>
                </div>
              </div>

              {/* Быстрые действия */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">Быстрые действия</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Кнопка список компаний */}
                  <button
                    onClick={() => setShowApplications(true)}
                    className="flex items-center justify-between p-4 bg-dark-800/30 hover:bg-dark-700/50 border border-dark-600/50 hover:border-accent-blue/50 rounded-xl transition-all duration-300 group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent-blue/20 rounded-full flex items-center justify-center group-hover:bg-accent-blue/30 transition-colors">
                        <svg className="w-5 h-5 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">Список компаний</div>
                        <div className="text-dark-400 text-sm">Посмотреть поданные заявки</div>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-dark-400 group-hover:text-accent-blue transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </button>

                  {/* Кнопка статусы */}
                  <button
                    onClick={() => setShowStatuses(true)}
                    className="flex items-center justify-between p-4 bg-dark-800/30 hover:bg-dark-700/50 border border-dark-600/50 hover:border-accent-purple/50 rounded-xl transition-all duration-300 group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent-purple/20 rounded-full flex items-center justify-center group-hover:bg-accent-purple/30 transition-colors">
                        <svg className="w-5 h-5 text-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13,2.05V5.08C16.39,5.57 19,8.47 19,12C19,12.9 18.82,13.75 18.5,14.54L21.12,16.07C21.68,14.83 22,13.45 22,12C22,6.82 18.05,2.55 13,2.05M12,19A7,7 0 0,1 5,12C5,8.47 7.61,5.57 11,5.08V2.05C5.95,2.55 2,6.82 2,12A10,10 0 0,0 12,22C13.45,22 14.83,21.68 16.07,21.12L14.54,18.5C13.75,18.82 12.9,19 12,19M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12Z"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="text-white font-medium">Статусы заявок</div>
                        <div className="text-dark-400 text-sm">Отслеживать прогресс</div>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-dark-400 group-hover:text-accent-purple transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Кнопки сохранения/отмены для режима редактирования */}
              {isEditing && (
                <div className="pt-6 border-t border-dark-600/30">
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={handleSaveProfile}
                      disabled={updatingProfile}
                      className="flex-1 max-w-xs px-8 py-4 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 shadow-lg shadow-accent-blue/20 hover:shadow-accent-blue/30 hover:scale-105"
                    >
                      {updatingProfile ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Сохранение...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                          </svg>
                          <span>Сохранить изменения</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={updatingProfile}
                      className="flex-1 max-w-xs px-8 py-4 bg-dark-700/50 hover:bg-dark-600/70 border border-dark-600/50 hover:border-dark-500/70 text-dark-300 hover:text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-3 hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                      </svg>
                      <span>Отменить</span>
                    </button>
                  </div>
                  
                  {/* Подсказка */}
                  <div className="mt-4 text-center">
                    <p className="text-dark-400 text-sm flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,7H13V9H11V7M11,11H13V17H11V11Z"/>
                      </svg>
                      <span>Изменения будут сохранены только после нажатия кнопки "Сохранить"</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/welcomescreen')}
              className="flex-1 px-6 py-3 border border-dark-600 text-dark-300 rounded-xl font-medium hover:border-dark-500 hover:text-white transition-colors"
            >
              Назад к главной
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 px-6 py-3 border border-dark-600 text-dark-300 rounded-xl font-medium hover:border-dark-500 hover:text-white transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17,7L15.59,5.59L13.17,8.01L15.59,10.42L17,9L21,13L17,17L15.59,15.59L13.17,13.17L15.59,10.75L17,12.25L21,8.25L17,7M3,3H11A2,2 0 0,1 13,5V9H11V5H3V19H11V15H13V19A2,2 0 0,1 11,21H3A2,2 0 0,1 1,19V5A2,2 0 0,1 3,3Z"/>
              </svg>
              <span>Выйти из аккаунта</span>
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно - Список компаний */}
      {showApplications && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowApplications(false)}
          ></div>
          <div className="relative glass rounded-3xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-dark-600/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Поданные заявки</h2>
              <button
                onClick={() => setShowApplications(false)}
                className="w-8 h-8 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            
            {loadingApplications ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
                  <span className="text-white text-sm">Загрузка заявок...</span>
                </div>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-dark-600/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                  </svg>
                </div>
                <h3 className="text-white font-medium mb-2">Заявок нет</h3>
                <p className="text-dark-400 text-sm">Вы еще не подавали ни одной заявки</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((application) => (
                  <div key={application._id} className="p-4 bg-dark-800/30 border border-dark-600/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img
                          src={application.company_avatar}
                          alt={application.company_name}
                          className="w-12 h-12 object-cover rounded-lg"
                          onError={(e) => {
                            // Заглушка на случай отсутствия картинки
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4KPHA+aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMMTAgMTQuMTdsNy41OS03LjU5TDE5IDhsLTkgOXoiLz4KPC9zdmc+Cjwvc3ZnPgo='
                          }}
                        />
                        <div>
                          <h3 className="text-white font-semibold">{application.company_name}</h3>
                          <p className="text-dark-300 text-sm">{application.vacancy_title} ({application.vacancy_grade})</p>
                          <p className="text-dark-400 text-xs">Подано: {formatDate(application.created_at)}</p>
                          {application.resume_score && (
                            <p className="text-accent-blue text-xs">Оценка резюме: {application.resume_score}%</p>
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(application.status)}`}>
                        {getStatusIcon(application.status)}
                        <span>{getStatusText(application.status)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно - Статусы заявок */}
      {showStatuses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowStatuses(false)}
          ></div>
          <div className="relative glass rounded-3xl p-6 max-w-2xl w-full border border-dark-600/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Статусы заявок</h2>
              <button
                onClick={() => setShowStatuses(false)}
                className="w-8 h-8 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            
            {/* Описание статусов с счетчиками */}
            <div className="space-y-3">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,6A1.5,1.5 0 0,1 13.5,7.5A1.5,1.5 0 0,1 12,9A1.5,1.5 0 0,1 10.5,7.5A1.5,1.5 0 0,1 12,6M7.5,17.25C7.5,15.19 10.5,14.25 12,14.25C13.5,14.25 16.5,15.19 16.5,17.25V18H7.5V17.25Z"/>
                      </svg>
                    </div>
                    <h4 className="text-blue-400 font-medium text-sm">Активные</h4>
                  </div>
                  <div className="text-2xl font-bold text-blue-400">{applications.filter(app => app.status === 'active').length}</div>
                </div>
                <p className="text-blue-300/80 text-xs">Заявка отправлена, ожидается проверка резюме и обратная связь.</p>
              </div>
              
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                      </svg>
                    </div>
                    <h4 className="text-green-400 font-medium text-sm">Одобренные ИИ</h4>
                  </div>
                  <div className="text-2xl font-bold text-green-400">{applications.filter(app => app.status === 'completed').length}</div>
                </div>
                <p className="text-green-300/80 text-xs">Резюме прошло проверку ИИ, можно проходить собеседование.</p>
              </div>
              
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V16H6V18H15M18,14V12H6V14H18Z"/>
                      </svg>
                    </div>
                    <h4 className="text-orange-400 font-medium text-sm">Тестовое задание</h4>
                  </div>
                  <div className="text-2xl font-bold text-orange-400">{applications.filter(app => app.status === 'test_task').length}</div>
                </div>
                <p className="text-orange-300/80 text-xs">Прошли собеседование, направлено тестовое задание.</p>
              </div>
              
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z"/>
                      </svg>
                    </div>
                    <h4 className="text-purple-400 font-medium text-sm">Финалисты</h4>
                  </div>
                  <div className="text-2xl font-bold text-purple-400">{applications.filter(app => app.status === 'finalist').length}</div>
                </div>
                <p className="text-purple-300/80 text-xs">Попали в финальный этап отбора. Ожидается финальное собеседование.</p>
              </div>
              
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5L16,13V16H8V13L9.2,11.5V10C9.2,8.6 10.6,7 12,7Z"/>
                      </svg>
                    </div>
                    <h4 className="text-emerald-400 font-medium text-sm">Оффер</h4>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">{applications.filter(app => app.status === 'offer').length}</div>
                </div>
                <p className="text-emerald-300/80 text-xs">Поздравляем! Получено предложение о работе.</p>
              </div>
              
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                      </svg>
                    </div>
                    <h4 className="text-red-400 font-medium text-sm">Отклоненные</h4>
                  </div>
                  <div className="text-2xl font-bold text-red-400">{applications.filter(app => app.status === 'rejected').length}</div>
                </div>
                <p className="text-red-300/80 text-xs">Кандидатура не подошла. Не расстраивайтесь, продолжайте поиски!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно - Подтверждение выхода */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          ></div>
          <div className="relative glass rounded-3xl p-8 max-w-md w-full border border-dark-600/30">
            <div className="text-center">
              {/* Иконка предупреждения */}
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2M12,7A2,2 0 0,0 10,9A2,2 0 0,0 12,11A2,2 0 0,0 14,9A2,2 0 0,0 12,7M12,15.5C9.5,15.5 7.5,14.1 7.5,12.4C7.5,11.15 8.9,10.1 11,9.45L11.5,8.5C11.7,8.1 12.3,8.1 12.5,8.5L13,9.45C15.1,10.1 16.5,11.15 16.5,12.4C16.5,14.1 14.5,15.5 12,15.5Z"/>
                </svg>
              </div>
              
              <h3 className="text-2xl font-light text-white mb-4">Подтверждение выхода</h3>
              <p className="text-dark-300 text-lg mb-8">
                Вы действительно хотите выйти из аккаунта?
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300"
                >
                  Отмена
                </button>
                
                <button
                  onClick={confirmLogout}
                  className="flex-1 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                >
                  Да, выйти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfilePage
