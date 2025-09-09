import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopPanel from '../components/TopPanel'
import { getConfig } from '../config/environment'

interface StatusChange {
  _id: string
  interview_id: string
  user_id: string
  vacancy_id: string
  company_id: string
  status: string
  updated_at: string
}

interface ApplicationWithDetails {
  statusChange: StatusChange
  vacancyTitle?: string
  companyName?: string
}

const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    try {
      setLoading(true)
      setError('')
      const { API_BASE_URL } = getConfig()
      
      const token = localStorage.getItem('authToken')
      if (!token) {
        navigate('/login')
        return
      }

      // Загружаем изменения статусов
      const statusResponse = await fetch(`${API_BASE_URL}/user-interviews-status-changes`, {
        headers: {
          'x-access-token': token,
          'Content-Type': 'application/json'
        }
      })

      if (!statusResponse.ok) {
        throw new Error('Ошибка загрузки статусов')
      }

      const statusData = await statusResponse.json()
      const statusChanges: StatusChange[] = statusData.status_changes || []

      // Загружаем вакансии для получения названий
      const vacanciesResponse = await fetch(`${API_BASE_URL}/vacancies`, {
        headers: {
          'x-access-token': token,
          'Content-Type': 'application/json'
        }
      })

      if (!vacanciesResponse.ok) {
        throw new Error('Ошибка загрузки вакансий')
      }

      const vacanciesData = await vacanciesResponse.json()
      const vacancies = vacanciesData.vacancies || []

      // Загружаем компании для получения названий
      const companiesResponse = await fetch(`${API_BASE_URL}/companies`, {
        headers: {
          'x-access-token': token,
          'Content-Type': 'application/json'
        }
      })

      if (!companiesResponse.ok) {
        throw new Error('Ошибка загрузки компаний')
      }

      const companiesData = await companiesResponse.json()
      const companies = companiesData.companies || []

      // Объединяем данные
      const applicationsWithDetails: ApplicationWithDetails[] = statusChanges.map(statusChange => {
        const vacancy = vacancies.find((v: any) => v._id === statusChange.vacancy_id)
        const company = companies.find((c: any) => c._id === statusChange.company_id)
        
        return {
          statusChange,
          vacancyTitle: vacancy?.title || 'Неизвестная вакансия',
          companyName: company?.company_name || 'Неизвестная компания'
        }
      })

      // Сортируем по дате (новые сверху)
      applicationsWithDetails.sort((a, b) => 
        new Date(b.statusChange.updated_at).getTime() - new Date(a.statusChange.updated_at).getTime()
      )

      setApplications(applicationsWithDetails)
    } catch (err) {
      setError('Ошибка при загрузке данных')
      console.error('Ошибка загрузки заявок:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; color: string; description: string; icon: string }> = {
      'active': {
        text: 'Активные',
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        description: 'Заявка отправлена, ожидается проверка резюме и обратная связь.',
        icon: '⏳'
      },
      'completed': {
        text: 'Одобренные ИИ',
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        description: 'Резюме прошло проверку ИИ, можно проходить собеседование.',
        icon: '✅'
      },
      'test_task': {
        text: 'Тестовое задание',
        color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        description: 'Прошли собеседование, направлено тестовое задание.',
        icon: '📝'
      },
      'finalist': {
        text: 'Финалисты',
        color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        description: 'Попали в финальный этап отбора. Ожидается финальное собеседование.',
        icon: '🏆'
      },
      'offer': {
        text: 'Оффер',
        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        description: 'Поздравляем! Получено предложение о работе.',
        icon: '🎉'
      },
      'rejected': {
        text: 'Отклоненные',
        color: 'bg-red-500/20 text-red-400 border-red-500/30',
        description: 'Кандидатура не подошла. Не расстраивайтесь, продолжайте поиски!',
        icon: '❌'
      }
    }

    return statusMap[status] || {
      text: status,
      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      description: 'Статус неизвестен.',
      icon: '❓'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleLogoClick = () => {
    navigate('/welcomescreen')
  }

  // Определение фильтров
  const filters = [
    { id: 'all', label: 'Все', count: applications.length },
    { id: 'active', label: 'Активные', count: applications.filter(app => app.statusChange.status === 'active').length, color: 'blue' },
    { id: 'completed', label: 'Одобренные ИИ', count: applications.filter(app => app.statusChange.status === 'completed').length, color: 'green' },
    { id: 'test_task', label: 'Тестовое задание', count: applications.filter(app => app.statusChange.status === 'test_task').length, color: 'orange' },
    { id: 'finalist', label: 'Финалисты', count: applications.filter(app => app.statusChange.status === 'finalist').length, color: 'purple' },
    { id: 'offer', label: 'Оффер', count: applications.filter(app => app.statusChange.status === 'offer').length, color: 'emerald' },
    { id: 'rejected', label: 'Отклоненные', count: applications.filter(app => app.statusChange.status === 'rejected').length, color: 'red' }
  ]

  // Фильтрация приложений
  const filteredApplications = activeFilter === 'all' 
    ? applications 
    : applications.filter(app => app.statusChange.status === activeFilter)

  // Получение цвета для фильтра
  const getFilterButtonClass = (filterId: string, color?: string) => {
    if (activeFilter === filterId) {
      switch (color) {
        case 'blue':
          return 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-lg shadow-blue-500/20'
        case 'green':
          return 'bg-green-500/20 text-green-400 border-green-500/50 shadow-lg shadow-green-500/20'
        case 'orange':
          return 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-lg shadow-orange-500/20'
        case 'purple':
          return 'bg-purple-500/20 text-purple-400 border-purple-500/50 shadow-lg shadow-purple-500/20'
        case 'emerald':
          return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
        case 'red':
          return 'bg-red-500/20 text-red-400 border-red-500/50 shadow-lg shadow-red-500/20'
        default:
          return 'bg-accent-blue/20 text-accent-blue border-accent-blue/50 shadow-lg shadow-accent-blue/20'
      }
    }
    return 'bg-dark-700/30 text-dark-300 border-dark-600/50 hover:bg-dark-600/50 hover:text-white hover:border-dark-500/70'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        <TopPanel onLogoClick={handleLogoClick} />
        <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
          <div className="bg-dark-900/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-dark-600/30">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
              <span className="text-white text-sm">Загрузка откликов...</span>
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
                onClick={loadApplications}
                className="px-6 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl font-medium transition-colors"
              >
                Попробовать снова
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
        
        <div className="absolute top-1/4 left-8 w-2 h-2 bg-accent-blue/20 rounded-full"></div>
        <div className="absolute top-1/3 right-12 w-1 h-1 bg-accent-purple/30 rounded-full"></div>
        <div className="absolute bottom-1/4 left-16 w-1.5 h-1.5 bg-accent-blue/15 rounded-full"></div>
        <div className="absolute bottom-1/3 right-8 w-2 h-2 bg-accent-purple/20 rounded-full"></div>
      </div>

      {/* Верхняя панель */}
      <TopPanel onLogoClick={handleLogoClick} />
      
      {/* Основной контент */}
      <div className="relative z-10 min-h-screen pt-36 pb-20 px-6">
        <div className="w-full max-w-4xl mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Мои отклики и приглашения
            </h1>
            <p className="text-dark-400 text-lg">
              История изменений статусов ваших заявок
            </p>
          </div>

          {/* Фильтры */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3 justify-center">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-2 rounded-xl border font-medium transition-all duration-300 hover:scale-105 flex items-center space-x-2 ${getFilterButtonClass(filter.id, filter.color)}`}
                >
                  <span>{filter.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeFilter === filter.id 
                      ? 'bg-white/20' 
                      : 'bg-dark-600/50'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Список откликов */}
          {filteredApplications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5 2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>
                </svg>
              </div>
              <h4 className="text-xl text-white mb-2">
                {activeFilter === 'all' ? 'Нет откликов' : `Нет заявок со статусом "${filters.find(f => f.id === activeFilter)?.label}"`}
              </h4>
              <p className="text-dark-400">
                {activeFilter === 'all' 
                  ? 'У вас пока нет заявок на вакансии' 
                  : 'Попробуйте выбрать другой фильтр или подать больше заявок'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredApplications.map((application, index) => {
                const statusInfo = getStatusInfo(application.statusChange.status)
                
                return (
                  <div
                    key={application.statusChange._id}
                    className="glass rounded-2xl p-6 border border-dark-600/30 hover:border-dark-500/50 transition-all duration-300 animate-stagger-fade-in"
                    style={{
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white mb-2">
                          {application.vacancyTitle}
                        </h3>
                        <p className="text-dark-300 text-lg mb-2">
                          {application.companyName}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{statusInfo.icon}</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-dark-400 mb-4">
                      {statusInfo.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-dark-500">
                      <span>Обновлено: {formatDate(application.statusChange.updated_at)}</span>
                      <span>ID заявки: {application.statusChange.interview_id.slice(-8)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ApplicationsPage
