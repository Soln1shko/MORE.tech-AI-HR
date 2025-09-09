// API для работы с бэкендом
import { getConfig } from '../config/environment'

const API_BASE_URL = getConfig().API_BASE_URL

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  telegram: string
  resume?: File
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Авторизация пользователя
export const loginUser = async (data: LoginData): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (response.ok) {
      // Сохраняем токен и роль в localStorage
      if (result.token) {
        localStorage.setItem('authToken', result.token)
        localStorage.setItem('isAuthenticated', 'true')
        
        // Сохраняем роль пользователя для быстрого доступа
        if (result.role) {
          localStorage.setItem('userRole', result.role)
        }
      }
      
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка авторизации'
      }
    }
  } catch (error) {
    console.error('Ошибка при авторизации:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Регистрация пользователя
export const registerUser = async (data: RegisterData): Promise<ApiResponse> => {
  try {
    const formData = new FormData()
    
    // Добавляем основные данные
    formData.append('email', data.email)
    formData.append('password', data.password)
    formData.append('name', data.firstName)
    formData.append('surname', data.lastName)
    formData.append('telegram_id', data.telegram)
    
    // Добавляем файл резюме
    if (data.resume) {
      formData.append('resume', data.resume)
    }

    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result,
        message: result.message
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка регистрации'
      }
    }
  } catch (error) {
    console.error('Ошибка при регистрации:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Заглушка для загрузки файла резюме (может понадобиться отдельно)
export const uploadResume = async (file: File): Promise<ApiResponse> => {
  console.log('Загрузка резюме:', {
    name: file.name,
    size: file.size,
    type: file.type
  })
  
  return {
    success: true,
    data: {
      fileId: `resume_${Date.now()}`,
      fileName: file.name,
      fileUrl: `${API_BASE_URL}/uploads/resumes/${file.name}`
    }
  }
}

// Проверка аутентификации
export const checkAuth = (): boolean => {
  const token = localStorage.getItem('authToken')
  const isAuth = localStorage.getItem('isAuthenticated')
  return !!(token && isAuth === 'true')
}

// Выход из системы
export const logout = (): void => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('userRole')
}

// Получение токена авторизации
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken')
}

// Получение роли пользователя
export const getUserRole = (): string | null => {
  return localStorage.getItem('userRole')
}

// Загрузка аватарки компании
export const uploadCompanyAvatar = async (file: File): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const formData = new FormData()
    formData.append('avatar', file)

    const response = await fetch(`${API_BASE_URL}/company/avatar`, {
      method: 'POST',
      headers: {
        'x-access-token': token,
      },
      body: formData,
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка загрузки аватарки'
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке аватарки:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение профиля пользователя
export const getUserProfile = async (): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения профиля'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении профиля:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение интервью пользователя
export const getUserInterviews = async (): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/user-interviews`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result.interviews || []
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения интервью'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении интервью:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение заявок пользователя с полными данными
export const getUserApplications = async (): Promise<ApiResponse> => {
  try {
    console.log('🚀 Начинаем загрузку заявок пользователя...')
    
    // 1. Получаем интервью пользователя
    const interviewsResponse = await getUserInterviews()
    console.log('📞 Ответ от getUserInterviews:', interviewsResponse)
    
    if (!interviewsResponse.success) {
      console.error('❌ Ошибка получения интервью:', interviewsResponse.error)
      return interviewsResponse
    }

    const interviews = interviewsResponse.data || []
    console.log('🔍 Получены интервью:', interviews.length, interviews)
    
    // 2. Получаем данные о вакансиях
    const vacanciesResponse = await getAllVacancies(1, 100)
    const vacancies = vacanciesResponse.success ? vacanciesResponse.data?.vacancies || [] : []
    
    // 3. Получаем данные о компаниях
    const companiesResponse = await getAllCompanies(1, 50)
    const companies = companiesResponse.success ? companiesResponse.data?.companies || [] : []

    // 4. Объединяем данные
    const applications = interviews.map((interview: any) => {
      // Обработка разных форматов ID (ObjectId vs String)
      const interviewVacancyId = typeof interview.vacancy_id === 'object' && interview.vacancy_id.$oid 
        ? interview.vacancy_id.$oid 
        : interview.vacancy_id
      
      const vacancy = vacancies.find((v: any) => {
        const vacancyId = typeof v._id === 'object' && v._id.$oid ? v._id.$oid : v._id
        return vacancyId === interviewVacancyId
      })
      
      const company = companies.find((c: any) => {
        const companyId = typeof c._id === 'object' && c._id.$oid ? c._id.$oid : c._id
        const vacancyCompanyId = typeof vacancy?.company_id === 'object' && vacancy?.company_id.$oid 
          ? vacancy?.company_id.$oid 
          : vacancy?.company_id
        return companyId === vacancyCompanyId
      })
      
      return {
        _id: typeof interview._id === 'object' && interview._id.$oid ? interview._id.$oid : interview._id,
        status: interview.status,
        created_at: interview.created_at,
        resume_score: interview.resume_score,
        vacancy_title: vacancy?.title || 'Неизвестная вакансия',
        vacancy_grade: vacancy?.grade || '',
        vacancy_work_field: vacancy?.work_field || '',
        company_name: company?.company_name || 'Неизвестная компания'
      }
    })

    console.log('📊 Итоговые заявки:', applications.length, applications)

    return {
      success: true,
      data: applications
    }
  } catch (error) {
    console.error('Ошибка при получении заявок:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение профиля компании
export const getCompanyProfile = async (): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/company`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения профиля компании'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении профиля компании:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Интерфейс для регистрации компании
export interface CompanyRegisterData {
  companyName: string
  inn: string
  ogrn: string
  legalAddress: string
  actualAddress: string
  contactPersonName: string
  contactPersonPosition: string
  email: string
  phone: string
  password: string
  website?: string
  description?: string
}

// Интерфейс для вакансии (согласно бэкенду)
export interface VacancyData {
  _id?: string
  company_id?: string
  title: string
  grade: string
  required_skills: string[]
  min_experience: number
  max_experience: number
  work_field: string
  work_address?: string
  description?: string
  optional_skills?: string[]
  questions?: any[]
  created_at?: string
}

// Интерфейс для создания вакансии
export interface CreateVacancyData {
  title: string
  grade: string
  required_skills: string[]
  min_experience: number
  max_experience: number
  work_field: string
  work_address?: string
  description?: string
  optional_skills?: string[]
  questions?: any[]
}

// Регистрация компании - отправляются только обязательные поля
export const registerCompany = async (data: CompanyRegisterData): Promise<ApiResponse> => {
  try {
    // Подготавливаем данные только с обязательными полями согласно требованиям
    const companyData = {
      company_name: data.companyName,  // Название компании *
      inn: data.inn,                  // ИНН *
      ogrn: data.ogrn,               // ОГРН *
      legal_address: data.legalAddress, // Юридический адрес *
      email: data.email,             // Email *
      password: data.password        // пароль
    }

    const response = await fetch(`${API_BASE_URL}/register/company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(companyData),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result,
        message: result.message
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка регистрации компании'
      }
    }
  } catch (error) {
    console.error('Ошибка при регистрации компании:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// ===================
// ВАКАНСИИ
// ===================

// Создание вакансии
export const createVacancy = async (data: CreateVacancyData): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/vacancies/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка создания вакансии'
      }
    }
  } catch (error) {
    console.error('Ошибка при создании вакансии:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение вакансий компании
export const getCompanyVacancies = async (page: number = 1, perPage: number = 20): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    // Для компаний получаем их ID из токена и фильтруем вакансии
    const response = await fetch(`${API_BASE_URL}/vacancies?page=${page}&per_page=${perPage}`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения вакансий'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении вакансий:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Обновление вакансии
export const updateVacancy = async (vacancyId: string, data: Partial<CreateVacancyData>): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка обновления вакансии'
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении вакансии:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Удаление вакансии (функция для будущего использования)
export const deleteVacancy = async (vacancyId: string): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}`, {
      method: 'DELETE',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка удаления вакансии'
      }
    }
  } catch (error) {
    console.error('Ошибка при удалении вакансии:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// ===================
// ВОПРОСЫ К ВАКАНСИЯМ
// ===================

// Загрузка вопросов для вакансии
export const uploadVacancyQuestions = async (vacancyId: string, questions: any[]): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify({ questions }),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка загрузки вопросов'
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке вопросов:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение вопросов для вакансии
export const getVacancyQuestions = async (vacancyId: string): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}/questions`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения вопросов'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении вопросов:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// ===================
// КОМПАНИИ И ОБЩИЕ ВАКАНСИИ (для Welcome Screen)
// ===================

// Получение всех компаний
export const getAllCompanies = async (page: number = 1, perPage: number = 50): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/companies?page=${page}&per_page=${perPage}`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения компаний'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении компаний:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение всех вакансий (для пользователей)
export const getAllVacancies = async (page: number = 1, perPage: number = 100, companyId?: string): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    let url = `${API_BASE_URL}/vacancies?page=${page}&per_page=${perPage}`
    if (companyId) {
      url += `&company_id=${companyId}`
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения вакансий'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении вакансий:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Интерфейс для компании из бэкенда
export interface CompanyFromBackend {
  _id: string
  company_name: string
  inn: string
  ogrn: string
  legal_address: string
  email: string
  role: string
}

// Скачивание резюме пользователя
export const downloadUserResume = async (): Promise<void> => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Токен авторизации отсутствует')
    }

    const response = await fetch(`${API_BASE_URL}/download-resume`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
      },
    })

    if (!response.ok) {
      throw new Error('Ошибка при скачивании резюме')
    }

    // Получаем имя файла из заголовков ответа
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'document' // дефолтное имя без расширения
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }
    
    // Если имя файла не получено из заголовков, попробуем определить расширение из Content-Type
    if (filename === 'document') {
      const contentType = response.headers.get('Content-Type')
      if (contentType?.includes('pdf')) {
        filename = 'document.pdf'
      } else if (contentType?.includes('msword')) {
        filename = 'document.doc'
      } else if (contentType?.includes('wordprocessingml')) {
        filename = 'document.docx'
      }
    }

    // Создаем blob из ответа
    const blob = await response.blob()
    
    // Создаем ссылку для скачивания
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    
    // Добавляем ссылку в DOM, кликаем и удаляем
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Освобождаем память
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Ошибка при скачивании резюме:', error)
    throw error
  }
}

