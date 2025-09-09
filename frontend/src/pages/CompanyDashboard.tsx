import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TopPanel from '../components/TopPanel'
import { 
  getCompanyProfile, 
  logout, 
  uploadCompanyAvatar,
  createVacancy,
  getCompanyVacancies,
  updateVacancy,
  deleteVacancy,
  uploadVacancyQuestions,
  VacancyData,
  CreateVacancyData
} from '../services/api'

interface CompanyProfile {
  email: string
  company_name: string
  inn: string
  ogrn: string
  legal_address: string
  role: string
}

// Используем интерфейс из API и добавляем локальные поля для UI
interface UIVacancy extends VacancyData {
  questionsFile?: File
  questionsFileName?: string
  description?: string // Поле для описания вакансии (отдельно от work_field)
  work_address?: string // Адрес работы
}

// Интерфейс для структуры вопросов JSON (для будущего использования)
// interface QuestionData {
//   section: string
//   question: string
//   grade: string
//   answers: {
//     expected_answer: string
//     junior_level: string
//     middle_level: string
//     senior_level: string
//     red_flags: string[]
//     follow_up_questions: string[]
//   }
// }

const CompanyDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)

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
  const [error, setError] = useState('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  // Состояние для аватарки
  const [avatar, setAvatar] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  
  // Состояние для вакансий
  const [vacancies, setVacancies] = useState<UIVacancy[]>([])
  const [showVacancyModal, setShowVacancyModal] = useState(false)
  const [editingVacancy, setEditingVacancy] = useState<UIVacancy | null>(null)
  const [newVacancy, setNewVacancy] = useState<UIVacancy>({
    title: '',
    grade: 'junior',
    required_skills: [],
    min_experience: 0,
    max_experience: 5,
    work_field: '',
    work_address: '',
    optional_skills: [],
    description: '',
    questions: []
  })
  
  // Состояние для строковых представлений навыков (для удобного редактирования)
  const [requiredSkillsText, setRequiredSkillsText] = useState('')
  const [optionalSkillsText, setOptionalSkillsText] = useState('')
  
  // Состояние для подтверждения удаления
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [vacancyToDelete, setVacancyToDelete] = useState<UIVacancy | null>(null)

  useEffect(() => {
    loadCompanyProfile()
    loadVacancies()
  }, [])

  // Загружаем аватарку после получения профиля
  useEffect(() => {
    if (profile) {
      console.log('Профиль загружен, проверяем аватарку для:', profile.company_name)
      loadExistingAvatar()
    }
  }, [profile])

  const loadCompanyProfile = async () => {
    try {
      const response = await getCompanyProfile()
      if (response.success) {
        const userData = response.data
        
        // Проверяем роль
        if (userData.role !== 'company') {
          setError('Доступ разрешен только для компаний')
          setTimeout(() => {
            navigate('/welcomescreen')
          }, 2000)
          return
        }
        
        setProfile(userData)
      } else {
        setError(response.error || 'Ошибка загрузки профиля')
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

  const loadVacancies = async () => {
    try {
      const response = await getCompanyVacancies()
      if (response.success && response.data?.vacancies) {
        // Маппим данные из бэкенда в UI формат
        const mappedVacancies: UIVacancy[] = response.data.vacancies.map((vacancy: VacancyData) => ({
          ...vacancy,
          description: vacancy.description || vacancy.work_field, // Используем description или fallback на work_field
          questionsFileName: vacancy.questions && vacancy.questions.length > 0 ? 'questions.json' : undefined
        }))
        setVacancies(mappedVacancies)
      } else {
        console.error('Ошибка загрузки вакансий:', response.error)
      }
    } catch (err) {
      console.error('Ошибка при загрузке вакансий:', err)
    }
  }

  const loadExistingAvatar = async () => {
    // Проверяем существующую аватарку на основе названия компании
    if (profile?.company_name) {
      const formattedName = formatCompanyName(profile.company_name)
      console.log(`Ищем аватарку для: "${profile.company_name}" -> "${formattedName}"`)
      
      // Проверяем несколько возможных расширений
      const extensions = ['png', 'jpg', 'jpeg', 'webp']
      
      for (const ext of extensions) {
        const avatarPath = `/company_avatars/${formattedName}.${ext}`
        console.log(`Проверяем путь: ${avatarPath}`)
        
        try {
          // Создаем промис для проверки изображения
          const imageExists = await new Promise<boolean>((resolve) => {
            const img = new Image()
            img.onload = () => resolve(true)
            img.onerror = () => resolve(false)
            img.src = avatarPath
          })
          
          if (imageExists) {
            setAvatar(avatarPath)
            console.log(`✅ Найдена и загружена аватарка: ${avatarPath}`)
            return
          }
        } catch (error) {
          console.log(`❌ Ошибка при проверке: ${avatarPath}`, error)
        }
      }
      
      console.log(`❌ Аватарка для компании "${profile.company_name}" (${formattedName}) не найдена`)
    }
  }

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

  // Обработка загрузки аватарки
  const handleAvatarUpload = useCallback((file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    
    if (!allowedTypes.includes(file.type)) {
      setError('Поддерживаются только изображения (JPG, PNG, WebP)')
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('Размер файла не должен превышать 5MB')
      return
    }

    setAvatarFile(file)
    
    // Создаем предпросмотр
    const reader = new FileReader()
    reader.onload = (e) => {
      setAvatar(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    setError('')
  }, [])

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleAvatarUpload(file)
    }
  }, [handleAvatarUpload])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleAvatarUpload(file)
    }
  }, [handleAvatarUpload])

  const saveAvatar = async () => {
    if (!avatarFile || !profile) return

    try {
      setError('')
      const response = await uploadCompanyAvatar(avatarFile)
      
      if (response.success) {
        // Обновляем аватарку на новый URL с сервера
        setAvatar(response.data.avatar_url)
        setAvatarFile(null) // Очищаем временный файл
        alert('Аватарка успешно сохранена!')
      } else {
        setError(response.error || 'Ошибка при сохранении аватарки')
      }
    } catch (err) {
      setError('Ошибка при сохранении аватарки')
      console.error('Avatar upload error:', err)
    }
  }

  // Обработка вакансий
  const addVacancy = () => {
    setEditingVacancy(null)
    setNewVacancy({
      title: '',
      grade: 'junior',
      required_skills: [],
      min_experience: 0,
      max_experience: 5,
      work_field: '',
      work_address: '',
      optional_skills: [],
      description: '',
      questions: []
    })
    // Очищаем текстовые поля навыков
    setRequiredSkillsText('')
    setOptionalSkillsText('')
    setShowVacancyModal(true)
  }

  const editVacancy = (vacancy: UIVacancy) => {
    setEditingVacancy(vacancy)
    setNewVacancy({
      ...vacancy,
      description: vacancy.description || vacancy.work_field
    })
    // Заполняем текстовые поля навыков
    setRequiredSkillsText(vacancy.required_skills?.join(', ') || '')
    setOptionalSkillsText(vacancy.optional_skills?.join(', ') || '')
    setShowVacancyModal(true)
  }

  const saveVacancy = async () => {
    if (!newVacancy.title.trim()) {
      setError('Название вакансии обязательно')
      return
    }

    if (!newVacancy.work_field.trim()) {
      setError('Сфера деятельности обязательна')
      return
    }


    try {
      setError('')
      
      // Парсим навыки из текстовых полей
      const requiredSkills = requiredSkillsText
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0)
      
      const optionalSkills = optionalSkillsText
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0)
      
      // Подготавливаем данные для API
      const vacancyData: CreateVacancyData = {
        title: newVacancy.title,
        grade: newVacancy.grade,
        required_skills: requiredSkills,
        min_experience: newVacancy.min_experience,
        max_experience: newVacancy.max_experience,
        work_field: newVacancy.work_field,
        work_address: newVacancy.work_address || '',
        description: newVacancy.description,
        optional_skills: optionalSkills,
        questions: newVacancy.questions || []
      }

      if (editingVacancy && editingVacancy._id) {
        // Редактируем существующую
        const response = await updateVacancy(editingVacancy._id, vacancyData)
        if (response.success) {
          await loadVacancies() // Перезагружаем список
          setShowVacancyModal(false)
          
          // Если есть JSON файл с вопросами, загружаем его
          if (newVacancy.questionsFile) {
            await handleQuestionsUpload(editingVacancy._id, newVacancy.questionsFile)
          }
        } else {
          setError(response.error || 'Ошибка обновления вакансии')
        }
      } else {
        // Создаем новую
        const response = await createVacancy(vacancyData)
        if (response.success) {
          await loadVacancies() // Перезагружаем список
          setShowVacancyModal(false)
          
          // Если есть JSON файл с вопросами, загружаем его
          if (newVacancy.questionsFile && response.data?.vacancy_id) {
            await handleQuestionsUpload(response.data.vacancy_id, newVacancy.questionsFile)
          }
        } else {
          setError(response.error || 'Ошибка создания вакансии')
        }
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
      console.error('Ошибка при сохранении вакансии:', err)
    }
  }

  const handleDeleteVacancy = (vacancy: UIVacancy) => {
    setVacancyToDelete(vacancy)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteVacancy = async () => {
    if (!vacancyToDelete?._id) return
    
    try {
      setError('')
      const response = await deleteVacancy(vacancyToDelete._id)
      if (response.success) {
        await loadVacancies() // Перезагружаем список
        setShowDeleteConfirm(false)
        setVacancyToDelete(null)
      } else {
        setError(response.error || 'Ошибка удаления вакансии')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
      console.error('Ошибка при удалении вакансии:', err)
    }
  }

  const handleQuestionsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/json') {
        setError('Файл должен быть в формате JSON')
        return
      }
      
      setNewVacancy(prev => ({
        ...prev,
        questionsFile: file,
        questionsFileName: file.name
      }))
      setError('')
    }
  }

  const handleQuestionsUpload = async (vacancyId: string, file: File) => {
    try {
      // Читаем содержимое JSON файла
      const fileContent = await file.text()
      const questions = JSON.parse(fileContent)
      
      // Проверяем, что это массив или конвертируем в массив
      const questionsArray = Array.isArray(questions) ? questions : [questions]
      
      // Отправляем на сервер
      const response = await uploadVacancyQuestions(vacancyId, questionsArray)
      if (!response.success) {
        setError(response.error || 'Ошибка загрузки вопросов')
      }
    } catch (err) {
      setError('Ошибка при обработке JSON файла')
      console.error('Ошибка при загрузке вопросов:', err)
    }
  }

  const downloadExampleJSON = () => {
    const link = document.createElement('a')
    link.href = '/question_example.json'
    link.download = 'question_example.json'
    link.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        <TopPanel onLogoClick={handleLogoClick} />
        <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
          <div className="bg-dark-900/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-dark-600/30">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
              <span className="text-white text-sm">Загрузка панели управления...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !profile) {
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
        <div className="w-full max-w-6xl mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Панель управления компании
            </h1>
            <p className="text-dark-400 text-lg">
              Управление вакансиями и настройками
            </p>
          </div>

          {/* Профиль компании */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30 mb-8">
            <div className="flex flex-col md:flex-row items-start space-y-6 md:space-y-0 md:space-x-8">
              {/* Аватарка */}
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 relative mb-4">
                  {avatar ? (
                    <img 
                      src={avatar} 
                      alt="Аватар компании"
                      className="w-full h-full object-cover rounded-full border-4 border-accent-blue/30"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-accent-blue to-accent-purple rounded-full flex items-center justify-center border-4 border-accent-blue/30">
                      <span className="text-white font-bold text-3xl">
                        {profile?.company_name?.charAt(0) || 'К'}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Загрузка аватарки */}
                <div
                  className={`w-48 p-4 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                    dragActive
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-dark-600/50 hover:border-dark-500/50 bg-dark-800/30'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <div className="text-center">
                    <svg className="w-8 h-8 text-dark-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-dark-300 text-sm mb-1">Загрузить аватар</p>
                    <p className="text-dark-500 text-xs">JPG, PNG до 5MB</p>
                  </div>
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                
                {avatarFile && (
                  <button
                    onClick={saveAvatar}
                    className="mt-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Сохранить аватар
                  </button>
                )}
              </div>

              {/* Информация о компании */}
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white mb-6">{profile?.company_name}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Email</label>
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white">
                      {profile?.email}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">ИНН</label>
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white">
                      {profile?.inn}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">ОГРН</label>
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white">
                      {profile?.ogrn}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Роль</label>
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent-purple/20 text-accent-purple">
                        Компания
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-dark-300 mb-1">Юридический адрес</label>
                  <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/50 rounded-xl text-white">
                    {profile?.legal_address}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Управление вакансиями */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Вакансии</h3>
              <div className="flex space-x-4">
                <button
                  onClick={downloadExampleJSON}
                  className="px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 border border-dark-600/50 hover:border-accent-blue/50 text-dark-300 hover:text-white rounded-xl font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                  <span>Скачать пример JSON</span>
                </button>
                <button
                  onClick={addVacancy}
                  className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                  </svg>
                  <span>Добавить вакансию</span>
                </button>
              </div>
            </div>

            {vacancies.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                  </svg>
                </div>
                <h4 className="text-xl text-white mb-2">Нет вакансий</h4>
                <p className="text-dark-400">Добавьте первую вакансию для начала работы</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vacancies.map((vacancy) => (
                  <div key={vacancy._id || vacancy.title} className="p-6 bg-dark-800/30 border border-dark-600/50 rounded-xl flex flex-col h-full">
                    <div className="flex-grow">
                      <h4 className="text-lg font-semibold text-white mb-2">{vacancy.title}</h4>
                      <div className="mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getGradeColor(vacancy.grade)}`}>
                          {vacancy.grade}
                        </span>
                      </div>
                      <p className="text-dark-300 text-sm mb-2 line-clamp-3">{vacancy.description || vacancy.work_field}</p>
                      
                      {vacancy.work_address && (
                        <div className="mb-2">
                          <div className="flex items-center space-x-1 text-dark-400 text-xs">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9C19,5.13 15.87,2 12,2M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5Z"/>
                            </svg>
                            <span>{vacancy.work_address}</span>
                          </div>
                        </div>
                      )}
                      
                      {vacancy.required_skills && vacancy.required_skills.length > 0 && (
                        <div className="mb-4">
                          <p className="text-dark-400 text-xs mb-1">Навыки:</p>
                          <div className="flex flex-wrap gap-1">
                            {vacancy.required_skills.slice(0, 3).map((skill, index) => (
                              <span key={index} className="px-2 py-1 bg-dark-700/50 text-dark-300 text-xs rounded">
                                {skill}
                              </span>
                            ))}
                            {vacancy.required_skills.length > 3 && (
                              <span className="px-2 py-1 bg-dark-700/50 text-dark-300 text-xs rounded">
                                +{vacancy.required_skills.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Индикатор файла вопросов */}
                    {vacancy.questionsFileName && (
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                        <span className="text-green-400 text-xs">{vacancy.questionsFileName}</span>
                      </div>
                    )}
                    
                    <div className="flex space-x-2 mt-auto">
                      <button
                        onClick={() => editVacancy(vacancy)}
                        className="flex-1 px-3 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-lg text-sm font-medium transition-colors"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDeleteVacancy(vacancy)}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* Модальное окно добавления/редактирования вакансии */}
      {showVacancyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowVacancyModal(false)}
          ></div>
          <div className="relative glass rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-dark-600/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingVacancy ? 'Редактировать вакансию' : 'Добавить вакансию'}
              </h2>
              <button
                onClick={() => setShowVacancyModal(false)}
                className="w-8 h-8 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Название вакансии *</label>
                <input
                  type="text"
                  value={newVacancy.title}
                  onChange={(e) => setNewVacancy(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="Frontend разработчик"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Уровень *</label>
                  <select
                    value={newVacancy.grade}
                    onChange={(e) => setNewVacancy(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  >
                    <option value="junior">Junior</option>
                    <option value="middle">Middle</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Сфера деятельности *</label>
                  <input
                    type="text"
                    value={newVacancy.work_field}
                    onChange={(e) => setNewVacancy(prev => ({ ...prev, work_field: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                    placeholder="Разработка ПО"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Адрес работы</label>
                <input
                  type="text"
                  value={newVacancy.work_address || ''}
                  onChange={(e) => setNewVacancy(prev => ({ ...prev, work_address: e.target.value }))}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="г. Москва, ул. Тверская, д. 1 (необязательно)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Мин. опыт (лет)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={newVacancy.min_experience}
                    onChange={(e) => setNewVacancy(prev => ({ ...prev, min_experience: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Макс. опыт (лет)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={newVacancy.max_experience}
                    onChange={(e) => setNewVacancy(prev => ({ ...prev, max_experience: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Обязательные навыки (через запятую)</label>
                <input
                  type="text"
                  value={requiredSkillsText}
                  onChange={(e) => setRequiredSkillsText(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="React, TypeScript, Node.js"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Дополнительные навыки (через запятую)</label>
                <input
                  type="text"
                  value={optionalSkillsText}
                  onChange={(e) => setOptionalSkillsText(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="Docker, AWS, GraphQL"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Описание</label>
                <textarea
                  value={newVacancy.description || ''}
                  onChange={(e) => setNewVacancy(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                  placeholder="Дополнительное описание вакансии..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">JSON файл с вопросами</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleQuestionsFileUpload}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent-blue file:text-white hover:file:bg-accent-blue/90 file:cursor-pointer"
                />
                {newVacancy.questionsFileName && (
                  <p className="text-green-400 text-sm mt-1">Файл загружен: {newVacancy.questionsFileName}</p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mt-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowVacancyModal(false)}
                className="flex-1 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300"
              >
                Отмена
              </button>
              <button
                onClick={saveVacancy}
                className="flex-1 px-6 py-3 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl font-medium transition-colors"
              >
                {editingVacancy ? 'Сохранить изменения' : 'Добавить вакансию'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения выхода */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          ></div>
          <div className="relative glass rounded-3xl p-8 max-w-md w-full border border-dark-600/30">
            <div className="text-center">
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

      {/* Модальное окно подтверждения удаления вакансии */}
      {showDeleteConfirm && vacancyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          ></div>
          <div className="relative glass rounded-3xl p-8 max-w-md w-full border border-dark-600/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z"/>
                </svg>
              </div>
              
              <h3 className="text-2xl font-light text-white mb-4">Удалить вакансию?</h3>
              <p className="text-dark-300 text-lg mb-2">
                Вы действительно хотите удалить вакансию
              </p>
              <p className="text-white font-medium mb-8">
                "{vacancyToDelete.title}"?
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300"
                >
                  Отмена
                </button>
                
                <button
                  onClick={confirmDeleteVacancy}
                  className="flex-1 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                >
                  Да, удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyDashboard
