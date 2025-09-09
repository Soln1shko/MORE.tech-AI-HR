import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopPanel from '../components/TopPanel'
import { getAllCompanies, getAllVacancies, VacancyData, CompanyFromBackend, getAllCompaniesWithProfiles, CompanyProfileData } from '../services/api'

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
  company_name?: string
}

const VacanciesListPage: React.FC = () => {
  const navigate = useNavigate()
  
  // Состояние переключателя между вакансиями и компаниями
  const [viewMode, setViewMode] = useState<'vacancies' | 'companies'>('vacancies')
  
  // Состояния для вакансий
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [filteredVacancies, setFilteredVacancies] = useState<Vacancy[]>([])
  
  // Состояния для компаний
  const [companies, setCompanies] = useState<CompanyFromBackend[]>([])
  const [companyProfiles, setCompanyProfiles] = useState<Record<string, Partial<CompanyProfileData>>>({})
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyFromBackend[]>([])
  const [companyAvatars, setCompanyAvatars] = useState<Record<string, string>>({})
  
  // Общие состояния
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Состояния для модального окна с деталями вакансии
  const [showVacancyDetails, setShowVacancyDetails] = useState(false)
  const [selectedVacancyDetails, setSelectedVacancyDetails] = useState<Vacancy | null>(null)
  const [companyAvatar, setCompanyAvatar] = useState<string>('')
  
  // Состояния для модального окна с деталями компании
  const [showCompanyDetails, setShowCompanyDetails] = useState(false)
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<{company: CompanyFromBackend, profile: Partial<CompanyProfileData>} | null>(null)
  
  // Состояния для фильтров
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [selectedWorkField, setSelectedWorkField] = useState<string>('all')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [selectedExperience, setSelectedExperience] = useState<string>('all')
  const [selectedCity, setSelectedCity] = useState<string>('all')
  
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

  useEffect(() => {
    if (viewMode === 'vacancies') {
      loadVacancies()
    } else {
      loadCompanies()
    }
  }, [viewMode])

  useEffect(() => {
    if (viewMode === 'vacancies') {
      filterVacancies()
    } else {
      filterCompanies()
    }
  }, [searchQuery, vacancies, companies, selectedCompany, selectedWorkField, selectedGrade, selectedExperience, selectedCity, viewMode])

  const loadVacancies = async () => {
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

      const companiesData: CompanyFromBackend[] = companiesResponse.data.companies || []
      const vacanciesData: VacancyData[] = vacanciesResponse.data.vacancies || []

      // Объединяем данные вакансий с названиями компаний и фильтруем корректные
      const vacanciesWithCompanies = vacanciesData
        .filter(vacancy => vacancy._id && vacancy.company_id) // Фильтруем вакансии с обязательными полями
        .map(vacancy => {
          const company = companiesData.find(comp => comp._id === vacancy.company_id)
          return {
            _id: vacancy._id!,
            title: vacancy.title,
            grade: vacancy.grade,
            required_skills: vacancy.required_skills,
            min_experience: vacancy.min_experience,
            max_experience: vacancy.max_experience,
            work_field: vacancy.work_field,
            work_address: vacancy.work_address,
            company_id: vacancy.company_id!,
            description: vacancy.description,
            optional_skills: vacancy.optional_skills,
            company_name: company?.company_name || 'Неизвестная компания'
          }
        })

      setVacancies(vacanciesWithCompanies)
    } catch (err) {
      setError('Ошибка при загрузке данных')
      console.error('Ошибка загрузки:', err)
    } finally {
      setLoading(false)
    }
  }

  const filterVacancies = () => {
    let filtered = vacancies

    // Фильтр по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(vacancy => 
        vacancy.title.toLowerCase().includes(query) ||
        vacancy.company_name?.toLowerCase().includes(query) ||
        vacancy.work_field.toLowerCase().includes(query) ||
        vacancy.grade.toLowerCase().includes(query) ||
        vacancy.required_skills.some(skill => skill.toLowerCase().includes(query)) ||
        vacancy.optional_skills?.some(skill => skill.toLowerCase().includes(query))
      )
    }

    // Фильтр по компании
    if (selectedCompany !== 'all') {
      filtered = filtered.filter(vacancy => vacancy.company_id === selectedCompany)
    }

    // Фильтр по сфере деятельности
    if (selectedWorkField !== 'all') {
      filtered = filtered.filter(vacancy => vacancy.work_field === selectedWorkField)
    }

    // Фильтр по уровню
    if (selectedGrade !== 'all') {
      filtered = filtered.filter(vacancy => vacancy.grade === selectedGrade)
    }

    // Фильтр по стажу
    if (selectedExperience !== 'all') {
      filtered = filtered.filter(vacancy => {
        const experience = selectedExperience
        if (experience === '0-1') return vacancy.min_experience <= 1
        if (experience === '1-3') return vacancy.min_experience >= 1 && vacancy.max_experience <= 3
        if (experience === '3-5') return vacancy.min_experience >= 3 && vacancy.max_experience <= 5
        if (experience === '5+') return vacancy.min_experience >= 5
        return true
      })
    }

    // Фильтр по городу
    if (selectedCity !== 'all') {
      filtered = filtered.filter(vacancy => {
        if (!vacancy.work_address) return false
        // Извлекаем город из адреса и сравниваем с выбранным
        const cityPart = vacancy.work_address.split(',')[0]?.trim()
        let city = cityPart
        if (cityPart?.startsWith('г. ')) {
          city = cityPart.substring(3) // Убираем "г. "
        }
        return city?.toLowerCase() === selectedCity.toLowerCase()
      })
    }

    setFilteredVacancies(filtered)
  }

  const loadCompanies = async () => {
    try {
      setLoading(true)
      setError('')

      const { companies: companiesData, profiles } = await getAllCompaniesWithProfiles()
      setCompanies(companiesData)
      setCompanyProfiles(profiles)

      // Загружаем аватарки для всех компаний
      const avatars: Record<string, string> = {}
      await Promise.all(
        companiesData.map(async (company) => {
          if (company.company_name) {
            const avatar = await getCompanyAvatar(company.company_name)
            avatars[company._id] = avatar
          }
        })
      )
      setCompanyAvatars(avatars)
    } catch (err) {
      setError('Ошибка при загрузке компаний')
      console.error('Ошибка загрузки компаний:', err)
    } finally {
      setLoading(false)
    }
  }

  const filterCompanies = () => {
    let filtered = companies

    // Фильтр по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(company => {
        const profile = companyProfiles[company._id]
        return (
          company.company_name?.toLowerCase().includes(query) ||
          profile?.basic_info?.industry?.toLowerCase().includes(query) ||
          profile?.detailed_description?.about_company?.toLowerCase().includes(query) ||
          profile?.contact_info?.city?.toLowerCase().includes(query) ||
          profile?.additional_info?.specializations?.some(spec => 
            spec.toLowerCase().includes(query)
          )
        )
      })
    }

    // Дополнительные фильтры для компаний можно добавить здесь
    // Например, фильтр по отрасли, размеру компании и т.д.

    setFilteredCompanies(filtered)
  }

  const handleVacancyClick = async (vacancy: Vacancy) => {
    // Открываем модальное окно с деталями вакансии
    setSelectedVacancyDetails(vacancy)
    setShowVacancyDetails(true)
    
    // Загружаем аватарку компании
    if (vacancy.company_name) {
      const avatar = await getCompanyAvatar(vacancy.company_name)
      setCompanyAvatar(avatar)
    }
  }

  const handleCompanyClick = async (company: CompanyFromBackend) => {
    // Открываем модальное окно с деталями компании
    const profile = companyProfiles[company._id]
    setSelectedCompanyDetails({ company, profile })
    setShowCompanyDetails(true)

    // Загружаем аватарку компании
    if (company.company_name) {
      const avatar = await getCompanyAvatar(company.company_name)
      setCompanyAvatar(avatar)
    }
  }

  const handleVacancyDetailsClose = () => {
    setShowVacancyDetails(false)
    setSelectedVacancyDetails(null)
  }

  const handleStartInterview = () => {
    if (selectedVacancyDetails) {
      // Переходим на WelcomeScreen с параметрами компании и вакансии
      navigate(`/welcomescreen?company=${selectedVacancyDetails.company_id}&vacancy=${selectedVacancyDetails._id}`)
    }
  }

  const handleFiltersModalClose = () => {
    setShowFiltersModal(false)
  }

  const handleResetFilters = () => {
    setSelectedCompany('all')
    setSelectedWorkField('all')
    setSelectedGrade('all')
    setSelectedExperience('all')
    setSelectedCity('all')
  }

  const getUniqueValues = (field: keyof Vacancy) => {
    const values = vacancies.map(vacancy => vacancy[field]).filter(Boolean)
    return Array.from(new Set(values))
  }

  const getUniqueCities = () => {
    const cities = vacancies
      .map(vacancy => vacancy.work_address)
      .filter(Boolean)
      .map(address => {
        // Извлекаем город из адреса формата "г. Москва, 3-й Крутицкий пер., 11"
        // Берем первую часть до запятой и убираем "г." если есть
        const cityPart = address?.split(',')[0]?.trim()
        if (cityPart?.startsWith('г. ')) {
          return cityPart.substring(3) // Убираем "г. "
        }
        return cityPart
      })
      .filter(Boolean)
    
    return Array.from(new Set(cities))
  }

  const handleLogoClick = () => {
    // При клике на логотип переходим на главную страницу (WelcomeScreen)
    console.log('Logo clicked, navigating to /welcomescreen')
    navigate('/welcomescreen')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        {/* Фоновые элементы */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute top-1/4 -left-48 w-96 h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 30%, rgba(59, 130, 246, 0.01) 60%, transparent 100%)',
              filter: 'blur(60px)'
            }}
          ></div>
          <div 
            className="absolute bottom-1/4 -right-48 w-96 h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.03) 30%, rgba(139, 92, 246, 0.008) 60%, transparent 100%)',
              filter: 'blur(60px)'
            }}
          ></div>
          <div 
            className="absolute top-3/4 left-1/3 w-64 h-64 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.02) 30%, rgba(16, 185, 129, 0.005) 60%, transparent 100%)',
              filter: 'blur(50px)'
            }}
          ></div>
        </div>

        <TopPanel onLogoClick={handleLogoClick} />
        
        <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
          <div className="bg-dark-900/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-dark-600/30">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
              <span className="text-white text-sm">Загрузка вакансий...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        {/* Фоновые элементы */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute top-1/4 -left-48 w-96 h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 30%, rgba(59, 130, 246, 0.01) 60%, transparent 100%)',
              filter: 'blur(60px)'
            }}
          ></div>
          <div 
            className="absolute bottom-1/4 -right-48 w-96 h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.03) 30%, rgba(139, 92, 246, 0.008) 60%, transparent 100%)',
              filter: 'blur(60px)'
            }}
          ></div>
          <div 
            className="absolute top-3/4 left-1/3 w-64 h-64 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.02) 30%, rgba(16, 185, 129, 0.005) 60%, transparent 100%)',
              filter: 'blur(50px)'
            }}
          ></div>
        </div>

        <TopPanel onLogoClick={handleLogoClick} />
        
        <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
          <div className="w-full max-w-6xl mx-auto text-center">
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
                  onClick={loadVacancies}
                  className="px-6 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl font-medium transition-colors"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute top-1/4 -left-48 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 30%, rgba(59, 130, 246, 0.01) 60%, transparent 100%)',
            filter: 'blur(60px)'
          }}
        ></div>
        <div 
          className="absolute bottom-1/4 -right-48 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.03) 30%, rgba(139, 92, 246, 0.008) 60%, transparent 100%)',
            filter: 'blur(60px)'
          }}
        ></div>
        <div 
          className="absolute top-3/4 left-1/3 w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.02) 30%, rgba(16, 185, 129, 0.005) 60%, transparent 100%)',
            filter: 'blur(50px)'
          }}
        ></div>
      </div>

      <TopPanel onLogoClick={handleLogoClick} />
      
      <div className="relative z-10 pt-36 pb-20 px-6">
        <div className="w-full max-w-6xl mx-auto">
          {/* Заголовок с переключателем */}
          <div className="mb-10">
            <div className="flex items-center justify-between">
              <h1 className="text-5xl font-bold text-white tracking-tight">
                {viewMode === 'vacancies' ? 'Все вакансии' : 'Профили компаний'}
              </h1>
              
              {/* Переключатель между вакансиями и компаниями */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('vacancies')}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                    viewMode === 'vacancies'
                      ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/25'
                      : 'bg-dark-800/50 text-dark-300 hover:bg-dark-700/50 hover:text-white border border-dark-600/50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3,5H21V7H3V5M3,13V11H21V13H3M3,19V17H21V19H3Z"/>
                    </svg>
                    <span>Вакансии</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setViewMode('companies')}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                    viewMode === 'companies'
                      ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/25'
                      : 'bg-dark-800/50 text-dark-300 hover:bg-dark-700/50 hover:text-white border border-dark-600/50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,7V3H2V21H22V7H12M6,19H4V17H6V19M6,15H4V13H6V15M6,11H4V9H6V11M6,7H4V5H6V7M10,19H8V17H10V19M10,15H8V13H10V15M10,11H8V9H10V11M10,7H8V5H10V7M20,19H12V17H20V19M20,15H12V13H20V15M20,11H12V9H20V11Z"/>
                    </svg>
                    <span>Компании</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Поле поиска и фильтры */}
          <div className="mb-12">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={viewMode === 'vacancies' ? "Поиск вакансий..." : "Поиск компаний..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-800/70 border border-dark-600/50 rounded-xl text-white text-base placeholder-dark-400 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 focus:bg-dark-800 transition-all duration-200 shadow-lg"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 hover:text-white transition-colors"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Кнопка фильтров - с тем же расстоянием что и между кнопками */}
              <button
                onClick={() => setShowFiltersModal(true)}
                className="px-6 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white hover:bg-dark-700/50 hover:border-dark-500/50 transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z"/>
                </svg>
                <span>Фильтры</span>
              </button>
            </div>
          </div>

          {/* Список вакансий или компаний */}
          <div className="space-y-6">
            {viewMode === 'vacancies' ? (
              // Список вакансий
              filteredVacancies.length === 0 ? (
                <div className="glass rounded-3xl p-8 border border-dark-600/30">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                      </svg>
                    </div>
                    <h3 className="text-xl text-white mb-2">Вакансии не найдены</h3>
                    <p className="text-dark-400">Попробуйте изменить параметры поиска</p>
                  </div>
                </div>
              ) : (
                filteredVacancies.map((vacancy, index) => (
                <div
                  key={vacancy._id}
                  onClick={() => handleVacancyClick(vacancy)}
                  className="cursor-pointer glass rounded-2xl p-6 border border-dark-600/30 hover:border-accent-blue/50 transition-all duration-300 hover:scale-105 group animate-stagger-fade-in text-left"
                  style={{
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-xl font-semibold text-white group-hover:text-accent-blue transition-colors">
                          {vacancy.title}
                        </h3>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getGradeColor(vacancy.grade)}`}>
                          {vacancy.grade}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 mb-4">
                        <span className="text-dark-300 font-medium">{vacancy.company_name}</span>
                        <span className="text-dark-500">•</span>
                        <span className="text-dark-400">{vacancy.work_field}</span>
                        <span className="text-dark-500">•</span>
                        <span className="text-dark-400">
                          {vacancy.min_experience === vacancy.max_experience 
                            ? `${vacancy.min_experience} ${vacancy.min_experience === 1 ? 'год' : 'лет'} опыта`
                            : `${vacancy.min_experience}-${vacancy.max_experience} лет опыта`
                          }
                        </span>
                      </div>

                      {vacancy.work_address && (
                        <div className="mb-4">
                          <div className="flex items-center space-x-2 text-dark-500 text-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9C19,5.13 15.87,2 12,2M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5Z"/>
                            </svg>
                            <span>{vacancy.work_address}</span>
                          </div>
                        </div>
                      )}

                      {vacancy.description && (
                        <p className="text-dark-300 mb-4 leading-relaxed line-clamp-2">{vacancy.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {vacancy.required_skills.slice(0, 5).map((skill, skillIndex) => (
                          <span key={skillIndex} className="px-3 py-1 bg-dark-700/50 text-dark-300 text-sm rounded-lg">
                            {skill}
                          </span>
                        ))}
                        {vacancy.required_skills.length > 5 && (
                          <span className="px-3 py-1 bg-dark-700/50 text-dark-300 text-sm rounded-lg">
                            +{vacancy.required_skills.length - 5}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-6 flex-shrink-0">
                      <div className="w-10 h-10 bg-accent-blue/20 rounded-full flex items-center justify-center group-hover:bg-accent-blue/30 transition-colors">
                        <svg className="w-5 h-5 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                ))
              )
            ) : (
              // Список компаний
              filteredCompanies.length === 0 ? (
                <div className="glass rounded-3xl p-8 border border-dark-600/30">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,7V3H2V21H22V7H12M6,19H4V17H6V19M6,15H4V13H6V15M6,11H4V9H6V11M6,7H4V5H6V7M10,19H8V17H10V19M10,15H8V13H10V15M10,11H8V9H10V11M10,7H8V5H10V7M20,19H12V17H20V19M20,15H12V13H20V15M20,11H12V9H20V11Z"/>
                      </svg>
                    </div>
                    <h3 className="text-xl text-white mb-2">Компании не найдены</h3>
                    <p className="text-dark-400">Попробуйте изменить параметры поиска</p>
                  </div>
                </div>
              ) : (
                filteredCompanies.map((company, index) => {
                  const profile = companyProfiles[company._id]
                  return (
                    <div
                      key={company._id}
                      onClick={() => handleCompanyClick(company)}
                      className="cursor-pointer glass rounded-2xl p-6 border border-dark-600/30 hover:border-accent-blue/50 transition-all duration-300 hover:scale-105 group animate-stagger-fade-in text-left"
                      style={{
                        animationDelay: `${index * 0.1}s`
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4 mb-4">
                            <img
                              src={companyAvatars[company._id] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4KPHA+aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMMTAgMTQuMTdsNy41OS03LjU5TDE5IDhsLTkgOXoiLz4KPC9zdmc+Cjwvc3ZnPgo='}
                              alt={company.company_name}
                              className="w-12 h-12 object-cover rounded-xl border border-dark-600/50"
                              onError={(e) => {
                                // Заглушка на случай отсутствия картинки
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4KPHA+aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMMTAgMTQuMTdsNy41OS03LjU5TDE5IDhsLTkgOXoiLz4KPC9zdmc+Cjwvc3ZnPgo='
                              }}
                            />
                            <div>
                              <h3 className="text-xl font-semibold text-white group-hover:text-accent-blue transition-colors">
                                {company.company_name}
                              </h3>
                              {profile?.basic_info?.is_it_accredited && (
                                <span className="inline-flex items-center px-2 py-1 bg-accent-blue/20 text-accent-blue rounded-full text-xs font-medium border border-accent-blue/30 mt-1">
                                  ✓ Аккредитованная IT-компания
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4 mb-4 text-sm">
                            {profile?.basic_info?.industry && (
                              <>
                                <span className="text-dark-300 font-medium">{profile.basic_info.industry}</span>
                                <span className="text-dark-500">•</span>
                              </>
                            )}
                            {profile?.detailed_description?.team_size && (
                              <>
                                <span className="text-dark-400">{profile.detailed_description.team_size}</span>
                                <span className="text-dark-500">•</span>
                              </>
                            )}
                            {profile?.contact_info?.city && (
                              <span className="text-dark-400">{profile.contact_info.city}</span>
                            )}
                          </div>

                          {profile?.detailed_description?.about_company && (
                            <p className="text-dark-300 mb-4 leading-relaxed line-clamp-2">
                              {profile.detailed_description.about_company}
                            </p>
                          )}

                          {profile?.additional_info?.specializations && profile.additional_info.specializations.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {profile.additional_info.specializations.slice(0, 5).map((spec, specIndex) => (
                                <span key={specIndex} className="px-3 py-1 bg-dark-700/50 text-dark-300 text-sm rounded-lg">
                                  {spec}
                                </span>
                              ))}
                              {profile.additional_info.specializations.length > 5 && (
                                <span className="px-3 py-1 bg-dark-700/50 text-dark-300 text-sm rounded-lg">
                                  +{profile.additional_info.specializations.length - 5}
                                </span>
                              )}
                            </div>
                          )}

                          {profile?.benefits && profile.benefits.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {profile.benefits.slice(0, 3).map((benefit, benefitIndex) => (
                                <span key={benefitIndex} className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                                  ✓ {benefit}
                                </span>
                              ))}
                              {profile.benefits.length > 3 && (
                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                                  +{profile.benefits.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="ml-6 flex-shrink-0">
                          <div className="w-10 h-10 bg-accent-blue/20 rounded-full flex items-center justify-center group-hover:bg-accent-blue/30 transition-colors">
                            <svg className="w-5 h-5 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно с деталями вакансии */}
      {showVacancyDetails && selectedVacancyDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleVacancyDetailsClose}
          ></div>
          <div className="relative glass rounded-3xl max-w-5xl w-full max-h-[90vh] border border-dark-600/30 overflow-hidden">
            <div className="p-8 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Детали вакансии
              </h2>
              
              {/* Название компании с аватаркой */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <img 
                    src={companyAvatar} 
                    alt="Аватар компании"
                    className="w-8 h-8 rounded-full object-cover border border-dark-600/50"
                  />
                  <span className="text-white font-medium text-lg">
                    {selectedVacancyDetails.company_name}
                  </span>
                </div>
                
                <button
                  onClick={handleVacancyDetailsClose}
                  className="w-8 h-8 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                </button>
              </div>
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

            {/* Кнопки действий */}
            <div className="flex space-x-4 mt-8">
              <button
                onClick={handleVacancyDetailsClose}
                className="flex-1 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300"
              >
                Закрыть
              </button>
              
              {/* Кнопка "Перейти" всегда доступна */}
              <button
                onClick={handleStartInterview}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white hover:scale-105 rounded-xl font-medium transition-all duration-300"
              >
                Перейти
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно с фильтрами */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleFiltersModalClose}
          ></div>
          <div className="relative glass rounded-3xl max-w-2xl w-full max-h-[80vh] border border-dark-600/30 overflow-hidden">
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Фильтры
                </h2>
                <button
                  onClick={handleFiltersModalClose}
                  className="w-8 h-8 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Фильтр по компании */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Компания</h4>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="w-full px-4 py-3 pr-8 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 appearance-none bg-no-repeat bg-[length:16px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                    style={{ backgroundPosition: 'calc(100% - 12px) center' }}
                  >
                    <option value="all" className="bg-dark-800">Все компании</option>
                    {getUniqueValues('company_name').map((companyName, index) => (
                      <option key={`company-${index}`} value={vacancies.find(v => v.company_name === companyName)?.company_id} className="bg-dark-800">
                        {companyName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Фильтр по сфере деятельности */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Сфера деятельности</h4>
                  <select
                    value={selectedWorkField}
                    onChange={(e) => setSelectedWorkField(e.target.value)}
                    className="w-full px-4 py-3 pr-8 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 appearance-none bg-no-repeat bg-[length:16px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                    style={{ backgroundPosition: 'calc(100% - 12px) center' }}
                  >
                    <option value="all" className="bg-dark-800">Все сферы</option>
                    {getUniqueValues('work_field').map((workField, index) => (
                      <option key={`workfield-${index}`} value={workField} className="bg-dark-800">
                        {workField}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Фильтр по уровню */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Уровень</h4>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full px-4 py-3 pr-8 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 appearance-none bg-no-repeat bg-[length:16px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                    style={{ backgroundPosition: 'calc(100% - 12px) center' }}
                  >
                    <option value="all" className="bg-dark-800">Все уровни</option>
                    {getUniqueValues('grade').map((grade, index) => (
                      <option key={`grade-${index}`} value={grade} className="bg-dark-800">
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Фильтр по стажу */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Стаж работы</h4>
                  <select
                    value={selectedExperience}
                    onChange={(e) => setSelectedExperience(e.target.value)}
                    className="w-full px-4 py-3 pr-8 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 appearance-none bg-no-repeat bg-[length:16px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                    style={{ backgroundPosition: 'calc(100% - 12px) center' }}
                  >
                    <option value="all" className="bg-dark-800">Любой стаж</option>
                    <option value="0-1" className="bg-dark-800">0-1 год</option>
                    <option value="1-3" className="bg-dark-800">1-3 года</option>
                    <option value="3-5" className="bg-dark-800">3-5 лет</option>
                    <option value="5+" className="bg-dark-800">5+ лет</option>
                  </select>
                </div>

                {/* Фильтр по городу */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Город</h4>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-4 py-3 pr-8 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 appearance-none bg-no-repeat bg-[length:16px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                    style={{ backgroundPosition: 'calc(100% - 12px) center' }}
                  >
                    <option value="all" className="bg-dark-800">Все города</option>
                    {getUniqueCities().map((city) => (
                      <option key={city} value={city} className="bg-dark-800">
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="flex space-x-4 mt-8">
                <button
                  onClick={handleResetFilters}
                  className="flex-1 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300"
                >
                  Сбросить
                </button>
                
                <button
                  onClick={handleFiltersModalClose}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white hover:scale-105 rounded-xl font-medium transition-all duration-300"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно с деталями компании */}
      {showCompanyDetails && selectedCompanyDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCompanyDetails(false)}
          ></div>
          <div className="relative glass rounded-3xl max-w-7xl w-full max-h-[95vh] border border-dark-600/30 overflow-hidden">
            <div className="p-10 overflow-y-auto max-h-[95vh]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Профиль компании
                </h2>
                
                <button
                  onClick={() => setShowCompanyDetails(false)}
                  className="w-8 h-8 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                </button>
              </div>
              
              <div className="space-y-8">
                {/* Основная информация */}
                <div>
                  <div className="flex items-center space-x-4 mb-6">
                    <img
                      src={companyAvatars[selectedCompanyDetails.company._id] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4KPHA+aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMMTAgMTQuMTdsNy1NS03LjU5TDE5IDhsLTkgOXoiLz4KPC9zdmc+Cjwvc3ZnPgo='}
                      alt={selectedCompanyDetails.company.company_name}
                      className="w-16 h-16 object-cover rounded-2xl border border-dark-600/50"
                      onError={(e) => {
                        // Заглушка на случай отсутствия картинки
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4KPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4KPHA+aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTIgMTVsLTUtNSAxLjQxLTEuNDFMMTAgMTQuMTdsNy-NS03LjU5TDE5IDhsLTkgOXoiLz4KPC9zdmc+Cjwvc3ZnPgo='
                      }}
                    />
                    <div>
                      <h3 className="text-3xl font-bold text-white mb-2">
                        {selectedCompanyDetails.company.company_name}
                      </h3>
                      <div className="flex items-center space-x-4">
                        {selectedCompanyDetails.profile?.basic_info?.industry && (
                          <span className="text-dark-300 font-medium">
                            {selectedCompanyDetails.profile.basic_info.industry}
                          </span>
                        )}
                        {selectedCompanyDetails.profile?.basic_info?.is_it_accredited && (
                          <span className="inline-flex items-center px-3 py-1 bg-accent-blue/20 text-accent-blue rounded-full text-sm font-medium border border-accent-blue/30">
                            ✓ Аккредитованная IT-компания
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* О компании */}
                {selectedCompanyDetails.profile?.detailed_description?.about_company && (
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-3">О компании</h4>
                    <p className="text-dark-300 leading-relaxed">
                      {selectedCompanyDetails.profile.detailed_description.about_company}
                    </p>
                  </div>
                )}

                {/* О команде */}
                {selectedCompanyDetails.profile?.detailed_description?.about_team && (
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-3">О команде</h4>
                    <p className="text-dark-300 leading-relaxed">
                      {selectedCompanyDetails.profile.detailed_description.about_team}
                    </p>
                    {selectedCompanyDetails.profile?.detailed_description?.team_size && (
                      <p className="text-dark-400 mt-2">
                        Размер команды: {selectedCompanyDetails.profile.detailed_description.team_size}
                      </p>
                    )}
                  </div>
                )}

                {/* Корпоративная культура */}
                {selectedCompanyDetails.profile?.detailed_description?.corporate_culture && (
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-3">Корпоративная культура</h4>
                    <p className="text-dark-300 leading-relaxed">
                      {selectedCompanyDetails.profile.detailed_description.corporate_culture}
                    </p>
                  </div>
                )}

                {/* Условия работы */}
                {selectedCompanyDetails.profile?.detailed_description?.work_conditions && (
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-3">Условия работы</h4>
                    <p className="text-dark-300 leading-relaxed">
                      {selectedCompanyDetails.profile.detailed_description.work_conditions}
                    </p>
                  </div>
                )}

                {/* Специализации */}
                {selectedCompanyDetails.profile?.additional_info?.specializations && 
                 selectedCompanyDetails.profile.additional_info.specializations.length > 0 && (
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-3">Специализации</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCompanyDetails.profile.additional_info.specializations.map((spec, index) => (
                        <span key={index} className="px-3 py-2 bg-accent-blue/20 text-accent-blue rounded-xl text-sm border border-accent-blue/30">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Преимущества */}
                {selectedCompanyDetails.profile?.benefits && selectedCompanyDetails.profile.benefits.length > 0 && (
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-3">Преимущества работы</h4>
                    <div className="space-y-2">
                      {selectedCompanyDetails.profile.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                          </svg>
                          <span className="text-dark-300">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Контактная информация */}
                <div>
                  <h4 className="text-xl font-semibold text-white mb-3">Контактная информация</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedCompanyDetails.profile?.contact_info?.email && (
                      <div className="flex items-center space-x-3">
                        <svg className="w-4 h-4 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
                        </svg>
                        <span className="text-dark-300">{selectedCompanyDetails.profile.contact_info.email}</span>
                      </div>
                    )}
                    {selectedCompanyDetails.profile?.contact_info?.phone && (
                      <div className="flex items-center space-x-3">
                        <svg className="w-4 h-4 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z"/>
                        </svg>
                        <span className="text-dark-300">{selectedCompanyDetails.profile.contact_info.phone}</span>
                      </div>
                    )}
                    {selectedCompanyDetails.profile?.basic_info?.website && (
                      <div className="flex items-center space-x-3">
                        <svg className="w-4 h-4 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                        </svg>
                        <a 
                          href={selectedCompanyDetails.profile.basic_info.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-accent-blue hover:underline"
                        >
                          {selectedCompanyDetails.profile.basic_info.website}
                        </a>
                      </div>
                    )}
                    {(selectedCompanyDetails.profile?.contact_info?.city || selectedCompanyDetails.profile?.contact_info?.address) && (
                      <div className="flex items-center space-x-3">
                        <svg className="w-4 h-4 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9C19,5.13 15.87,2 12,2M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5Z"/>
                        </svg>
                        <span className="text-dark-300">
                          {selectedCompanyDetails.profile?.contact_info?.city && selectedCompanyDetails.profile?.contact_info?.address
                            ? `${selectedCompanyDetails.profile.contact_info.city}, ${selectedCompanyDetails.profile.contact_info.address}`
                            : selectedCompanyDetails.profile?.contact_info?.city || selectedCompanyDetails.profile?.contact_info?.address
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Социальные сети */}
                {(selectedCompanyDetails.profile?.social_links?.linkedin || 
                  selectedCompanyDetails.profile?.social_links?.telegram) && (
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-3">Социальные сети</h4>
                    <div className="flex items-center space-x-4">
                      {selectedCompanyDetails.profile?.social_links?.linkedin && (
                        <a 
                          href={selectedCompanyDetails.profile.social_links.linkedin} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 border border-dark-600/50 rounded-xl text-dark-300 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19M18.5 18.5V13.2A3.26 3.26 0 0 0 15.24 9.94C14.39 9.94 13.4 10.46 12.92 11.24V10.13H10.13V18.5H12.92V13.57C12.92 12.8 13.54 12.17 14.31 12.17A1.4 1.4 0 0 1 15.71 13.57V18.5H18.5M6.88 8.56A1.68 1.68 0 0 0 8.56 6.88C8.56 5.95 7.81 5.19 6.88 5.19A1.69 1.69 0 0 0 5.19 6.88C5.19 7.81 5.95 8.56 6.88 8.56M8.27 18.5V10.13H5.5V18.5H8.27Z"/>
                          </svg>
                          <span>LinkedIn</span>
                        </a>
                      )}
                      {selectedCompanyDetails.profile?.social_links?.telegram && (
                        <a 
                          href={`https://t.me/${selectedCompanyDetails.profile.social_links.telegram.replace('@', '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 border border-dark-600/50 rounded-xl text-dark-300 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9.78,18.65L10.06,14.42L17.74,7.5C18.08,7.19 17.67,7.04 17.22,7.31L7.74,13.3L3.64,12C2.76,11.75 2.75,11.14 3.84,10.7L19.81,4.54C20.54,4.21 21.24,4.72 20.96,5.84L18.24,18.65C18.05,19.56 17.5,19.78 16.74,19.36L12.6,16.3L10.61,18.23C10.38,18.46 10.19,18.65 9.78,18.65Z"/>
                          </svg>
                          <span>Telegram</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VacanciesListPage