// Скачивание резюме кандидата (для HR)
export const downloadCandidateResume = async (userId: string): Promise<void> => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Токен авторизации отсутствует')
    }

    const response = await fetch(`${API_BASE_URL}/download-candidate-resume?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
      },
    })

    if (!response.ok) {
      throw new Error('Ошибка при скачивании резюме кандидата')
    }

    // Получаем имя файла из заголовков ответа
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'resume' // дефолтное имя без расширения
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }
    
    // Если имя файла не получено из заголовков, попробуем определить расширение из Content-Type
    if (filename === 'resume') {
      const contentType = response.headers.get('Content-Type')
      if (contentType?.includes('pdf')) {
        filename = 'resume.pdf'
      } else if (contentType?.includes('msword')) {
        filename = 'resume.doc'
      } else if (contentType?.includes('wordprocessingml')) {
        filename = 'resume.docx'
      }
    }

    // Создаем blob из ответа
    const blob = await response.blob()
    
    // Создаем ссылку для скачивания
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    
    // Добавляем ссылку в DOM, кликаем и удаляем
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Освобождаем память
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Ошибка при скачивании резюме кандидата:', error)
    throw error
  }
}

// Обновление профиля пользователя
export const updateUserProfile = async (data: { name?: string; surname?: string; telegram_id?: string }): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/user/updateprofile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка обновления профиля'
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Обновление резюме пользователя
export const updateUserResume = async (file: File): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const formData = new FormData()
    formData.append('resume', file)

    const response = await fetch(`${API_BASE_URL}/update-resume`, {
      method: 'POST',
      headers: {
        'x-access-token': token,
      },
      body: formData,
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка обновления резюме'
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении резюме:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// ===================
// СОБЕСЕДОВАНИЯ
// ===================

// Интерфейс для данных собеседования
export interface InterviewData {
  interview_id?: string
  mlinterview_id?: string
  question?: string
  status?: string
  current_question?: string
}

// Интерфейс для ответа проверки резюме
export interface ResumeCheckResult {
  success: boolean
  resume_score: number
  can_proceed: boolean
  message: string
}

// Проверка резюме без создания интервью
export const checkResume = async (vacancyId: string): Promise<ApiResponse<ResumeCheckResult>> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/check-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify({ vacancy_id: vacancyId }),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка при проверке резюме'
      }
    }
  } catch (error) {
    console.error('Ошибка при проверке резюме:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Начало собеседования (process_ad_save_resume)
export const startInterview = async (vacancyId: string): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/convert-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify({ vacancy_id: vacancyId }),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: {
          interview_id: result.interview_id,
          message: result.message
        }
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка при начале собеседования'
      }
    }
  } catch (error) {
    console.error('Ошибка при начале собеседования:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Отправка ответа на вопрос собеседования
export const saveInterviewAnswer = async (
  interviewId: string,
  mlinterviewId: string,
  question: string,
  answerText: string,
  analysis?: any
): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/interviews/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify({
        interview_id: interviewId,
        mlinterview_id: mlinterviewId,
        question: question,
        answer_text: answerText,
        analysis: analysis
      }),
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка при сохранении ответа'
      }
    }
  } catch (error) {
    console.error('Ошибка при сохранении ответа:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Удаление интервью (при выходе из собеседования)
export const deleteInterview = async (interviewId: string): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/interviews/${interviewId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      }
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка при удалении интервью'
      }
    }
  } catch (error) {
    console.error('Ошибка при удалении интервью:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получение истории вопросов и ответов собеседования
export const getInterviewQnA = async (interviewId: string): Promise<ApiResponse> => {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/interviews/${interviewId}/qna`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка при получении истории собеседования'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении истории собеседования:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}


// ===================
// КАНДИДАТЫ
// ===================

// Интерфейс для кандидата
export interface Candidate {
  _id: string
  user_id: string
  vacancy_id: string
  status: string
  resume_analysis?: any
  resume_score?: number
  interview_analysis?: any
  user_name?: string
  user_email?: string
  created_at?: string
}

// Интерфейс для ответа кандидата
export interface CandidateAnswer {
  _id: string
  interview_id: string
  mlinterview_id: string
  question: string
  answer_text: string
  status: string
  report?: any
  recommendation?: any
  voice_analysis?: {
    tags: string[]
    scores: {
      confidence: number
      stress_resistance: number
      communication: number
      energy: number
    }
    overall_score?: number
  }
}

// Получить собеседования для конкретной вакансии
export async function getInterviewsForVacancy(vacancyId: string, page: number = 1, perPage: number = 20) {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}/interviews?page=${page}&per_page=${perPage}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения собеседований'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении собеседований для вакансии:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получить кандидатов для конкретной вакансии (с данными пользователей)
export async function getCandidatesForVacancy(vacancyId: string, page: number = 1, perPage: number = 20) {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/vacancies/${vacancyId}/candidates?page=${page}&per_page=${perPage}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения кандидатов'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении кандидатов для вакансии:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Получить ответы кандидата для конкретного собеседования
export async function getCandidateAnswers(interviewId: string) {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/interviews/${interviewId}/qna`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка получения ответов кандидата'
      }
    }
  } catch (error) {
    console.error('Ошибка при получении ответов кандидата:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// Обновить статус кандидата
export async function updateCandidateStatus(interviewId: string, status: 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer') {
  try {
    const token = getAuthToken()
    if (!token) {
      return {
        success: false,
        error: 'Токен авторизации отсутствует'
      }
    }

    const response = await fetch(`${API_BASE_URL}/interviews/change-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify({ 
        interview_id: interviewId,
        status: status 
      })
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        data: result
      }
    } else {
      return {
        success: false,
        error: result.message || 'Ошибка обновления статуса'
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении статуса кандидата:', error)
    return {
      success: false,
      error: 'Ошибка подключения к серверу'
    }
  }
}

// ===== COMPANY PROFILE API =====

export interface CompanyProfileData {
  _id?: string
  company_id: string
  // Основная информация (company_name приходит из companies таблицы)
  basic_info: {
    company_name: string      // Из companies таблицы (только для чтения из API)
    website: string
    industry: string
    is_it_accredited: boolean
    logo_url: string
  }
  // Подробное описание (основной текстовый блок)
  detailed_description: {
    about_company: string      // Чем занимается компания
    about_team: string         // О команде  
    team_size: string          // Размер команды
    corporate_culture: string  // Корпоративная культура и ценности
    work_conditions: string    // Условия работы
  }
  // Контактная информация (email и address приходят из companies таблицы)
  contact_info: {
    email: string             // Из companies таблицы (только для чтения из API)
    address: string           // Из companies таблицы как legal_address (только для чтения из API)
    phone: string
    city: string
    country: string
  }
  // Преимущества и льготы
  benefits: string[]
  // Социальные сети
  social_links: {
    linkedin: string
    telegram: string
    vk: string
    facebook: string
  }
  // Дополнительная информация
  additional_info: {
    founded_year: number | null
    employee_count: string
    specializations: string[]
    office_photos: string[]
    company_values: string[]
  }
  created_at?: string
  updated_at?: string
}

export const getCompanyProfileData = async (): Promise<CompanyProfileData> => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Токен авторизации отсутствует')
    }

    const response = await fetch(`${API_BASE_URL}/company-profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
    })

    if (!response.ok) {
      throw new Error('Ошибка при получении профиля компании')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка при получении профиля компании:', error)
    throw error
  }
}

export const updateCompanyProfileData = async (profileData: Partial<CompanyProfileData>): Promise<CompanyProfileData> => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Токен авторизации отсутствует')
    }

    const response = await fetch(`${API_BASE_URL}/company-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify(profileData),
    })

    if (!response.ok) {
      throw new Error('Ошибка при обновлении профиля компании')
    }

    const data = await response.json()
    return data.profile
  } catch (error) {
    console.error('Ошибка при обновлении профиля компании:', error)
    throw error
  }
}

