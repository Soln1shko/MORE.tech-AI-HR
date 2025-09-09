import React, { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import TopPanel from '../components/TopPanel'
import { loginUser, getUserRole } from '../services/api'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
  }, [error])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await loginUser(formData)
      
      if (response.success) {
        localStorage.setItem('isAuthenticated', 'true')
        
        // Получаем роль пользователя и перенаправляем соответственно
        const userRole = getUserRole()
        if (userRole === 'company') {
          navigate('/company-dashboard')
        } else {
          navigate('/welcomescreen')
        }
      } else {
        setError(response.error || 'Ошибка авторизации')
      }
    } catch (err) {
      setError('Ошибка авторизации. Проверьте данные и попробуйте снова.')
    } finally {
      setIsLoading(false)
    }
  }, [formData, navigate])


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
      
      {/* Верхняя панель */}
      <TopPanel hideButtons={true} disableLogoClick={true} />
      
      {/* Основной контент */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
        <div className="w-full max-w-md mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Вход
            </h1>
            <p className="text-dark-400 text-lg">
              Войдите в свою учетную запись
            </p>
          </div>

          {/* Форма входа */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="Введите пароль"
                />
              </div>

              {/* Ошибка */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Кнопка входа */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 disabled:from-dark-700 disabled:to-dark-700 text-white rounded-xl font-medium transition-colors duration-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Вход...</span>
                  </div>
                ) : (
                  'Войти'
                )}
              </button>

              {/* Ссылка на регистрацию */}
              <div className="text-center pt-4">
                <p className="text-dark-400 text-sm">
                  Нет аккаунта?{' '}
                  <Link 
                    to="/register" 
                    className="text-accent-blue hover:text-accent-blue/80 transition-colors font-medium"
                  >
                    Зарегистрироваться
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

export default LoginPage
