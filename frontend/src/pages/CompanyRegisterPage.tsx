import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerCompany, CompanyRegisterData } from '../services/api'

interface CompanyRegisterPageProps {
  onBack?: () => void
}


const CompanyRegisterPage: React.FC<CompanyRegisterPageProps> = ({ onBack }) => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<CompanyRegisterData>({
    companyName: '',
    inn: '',
    ogrn: '',
    legalAddress: '',
    actualAddress: '',
    contactPersonName: '',
    contactPersonPosition: '',
    email: '',
    phone: '',
    password: '',
    website: '',
    description: '',
  })
  const [confirmPassword, setConfirmPassword] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const validateINN = (inn: string): boolean => {
    if (inn.length !== 10 && inn.length !== 12) return false
    if (!/^\d+$/.test(inn)) return false
    
    // Простая проверка ИНН для 10 цифр (юридические лица)
    if (inn.length === 10) {
      const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8]
      let sum = 0
      for (let i = 0; i < 9; i++) {
        sum += parseInt(inn[i]) * weights[i]
      }
      const checkDigit = sum % 11 % 10
      return checkDigit === parseInt(inn[9])
    }
    
    return true // Для 12-значного ИНН (физлица) упрощенная проверка
  }

  const validateOGRN = (ogrn: string): boolean => {
    if (ogrn.length !== 13) return false
    if (!/^\d+$/.test(ogrn)) return false
    
    // Проверка контрольной цифры ОГРН
    const checkDigit = parseInt(ogrn.slice(0, 12)) % 11 % 10
    return checkDigit === parseInt(ogrn[12])
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^(\+7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Название компании обязательно'
    }

    if (!formData.inn.trim()) {
      newErrors.inn = 'ИНН обязателен'
    } else if (!validateINN(formData.inn)) {
      newErrors.inn = 'Некорректный ИНН'
    }

    if (!formData.ogrn.trim()) {
      newErrors.ogrn = 'ОГРН обязателен'
    } else if (!validateOGRN(formData.ogrn)) {
      newErrors.ogrn = 'Некорректный ОГРН'
    }

    if (!formData.legalAddress.trim()) {
      newErrors.legalAddress = 'Юридический адрес обязателен'
    }

    if (!formData.contactPersonName.trim()) {
      newErrors.contactPersonName = 'ФИО контактного лица обязательно'
    }

    if (!formData.contactPersonPosition.trim()) {
      newErrors.contactPersonPosition = 'Должность контактного лица обязательна'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен'
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Некорректный email'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен'
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Некорректный номер телефона'
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Пароль обязателен'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов'
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Подтверждение пароля обязательно'
    } else if (confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Пароли не совпадают'
    }


    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof CompanyRegisterData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }

    // Валидация подтверждения пароля при изменении основного пароля
    if (field === 'password' && confirmPassword && value !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Пароли не совпадают' }))
    } else if (field === 'password' && confirmPassword && value === confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: '' }))
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      const result = await registerCompany(formData)
      
      if (result.success) {
        setIsSubmitted(true)
      } else {
        setErrors({ general: result.error || 'Произошла ошибка при отправке данных' })
      }
    } catch (error) {
      console.error('Ошибка при регистрации компании:', error)
      setErrors({ general: 'Произошла ошибка при отправке данных. Попробуйте позже.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
        <div className="w-full max-w-2xl mx-auto text-center">
          <div className="glass p-8 rounded-2xl border border-dark-600/30">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Заявка отправлена!
            </h2>
            <p className="text-dark-300 mb-6">
              Ваша заявка на регистрацию компании успешно отправлена. 
              Мы свяжемся с вами в ближайшее время для подтверждения данных.
            </p>
            <button
              onClick={() => onBack ? onBack() : navigate('/welcomescreen')}
              className="px-8 py-3 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-xl font-medium hover:scale-105 transition-transform"
            >
              Вернуться на главную
            </button>
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
      
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-36 pb-20 px-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Регистрация компании
          </h1>
          <p className="text-dark-400 text-lg">
            Заполните форму для подключения к платформе AI собеседований
          </p>
        </div>

        <div className="glass rounded-3xl p-8 border border-dark-600/30">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-400">{errors.general}</p>
              </div>
            )}

            {/* Основная информация о компании */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white">Информация о компании</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Название компании *
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                      errors.companyName ? 'border-red-500' : 'border-dark-600'
                    }`}
                    placeholder="ООО 'Название компании'"
                  />
                  {errors.companyName && <p className="text-red-400 text-sm mt-1">{errors.companyName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    ИНН *
                  </label>
                  <input
                    type="text"
                    value={formData.inn}
                    onChange={(e) => handleInputChange('inn', e.target.value)}
                    className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                      errors.inn ? 'border-red-500' : 'border-dark-600'
                    }`}
                    placeholder="1234567890"
                    maxLength={12}
                  />
                  {errors.inn && <p className="text-red-400 text-sm mt-1">{errors.inn}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    ОГРН *
                  </label>
                  <input
                    type="text"
                    value={formData.ogrn}
                    onChange={(e) => handleInputChange('ogrn', e.target.value)}
                    className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                      errors.ogrn ? 'border-red-500' : 'border-dark-600'
                    }`}
                    placeholder="1234567890123"
                    maxLength={13}
                  />
                  {errors.ogrn && <p className="text-red-400 text-sm mt-1">{errors.ogrn}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Веб-сайт
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Юридический адрес *
                </label>
                <textarea
                  value={formData.legalAddress}
                  onChange={(e) => handleInputChange('legalAddress', e.target.value)}
                  className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors resize-none ${
                    errors.legalAddress ? 'border-red-500' : 'border-dark-600'
                  }`}
                  placeholder="Полный юридический адрес компании"
                  rows={2}
                />
                {errors.legalAddress && <p className="text-red-400 text-sm mt-1">{errors.legalAddress}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Фактический адрес
                </label>
                <textarea
                  value={formData.actualAddress}
                  onChange={(e) => handleInputChange('actualAddress', e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors resize-none"
                  placeholder="Фактический адрес (если отличается от юридического)"
                  rows={2}
                />
              </div>
            </div>

            {/* Контактная информация */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white">Контактная информация</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    ФИО контактного лица *
                  </label>
                  <input
                    type="text"
                    value={formData.contactPersonName}
                    onChange={(e) => handleInputChange('contactPersonName', e.target.value)}
                    className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                      errors.contactPersonName ? 'border-red-500' : 'border-dark-600'
                    }`}
                    placeholder="Иванов Иван Иванович"
                  />
                  {errors.contactPersonName && <p className="text-red-400 text-sm mt-1">{errors.contactPersonName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Должность *
                  </label>
                  <input
                    type="text"
                    value={formData.contactPersonPosition}
                    onChange={(e) => handleInputChange('contactPersonPosition', e.target.value)}
                    className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                      errors.contactPersonPosition ? 'border-red-500' : 'border-dark-600'
                    }`}
                    placeholder="HR-менеджер"
                  />
                  {errors.contactPersonPosition && <p className="text-red-400 text-sm mt-1">{errors.contactPersonPosition}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                      errors.email ? 'border-red-500' : 'border-dark-600'
                    }`}
                    placeholder="contact@company.com"
                  />
                  {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Телефон *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                      errors.phone ? 'border-red-500' : 'border-dark-600'
                    }`}
                    placeholder="+7 (999) 123-45-67"
                  />
                  {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Пароль */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Пароль *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                    errors.password ? 'border-red-500' : 'border-dark-600'
                  }`}
                  placeholder="Минимум 6 символов"
                  minLength={6}
                />
                {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
              </div>

              {/* Подтверждение пароля */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Подтвердите пароль *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (errors.confirmPassword) {
                      setErrors(prev => ({ ...prev, confirmPassword: '' }))
                    }
                  }}
                  className={`w-full px-4 py-3 bg-dark-800/50 border rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors ${
                    errors.confirmPassword ? 'border-red-500' : 'border-dark-600'
                  }`}
                  placeholder="Повторите пароль"
                  minLength={6}
                />
                {errors.confirmPassword && <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>


            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Описание компании
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:border-accent-blue focus:outline-none transition-colors resize-none"
                placeholder="Краткое описание деятельности компании, особенности работы, ценности..."
                rows={4}
              />
            </div>

            {/* Кнопки */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={() => onBack ? onBack() : navigate(-1)}
                className="px-8 py-3 border border-dark-600 text-dark-300 rounded-xl font-medium hover:border-dark-500 hover:text-white transition-colors"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 px-8 py-3 rounded-xl font-medium transition-all ${
                  isSubmitting
                    ? 'bg-dark-600 text-dark-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-accent-blue to-accent-purple text-white hover:scale-105 hover:shadow-xl hover:shadow-accent-blue/20'
                }`}
              >
                {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>

    </div>
  )
}

export default CompanyRegisterPage