export const getPublicCompanyProfileData = async (companyId: string): Promise<Partial<CompanyProfileData>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/company-profile/public/${companyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Ошибка при получении публичного профиля компании')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка при получении публичного профиля компании:', error)
    throw error
  }
}

// Получение списка всех компаний с их профилями для публичного просмотра
export const getAllCompaniesWithProfiles = async (): Promise<{companies: CompanyFromBackend[], profiles: Record<string, Partial<CompanyProfileData>>}> => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Токен авторизации отсутствует')
    }

    // Получаем список всех компаний
    const companiesResponse = await fetch(`${API_BASE_URL}/companies?per_page=100`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
    })

    if (!companiesResponse.ok) {
      throw new Error('Ошибка при получении списка компаний')
    }

    const companiesData = await companiesResponse.json()
    const companies = companiesData.companies || []

    // Получаем профили для всех компаний
    const profiles: Record<string, Partial<CompanyProfileData>> = {}
    
    await Promise.all(
      companies.map(async (company: CompanyFromBackend) => {
        try {
          const profile = await getPublicCompanyProfileData(company._id)
          profiles[company._id] = profile
        } catch (error) {
          console.warn(`Не удалось загрузить профиль для компании ${company._id}:`, error)
          // Создаем базовый профиль если не удалось загрузить
          profiles[company._id] = {
            basic_info: {
              company_name: company.company_name || '',
              website: '',
              industry: '',
              is_it_accredited: false,
              logo_url: ''
            },
            detailed_description: {
              about_company: 'Информация о компании не заполнена',
              about_team: '',
              team_size: '',
              corporate_culture: '',
              work_conditions: ''
            },
            contact_info: {
              email: company.email || '',
              address: company.legal_address || '',
              phone: '',
              city: '',
              country: ''
            },
            benefits: [],
            social_links: {
              linkedin: '',
              telegram: '',
              vk: '',
              facebook: ''
            },
            additional_info: {
              founded_year: null,
              employee_count: '',
              specializations: [],
              office_photos: [],
              company_values: []
            }
          }
        }
      })
    )

    return { companies, profiles }
  } catch (error) {
    console.error('Ошибка при получении компаний с профилями:', error)
    throw error
  }
}