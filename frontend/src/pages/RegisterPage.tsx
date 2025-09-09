import React, { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { registerUser } from '../services/api'

const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    telegram: ''
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // Валидация Telegram
    if (name === 'telegram' && value) {
      // Убираем пробелы и проверяем формат
      const cleanValue = value.trim()
      // Допускаем @username, username, или ссылки на t.me
      const telegramRegex = /^(@[\w\d_]{5,32}|[\w\d_]{5,32}|https?:\/\/(t\.me|telegram\.me)\/[\w\d_]{5,32})$/i
      
      if (cleanValue && !telegramRegex.test(cleanValue)) {
        setError('Некорректный формат Telegram. Используйте @username или ссылку')
      } else {
        if (error.includes('Telegram')) setError('')
      }
    }

    // Валидация подтверждения пароля
    if (name === 'confirmPassword' && value) {
      if (value !== formData.password) {
        setError('Пароли не совпадают')
      } else {
        if (error.includes('Пароли не совпадают')) setError('')
      }
    }

    // Валидация пароля при изменении основного пароля
    if (name === 'password' && formData.confirmPassword) {
      if (value !== formData.confirmPassword) {
        setError('Пароли не совпадают')
      } else {
        if (error.includes('Пароли не совпадают')) setError('')
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error && !error.includes('Telegram') && !error.includes('Пароли не совпадают')) setError('')
  }, [error])

  const handleFileUpload = useCallback((file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      setError('Поддерживаются только файлы PDF и Word (.doc, .docx)')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      setError('Размер файла не должен превышать 10MB')
      return
    }

    setResumeFile(file)
    setError('')
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

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
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const removeFile = useCallback(() => {
    setResumeFile(null)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Проверяем обязательные поля
    if (!resumeFile) {
      setError('Резюме обязательно для загрузки')
      setIsLoading(false)
      return
    }

    try {
      const registrationData = {
        ...formData,
        resume: resumeFile
      }
      
      const response = await registerUser(registrationData)
      
      if (response.success) {
        localStorage.setItem('isAuthenticated', 'true')
        navigate('/welcomescreen')
      } else {
        setError(response.error || 'Ошибка регистрации')
      }
    } catch (err) {
      setError('Ошибка регистрации. Попробуйте снова.')
    } finally {
      setIsLoading(false)
    }
  }, [formData, resumeFile, navigate])


  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') {
      return (
        <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
      )
    }
    return (
      <svg className="w-8 h-8 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
      </svg>
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
        
        {/* Диагональные линии */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div 
            className="absolute w-full h-px opacity-20"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)',
              top: '20%',
              transform: 'rotate(-45deg) translateY(-50%)',
              transformOrigin: 'center'
            }}
          ></div>
          <div 
            className="absolute w-full h-px opacity-15"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent)',
              top: '60%',
              transform: 'rotate(45deg) translateY(-50%)',
              transformOrigin: 'center'
            }}
          ></div>
        </div>
        
        {/* Геометрические формы */}
        <div className="absolute top-1/4 left-8 w-2 h-2 bg-accent-blue/20 rounded-full"></div>
        <div className="absolute top-1/3 right-12 w-1 h-1 bg-accent-purple/30 rounded-full"></div>
        <div className="absolute bottom-1/4 left-16 w-1.5 h-1.5 bg-accent-blue/15 rounded-full"></div>
        <div className="absolute bottom-1/3 right-8 w-2 h-2 bg-accent-purple/20 rounded-full"></div>
        
        {/* Тонкие декоративные рамки */}
        <div 
          className="absolute top-20 left-10 w-32 h-24 border border-accent-blue/20 rounded-lg bg-accent-blue/5"
          style={{ transform: 'rotate(15deg)' }}
        ></div>
        <div 
          className="absolute bottom-32 right-16 w-40 h-20 border border-accent-purple/15 rounded-lg bg-accent-purple/3"
          style={{ transform: 'rotate(-12deg)' }}
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
      </div>
      
      {/* Основной контент */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 pb-20 px-6">
        <div className="w-full max-w-lg mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Регистрация кандидата
            </h1>
            <p className="text-dark-400 text-lg mb-6">
              Создайте новую учетную запись для прохождения собеседований
            </p>
            
            <div className="mb-6">
              <Link 
                to="/company-register"
                className="group inline-flex items-center space-x-2 px-4 py-2 glass border border-accent-purple/30 rounded-xl text-accent-purple hover:bg-accent-purple/10 hover:border-accent-purple/50 transition-all duration-300 hover:scale-105"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                </svg>
                <span className="text-sm font-medium">Регистрация для компаний</span>
              </Link>
            </div>
          </div>

          {/* Форма регистрации */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Имя и Фамилия */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-dark-300 mb-2">
                    Имя
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-dark-300 mb-2">
                    Фамилия
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                    placeholder="Ваша фамилия"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-dark-300 mb-2">
                  Электронная почта
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="example@email.com"
                />
              </div>

              {/* Telegram */}
              <div>
                <label htmlFor="telegram" className="block text-sm font-medium text-dark-300 mb-2">
                  Telegram
                </label>
                <input
                  type="text"
                  id="telegram"
                  name="telegram"
                  value={formData.telegram}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="@username или ссылка"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark-300 mb-2">
                  Пароль
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="Минимум 6 символов"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-dark-300 mb-2">
                  Подтвердите пароль
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="Повторите пароль"
                />
              </div>

              {/* Загрузка резюме */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Резюме (PDF, DOC, DOCX) *
                </label>
                
                {!resumeFile ? (
                  <div
                    className={`w-full p-6 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                      dragActive
                        ? 'border-accent-blue bg-accent-blue/10'
                        : 'border-dark-600/50 hover:border-dark-500/50 bg-dark-800/30'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('resume-upload')?.click()}
                  >
                    <div className="text-center">
                      <svg className="w-12 h-12 text-dark-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-dark-300 mb-2">Перетащите файл сюда или нажмите для выбора</p>
                      <p className="text-dark-500 text-sm">PDF, DOC, DOCX до 10MB</p>
                    </div>
                    <input
                      type="file"
                      id="resume-upload"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="w-full p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getFileIcon(resumeFile.type)}
                        <div>
                          <p className="text-white text-sm font-medium">{resumeFile.name}</p>
                          <p className="text-dark-400 text-xs">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="text-dark-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Ошибка */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Кнопка регистрации */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 disabled:from-dark-700 disabled:to-dark-700 text-white rounded-xl font-medium transition-colors duration-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Регистрация...</span>
                  </div>
                ) : (
                  'Зарегистрироваться'
                )}
              </button>

              {/* Ссылка на вход */}
              <div className="text-center pt-4">
                <p className="text-dark-400 text-sm">
                  Уже есть аккаунт?{' '}
                  <Link 
                    to="/login" 
                    className="text-accent-blue hover:text-accent-blue/80 transition-colors font-medium"
                  >
                    Войти
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
