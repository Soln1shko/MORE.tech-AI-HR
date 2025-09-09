import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getAllCompanies, getAllVacancies, VacancyData, CompanyFromBackend, checkResume, ResumeCheckResult } from '../services/api'

interface Vacancy {
  _id: string
  title: string
  grade: string
  required_skills: string[]
  min_experience: number
  max_experience: number
  work_field: string
  work_address?: string
  company_id: string
  description?: string
  optional_skills?: string[]
}

interface Company {
  _id: string
  company_name: string
  avatar: string
  vacancies: Vacancy[]
}

interface WelcomeScreenProps {
  onStartInterview: (vacancyId: string) => void
}

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

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartInterview }) => {
  const location = useLocation()
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null)
  const [showVacancies, setShowVacancies] = useState(false)

  // Функция для получения цвета уровня (grade)
  const getGradeColor = (grade: string) => {
    const normalizedGrade = grade.toLowerCase().trim()
    
    switch (normalizedGrade) {
      case 'junior':
        return 'bg-teal-500/20 text-teal-400 border-teal-500/30'
      case 'middle':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'senior':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'lead':
      case 'team lead':
      case 'teamlead':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'architect':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'intern':
      case 'стажер':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default:
        return 'bg-accent-blue/20 text-accent-blue border-accent-blue/30'
    }
  }
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredSkills, setHoveredSkills] = useState<{vacancyId: string, skills: string[]} | null>(null)
  const [showVacancyDetails, setShowVacancyDetails] = useState(false)
  const [selectedVacancyDetails, setSelectedVacancyDetails] = useState<Vacancy | null>(null)
  
  // Состояния для проверки резюме
  const [resumeCheckResult, setResumeCheckResult] = useState<ResumeCheckResult | null>(null)
  const [isCheckingResume, setIsCheckingResume] = useState(false)
  const [resumeChecked, setResumeChecked] = useState(false)

  // Загрузка данных при инициализации
  useEffect(() => {
    loadCompaniesAndVacancies()
  }, [])

  // Обработка URL параметров для автоматического выбора компании и вакансии
  useEffect(() => {
    if (companies.length > 0) {
      const urlParams = new URLSearchParams(location.search)
      const companyId = urlParams.get('company')
      const vacancyId = urlParams.get('vacancy')

      if (companyId && companies.find(c => c._id === companyId)) {
        setSelectedCompany(companyId)
        setShowVacancies(true)
        
        if (vacancyId) {
          const company = companies.find(c => c._id === companyId)
          const vacancy = company?.vacancies.find(v => v._id === vacancyId)
          if (vacancy) {
            setSelectedVacancy(vacancyId)
            // Автоматически открываем детали вакансии
            setSelectedVacancyDetails(vacancy)
            setShowVacancyDetails(true)
          }
        }
      }
    }
  }, [companies, location.search])

  const loadCompaniesAndVacancies = async () => {
    try {
      setLoading(true)
      setError('')

      // Загружаем компании
      const companiesResponse = await getAllCompanies()
      if (!companiesResponse.success) {
        setError(companiesResponse.error || 'Ошибка загрузки компаний')
        return
      }

      // Загружаем все вакансии
      const vacanciesResponse = await getAllVacancies()
      if (!vacanciesResponse.success) {
        setError(vacanciesResponse.error || 'Ошибка загрузки вакансий')
        return
      }

      // Группируем вакансии по компаниям
      const companiesData: CompanyFromBackend[] = companiesResponse.data.companies || []
      const vacanciesData: VacancyData[] = vacanciesResponse.data.vacancies || []

      // Создаем структуру данных для компонента
      const companiesWithVacancies: Company[] = await Promise.all(
        companiesData.map(async (company) => {
          const companyVacancies = vacanciesData.filter(
            vacancy => vacancy.company_id === company._id
          )
          
          // Получаем аватарку компании
          const avatar = await getCompanyAvatar(company.company_name)
          
          return {
            _id: company._id,
            company_name: company.company_name,
            avatar,
            vacancies: companyVacancies.map(vacancy => ({
              _id: vacancy._id || '',
              title: vacancy.title,
              grade: vacancy.grade,
              required_skills: vacancy.required_skills,
              min_experience: vacancy.min_experience,
              max_experience: vacancy.max_experience,
              work_field: vacancy.work_field,
              work_address: vacancy.work_address,
              company_id: vacancy.company_id || '',
              description: vacancy.description,
              optional_skills: vacancy.optional_skills
            }))
          }
        })
      )

      // Фильтруем компании с вакансиями
      setCompanies(companiesWithVacancies.filter(company => company.vacancies.length > 0))
    } catch (err) {
      setError('Ошибка подключения к серверу')
      console.error('Ошибка при загрузке данных:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCompanySelect = (companyId: string) => {
    if (selectedCompany === companyId && showVacancies) {
      // Если та же компания и вакансии уже показаны, скрываем их
      setShowVacancies(false)
      setSelectedVacancy(null)
    } else {
      // Выбираем новую компанию и показываем вакансии
      setSelectedCompany(companyId)
      setShowVacancies(true)
      setSelectedVacancy(null)
    }
  }

  const handleVacancySelect = (vacancyId: string) => {
    setSelectedVacancy(vacancyId)
  }

  const handleVacancyDetailsOpen = (vacancy: Vacancy) => {
    setSelectedVacancyDetails(vacancy)
    setShowVacancyDetails(true)
  }

  const handleVacancyDetailsClose = () => {
    setShowVacancyDetails(false)
    setSelectedVacancyDetails(null)
    // Сбрасываем состояние проверки резюме при закрытии
    setResumeChecked(false)
    setResumeCheckResult(null)
    setError('')
  }

  const handleCheckResume = async () => {
    if (!selectedVacancyDetails) return

    setIsCheckingResume(true)
    setError('')

    try {
      const result = await checkResume(selectedVacancyDetails._id)
      
      if (result.success && result.data) {
        setResumeCheckResult(result.data)
        setResumeChecked(true)
        console.log('Результат проверки резюме:', result.data)
      } else {
        setError(result.error || 'Ошибка при проверке резюме')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
      console.error('Ошибка проверки резюме:', err)
    } finally {
      setIsCheckingResume(false)
    }
  }

  const handleStartInterview = () => {
    if (selectedCompany && selectedVacancy) {
      console.log('Начинаем интервью:', { 
        company: selectedCompany, 
        vacancy: selectedVacancy 
      })
      onStartInterview(selectedVacancy)
    }
  }

  const getSelectedCompanyData = () => {
    return companies.find(c => c._id === selectedCompany)
  }

  const handleEasterEgg = () => {
    setShowEasterEgg(true)
    setTimeout(() => setShowEasterEgg(false), 5000) // Скрыть через 5 секунд
  }

  // Состояние загрузки
  if (loading) {
    return (
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
        <div className="bg-dark-900/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-dark-600/30">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
            <span className="text-white text-sm">Загрузка компаний и вакансий...</span>
          </div>
        </div>
      </div>
    )
  }

  // Состояние ошибки
  if (error) {
    return (
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
        <div className="w-full max-w-4xl mx-auto text-center">
          <div className="glass rounded-3xl p-8 border border-red-500/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Ошибка загрузки</h2>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadCompaniesAndVacancies}
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
    <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
      <div className="w-full max-w-4xl mx-auto text-center">
        {/* Приветствие */}
        <div className="mb-16">
          <h1 
            className="text-6xl md:text-7xl font-bold text-white mb-8 tracking-tight cursor-pointer select-none"
            onDoubleClick={handleEasterEgg}
            title="🥚"
          >
            AI Собеседование
          </h1>
          
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-dark-600 to-transparent mx-auto mb-8"></div>
          
          <p className="text-dark-400 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto mb-12">
            Система проведет с вами интерактивное собеседование с использованием искусственного интеллекта. 
            Вы сможете рассказать о своих проектах и получить обратную связь от AI-ассистента.
          </p>
        </div>

        {/* Выбор компании */}
        <div className="mb-12">
          <h3 className="text-2xl font-light text-white mb-8">
            Выберите компанию для собеседования
          </h3>
          {companies.length === 0 ? (
            <div className="glass rounded-2xl p-8 border border-dark-600/30">
              <div className="text-center">
                <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                  </svg>
                </div>
                <h4 className="text-xl text-white mb-2">Нет доступных компаний</h4>
                <p className="text-dark-400">В данный момент нет компаний с открытыми вакансиями</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center flex-wrap gap-6">
              {companies.map((company) => (
                <div
                  key={company._id}
                  onClick={() => handleCompanySelect(company._id)}
                  className={`cursor-pointer p-6 glass rounded-2xl border transition-all duration-300 hover:scale-105 ${
                    selectedCompany === company._id
                      ? 'border-accent-blue shadow-lg shadow-accent-blue/20'
                      : 'border-dark-600/30 hover:border-dark-500/50'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-4">
                    <img
                      src={company.avatar}
                      alt={company.company_name}
                      className="w-16 h-16 object-cover rounded-xl"
                      onError={(e) => {
                        // Заглушка на случай отсутствия картинки
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4KPHA+aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMMTAgMTQuMTdsNy41OS03LjU5TDE5IDhsLTkgOXoiLz4KPC9zdmc+Cjwvc3ZnPgo='
                      }}
                    />
                    <div className="text-center">
                      <span className="text-white font-medium block">{company.company_name}</span>
                      <span className="text-dark-400 text-sm">{company.vacancies.length} {company.vacancies.length === 1 ? 'вакансия' : 'вакансии'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Выбор вакансии */}
        {showVacancies && selectedCompany && (
          <div className="mb-12 animate-slide-down">
            <h3 className="text-2xl font-light text-white mb-8 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
              Выберите вакансию в {getSelectedCompanyData()?.company_name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
              {getSelectedCompanyData()?.vacancies.map((vacancy, index) => (
                <div
                  key={`${selectedCompany}-${vacancy._id}`}
                  onClick={() => handleVacancyDetailsOpen(vacancy)}
                  className={`cursor-pointer p-4 glass rounded-xl border transition-all duration-300 hover:scale-105 animate-stagger-fade-in relative ${
                    selectedVacancy === vacancy._id
                      ? 'border-accent-purple shadow-lg shadow-accent-purple/20'
                      : 'border-dark-600/30 hover:border-dark-500/50'
                  }`}
                  style={{
                    animationDelay: `${0.2 + index * 0.1}s`
                  }}
                >
                  <div className="text-center">
                    <h4 className="text-white font-medium text-lg mb-2">{vacancy.title}</h4>
                    <div className="mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getGradeColor(vacancy.grade)}`}>
                        {vacancy.grade}
                      </span>
                    </div>
                    <p className="text-dark-400 text-sm mb-2">{vacancy.work_field}</p>
                    
                    {vacancy.work_address && (
                      <div className="mb-2">
                        <div className="flex items-center justify-center space-x-1 text-dark-500 text-xs">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9C19,5.13 15.87,2 12,2M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5Z"/>
                          </svg>
                          <span>{vacancy.work_address}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-dark-500 text-xs mb-3">
                      {vacancy.min_experience === vacancy.max_experience 
                        ? `${vacancy.min_experience} ${vacancy.min_experience === 1 ? 'год' : 'лет'} опыта`
                        : `${vacancy.min_experience}-${vacancy.max_experience} лет опыта`
                      }
                    </div>
                    {vacancy.required_skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 justify-center relative">
                        {vacancy.required_skills.slice(0, 3).map((skill, skillIndex) => (
                          <span key={skillIndex} className="px-2 py-1 bg-dark-700/50 text-dark-300 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                        {vacancy.required_skills.length > 3 && (
                          <div className="relative">
                            <span 
                              className="px-2 py-1 bg-dark-700/50 text-dark-300 text-xs rounded cursor-help hover:bg-dark-600/50 transition-colors"
                              onMouseEnter={() => setHoveredSkills({
                                vacancyId: vacancy._id,
                                skills: vacancy.required_skills.slice(3)
                              })}
                              onMouseLeave={() => setHoveredSkills(null)}
                            >
                              +{vacancy.required_skills.length - 3}
                            </span>
                            {hoveredSkills && hoveredSkills.vacancyId === vacancy._id && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-max animate-fade-in">
                                <div className="flex flex-wrap gap-1 max-w-48">
                                  {hoveredSkills.skills.map((hiddenSkill, hiddenIndex) => (
                                    <span key={hiddenIndex} className="px-2 py-1 bg-dark-700/70 text-dark-200 text-xs rounded whitespace-nowrap">
                                      {hiddenSkill}
                                    </span>
                                  ))}
                                </div>
                                {/* Стрелочка вниз */}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-dark-800"></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка начала */}
        <div>
          <button
            onClick={handleStartInterview}
            disabled={!selectedCompany || !selectedVacancy}
            className={`group relative px-12 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 overflow-hidden ${
              selectedCompany && selectedVacancy
                ? 'bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white hover:scale-105 hover:shadow-xl hover:shadow-accent-blue/20'
                : 'bg-dark-700/50 text-dark-500 cursor-not-allowed'
            }`}
          >
            <div className="relative z-10 flex items-center space-x-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span>Начать собеседование</span>
            </div>
            {selectedCompany && selectedVacancy && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
            )}
          </button>
          {!selectedCompany ? (
            <p className="text-dark-500 text-sm mt-3">Выберите компанию для продолжения</p>
          ) : !selectedVacancy && showVacancies ? (
            <p className="text-dark-500 text-sm mt-3">Выберите вакансию для продолжения</p>
          ) : !showVacancies && selectedCompany ? (
            <p className="text-dark-500 text-sm mt-3">Нажмите на компанию еще раз для выбора вакансии</p>
          ) : null}
        </div>
      </div>

      {/* Модальное окно с деталями вакансии */}
      {showVacancyDetails && selectedVacancyDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-24">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleVacancyDetailsClose}
          ></div>
          <div className="relative glass rounded-3xl max-w-2xl w-full max-h-[80vh] border border-dark-600/30 overflow-hidden">
            <div className="p-6 overflow-y-auto max-h-[80vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Детали вакансии
              </h2>
              <button
                onClick={handleVacancyDetailsClose}
                className="w-8 h-8 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Заголовок и уровень */}
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">{selectedVacancyDetails.title}</h3>
                <div className="flex items-center space-x-2 mb-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getGradeColor(selectedVacancyDetails.grade)}`}>
                    {selectedVacancyDetails.grade}
                  </span>
                  <span className="text-dark-400">
                    {selectedVacancyDetails.min_experience === selectedVacancyDetails.max_experience 
                      ? `${selectedVacancyDetails.min_experience} ${selectedVacancyDetails.min_experience === 1 ? 'год' : 'лет'} опыта`
                      : `${selectedVacancyDetails.min_experience}-${selectedVacancyDetails.max_experience} лет опыта`
                    }
                  </span>
                </div>
              </div>

              {/* Сфера деятельности */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">Сфера деятельности</h4>
                <p className="text-dark-300">{selectedVacancyDetails.work_field}</p>
              </div>

              {/* Адрес работы */}
              {selectedVacancyDetails.work_address && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Адрес работы</h4>
                  <div className="flex items-center space-x-2 text-dark-300">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9C19,5.13 15.87,2 12,2M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5Z"/>
                    </svg>
                    <span>{selectedVacancyDetails.work_address}</span>
                  </div>
                </div>
              )}

              {/* Описание */}
              {selectedVacancyDetails.description && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Описание</h4>
                  <p className="text-dark-300 leading-relaxed">{selectedVacancyDetails.description}</p>
                </div>
              )}

              {/* Обязательные навыки */}
              {selectedVacancyDetails.required_skills.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Обязательные навыки</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedVacancyDetails.required_skills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-accent-blue/20 text-accent-blue text-sm rounded-lg border border-accent-blue/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Дополнительные навыки */}
              {selectedVacancyDetails.optional_skills && selectedVacancyDetails.optional_skills.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Дополнительные навыки</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedVacancyDetails.optional_skills.map((skill, index) => (
                      <span key={index} className="px-3 py-1 bg-dark-700/50 text-dark-300 text-sm rounded-lg border border-dark-600/50">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Блок проверки резюме */}
            {!resumeChecked && (
              <div className="mt-8 p-4 bg-dark-800/30 rounded-xl border border-dark-600/30">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-white mb-2">Проверка соответствия</h4>
                  <p className="text-dark-300 text-sm mb-4">
                    Для участия в отборе необходимо проверить соответствие вашего резюме требованиям вакансии
                  </p>
                  <button
                    onClick={handleCheckResume}
                    disabled={isCheckingResume}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                      isCheckingResume 
                        ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                        : 'bg-orange-500 hover:bg-orange-600 text-white hover:scale-105'
                    }`}
                  >
                    {isCheckingResume ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                        <span>Проверяем резюме...</span>
                      </div>
                    ) : (
                      'Проверить резюме'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Результат проверки резюме */}
            {resumeChecked && resumeCheckResult && (
              <div className="mt-8 p-4 bg-dark-800/30 rounded-xl border border-dark-600/30">
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-white mb-2">Результат проверки</h4>
                  <div className="mb-4">
                    <div className={`text-3xl font-bold mb-2 ${
                      resumeCheckResult.can_proceed ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {Math.round(resumeCheckResult.resume_score)}%
                    </div>
                    <p className={`text-sm ${
                      resumeCheckResult.can_proceed ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {resumeCheckResult.message}
                    </p>
                  </div>
                  
                  {!resumeCheckResult.can_proceed && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                      <p className="text-red-300 text-sm">
                        К сожалению, ваше резюме не достаточно соответствует требованиям данной вакансии. 
                        Попробуйте подать заявку на другие вакансии или обновите резюме.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Сообщение об ошибке */}
            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Кнопки действий */}
            <div className="flex space-x-4 mt-8">
              <button
                onClick={handleVacancyDetailsClose}
                className="flex-1 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300"
              >
                Закрыть
              </button>
              
              {/* Кнопка "Выбрать вакансию" доступна только после успешной проверки резюме */}
              <button
                onClick={() => {
                  handleVacancySelect(selectedVacancyDetails._id)
                  handleVacancyDetailsClose()
                }}
                disabled={!resumeChecked || (resumeCheckResult ? !resumeCheckResult.can_proceed : false)}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  resumeChecked && resumeCheckResult?.can_proceed
                    ? 'bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white hover:scale-105'
                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                }`}
              >
                Выбрать эту вакансию
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Пасхалка */}
      {showEasterEgg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="glass rounded-3xl p-12 border border-accent-blue/50 shadow-2xl animate-fade-in-scale">
            <div className="text-center">
              <div className="text-6xl mb-6">🚗💼</div>
              <h3 className="text-3xl font-bold text-white mb-3">
                AIHR
              </h3>
              <p className="text-accent-blue text-xl font-medium">
                ловит даже на парковке
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WelcomeScreen
