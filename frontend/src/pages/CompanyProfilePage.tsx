import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopPanel from '../components/TopPanel'
import { getCompanyProfileData, updateCompanyProfileData, CompanyProfileData } from '../services/api'

// Используем интерфейс из api.ts
type CompanyProfile = CompanyProfileData

const CompanyProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [editData, setEditData] = useState<CompanyProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await getCompanyProfileData()
      setProfile(data)
      setEditData(data)
    } catch (err) {
      setError('Ошибка при загрузке профиля компании')
      console.error('Ошибка загрузки профиля:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditData(profile)
  }

  const handleSave = async () => {
    if (!editData) return

    try {
      setSaving(true)
      const updatedProfile = await updateCompanyProfileData(editData)
      setProfile(updatedProfile)
      setEditData(updatedProfile)
      setIsEditing(false)
    } catch (err) {
      setError('Ошибка при сохранении профиля')
      console.error('Ошибка сохранения:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (section: string, field: string, value: any) => {
    if (!editData) return
    
    setEditData({
      ...editData,
      [section]: {
        ...(editData as any)[section],
        [field]: value
      }
    })
  }

  const handleArrayChange = (field: string, index: number, value: string) => {
    if (!editData) return
    
    const currentArray = (editData as any)[field] || []
    const newArray = [...currentArray]
    newArray[index] = value
    
    setEditData({
      ...editData,
      [field]: newArray
    })
  }

  const addArrayItem = (field: string) => {
    if (!editData) return
    
    const currentArray = (editData as any)[field] || []
    setEditData({
      ...editData,
      [field]: [...currentArray, '']
    })
  }

  const removeArrayItem = (field: string, index: number) => {
    if (!editData) return
    
    const currentArray = (editData as any)[field] || []
    const newArray = currentArray.filter((_: any, i: number) => i !== index)
    
    setEditData({
      ...editData,
      [field]: newArray
    })
  }

  const handleLogoClick = () => {
    navigate('/company-dashboard')
  }

  if (loading) {
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

        <TopPanel onLogoClick={handleLogoClick} />
        <div className="relative z-10 min-h-screen pt-36 pb-20 px-6">
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
            <span className="ml-3 text-dark-300">Загрузка профиля...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
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
        </div>

        <TopPanel onLogoClick={handleLogoClick} />
        <div className="relative z-10 min-h-screen pt-36 pb-20 px-6">
          <div className="text-center py-20">
            <div className="text-red-400 mb-4">{error}</div>
            <button
              onClick={loadProfile}
              className="px-6 py-2 bg-accent-blue hover:bg-accent-blue/80 text-white rounded-xl transition-colors"
            >
              Попробовать снова
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
        <div className="max-w-4xl mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Профиль компании
            </h1>
            <p className="text-dark-400 text-lg">
              Создайте привлекательную страницу компании для кандидатов
            </p>
          </div>

          {/* Основная карточка */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30">
            
            {/* 1. Основная информация */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-blue to-accent-purple rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,7V3H2V21H22V7H12M6,19H4V17H6V19M6,15H4V13H6V15M6,11H4V9H6V11M6,7H4V5H6V7M10,19H8V17H10V19M10,15H8V13H10V15M10,11H8V9H10V11M10,7H8V5H10V7M20,19H12V17H20V19M20,15H12V13H20V15M20,11H12V9H20V11Z"/>
                  </svg>
                </div>
                Основная информация
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Название компании (только для чтения - из companies таблицы) */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Название компании *
                    <span className="ml-2 text-xs text-dark-400">(изменяется в настройках компании)</span>
                  </label>
                  <div className="px-4 py-3 bg-dark-800/20 border border-dark-600/20 rounded-xl text-dark-300">
                    {profile?.basic_info?.company_name || 'Не указано'}
                  </div>
                </div>

                {/* Веб-сайт */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Веб-сайт
                  </label>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editData?.basic_info?.website || ''}
                      onChange={(e) => handleInputChange('basic_info', 'website', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                      placeholder="https://example.com"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.basic_info?.website ? (
                        <a 
                          href={profile.basic_info.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-accent-blue hover:underline"
                        >
                          {profile.basic_info.website}
                        </a>
                      ) : (
                        'Не указано'
                      )}
                    </div>
                  )}
                </div>

                {/* Сфера деятельности */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Сфера деятельности
                  </label>
                  {isEditing ? (
                    <select
                      value={editData?.basic_info?.industry || ''}
                      onChange={(e) => handleInputChange('basic_info', 'industry', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                    >
                      <option value="">Выберите сферу</option>
                      <option value="IT">Информационные технологии</option>
                      <option value="Finance">Финансы и банковское дело</option>
                      <option value="Healthcare">Здравоохранение</option>
                      <option value="Education">Образование</option>
                      <option value="Retail">Розничная торговля</option>
                      <option value="Manufacturing">Производство</option>
                      <option value="Construction">Строительство</option>
                      <option value="Real Estate">Недвижимость</option>
                      <option value="Media">СМИ и реклама</option>
                      <option value="Government">Государственный сектор</option>
                      <option value="Other">Другое</option>
                    </select>
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.basic_info?.industry || 'Не указано'}
                    </div>
                  )}
                </div>

                {/* IT-аккредитация */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    IT-аккредитация
                  </label>
                  {isEditing ? (
                    <label className="flex items-center space-x-3 px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editData?.basic_info?.is_it_accredited || false}
                        onChange={(e) => handleInputChange('basic_info', 'is_it_accredited', e.target.checked)}
                        className="w-4 h-4 text-accent-blue bg-dark-800 border-dark-600 rounded focus:ring-accent-blue focus:ring-2"
                      />
                      <span className="text-white">Аккредитованная IT-компания</span>
                    </label>
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded ${profile?.basic_info?.is_it_accredited ? 'bg-accent-blue' : 'bg-dark-600'}`}></div>
                      <span>Аккредитованная IT-компания</span>
                      {profile?.basic_info?.is_it_accredited && (
                        <span className="ml-2 px-2 py-1 bg-accent-blue/20 text-accent-blue rounded-full text-xs">
                          ✓ Подтверждено
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Подробное описание */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-purple to-accent-blue rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                </div>
                Подробное описание
                <span className="ml-2 text-sm text-dark-400">(не менее 200 символов)</span>
              </h2>
              
              <div className="space-y-6">
                {/* Чем занимается компания */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Чем занимается компания
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editData?.detailed_description?.about_company || ''}
                      onChange={(e) => handleInputChange('detailed_description', 'about_company', e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                      placeholder="Расскажите о ваших продуктах, услугах и миссии. Опишите, чем вы уникальны и какое место занимаете на рынке..."
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white min-h-[100px]">
                      {profile?.detailed_description?.about_company || 'Описание не заполнено'}
                    </div>
                  )}
                </div>

                {/* О команде */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    О команде
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editData?.detailed_description?.about_team || ''}
                      onChange={(e) => handleInputChange('detailed_description', 'about_team', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                      placeholder="Расскажите о коллективе, какие специалисты работают, атмосфера в команде..."
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white min-h-[80px]">
                      {profile?.detailed_description?.about_team || 'Описание команды не заполнено'}
                    </div>
                  )}
                </div>

                {/* Размер команды */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Размер команды
                  </label>
                  {isEditing ? (
                    <select
                      value={editData?.detailed_description?.team_size || ''}
                      onChange={(e) => handleInputChange('detailed_description', 'team_size', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                    >
                      <option value="">Выберите размер</option>
                      <option value="1-10">1-10 сотрудников</option>
                      <option value="11-50">11-50 сотрудников</option>
                      <option value="51-200">51-200 сотрудников</option>
                      <option value="201-500">201-500 сотрудников</option>
                      <option value="501-1000">501-1000 сотрудников</option>
                      <option value="1000+">Более 1000 сотрудников</option>
                    </select>
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.detailed_description?.team_size || 'Не указано'}
                    </div>
                  )}
                </div>

                {/* Корпоративная культура */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Корпоративная культура и ценности
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editData?.detailed_description?.corporate_culture || ''}
                      onChange={(e) => handleInputChange('detailed_description', 'corporate_culture', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                      placeholder="Опишите принципы работы, стиль общения, поддержку командного духа, корпоративные мероприятия..."
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white min-h-[80px]">
                      {profile?.detailed_description?.corporate_culture || 'Описание культуры не заполнено'}
                    </div>
                  )}
                </div>

                {/* Условия работы */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Условия работы
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editData?.detailed_description?.work_conditions || ''}
                      onChange={(e) => handleInputChange('detailed_description', 'work_conditions', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                      placeholder="График работы, система премий, частота выплат, официальное оформление, дополнительные бонусы..."
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white min-h-[80px]">
                      {profile?.detailed_description?.work_conditions || 'Условия работы не указаны'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Преимущества и льготы */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-blue to-accent-purple rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                  </svg>
                </div>
                Преимущества работы
              </h2>
              
              {isEditing ? (
                <div className="space-y-3">
                  {(editData?.benefits || []).map((benefit, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={benefit}
                        onChange={(e) => handleArrayChange('benefits', index, e.target.value)}
                        className="flex-1 px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                        placeholder="Введите преимущество"
                      />
                      <button
                        onClick={() => removeArrayItem('benefits', index)}
                        className="p-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('benefits')}
                    className="flex items-center space-x-2 px-4 py-3 border border-dark-600/50 rounded-xl text-dark-300 hover:text-white hover:border-dark-500/50 hover:bg-dark-800/30 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                    </svg>
                    <span>Добавить преимущество</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile?.benefits && profile.benefits.length > 0 ? (
                    profile.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center space-x-3 px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl">
                        <svg className="w-4 h-4 text-accent-blue flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                        </svg>
                        <span className="text-white">{benefit}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-dark-400">
                      Преимущества не указаны
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Специализации */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-purple to-accent-blue rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                  </svg>
                </div>
                Специализации
              </h2>
              
              {isEditing ? (
                <div className="space-y-3">
                  {(editData?.additional_info?.specializations || []).map((spec, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={spec}
                        onChange={(e) => {
                          const newSpecs = [...(editData?.additional_info?.specializations || [])]
                          newSpecs[index] = e.target.value
                          handleInputChange('additional_info', 'specializations', newSpecs)
                        }}
                        className="flex-1 px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                        placeholder="Введите специализацию"
                      />
                      <button
                        onClick={() => {
                          const newSpecs = (editData?.additional_info?.specializations || []).filter((_, i) => i !== index)
                          handleInputChange('additional_info', 'specializations', newSpecs)
                        }}
                        className="p-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newSpecs = [...(editData?.additional_info?.specializations || []), '']
                      handleInputChange('additional_info', 'specializations', newSpecs)
                    }}
                    className="flex items-center space-x-2 px-4 py-3 border border-dark-600/50 rounded-xl text-dark-300 hover:text-white hover:border-dark-500/50 hover:bg-dark-800/30 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                    </svg>
                    <span>Добавить специализацию</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile?.additional_info?.specializations && profile.additional_info.specializations.length > 0 ? (
                    profile.additional_info.specializations.map((spec, index) => (
                      <span
                        key={index}
                        className="px-3 py-2 bg-accent-blue/20 text-accent-blue rounded-xl text-sm border border-accent-blue/30"
                      >
                        {spec}
                      </span>
                    ))
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-dark-400">
                      Специализации не указаны
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. Контактная информация */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-blue to-accent-purple rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z"/>
                  </svg>
                </div>
                Контактная информация
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email (только для чтения - из companies таблицы) */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Email
                    <span className="ml-2 text-xs text-dark-400">(изменяется в настройках компании)</span>
                  </label>
                  <div className="px-4 py-3 bg-dark-800/20 border border-dark-600/20 rounded-xl text-dark-300">
                    {profile?.contact_info?.email || 'Не указано'}
                  </div>
                </div>

                {/* Телефон */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Телефон
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editData?.contact_info?.phone || ''}
                      onChange={(e) => handleInputChange('contact_info', 'phone', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                      placeholder="+7 (999) 123-45-67"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.contact_info?.phone || 'Не указано'}
                    </div>
                  )}
                </div>

                {/* Город */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Город
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData?.contact_info?.city || ''}
                      onChange={(e) => handleInputChange('contact_info', 'city', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                      placeholder="Москва"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.contact_info?.city || 'Не указано'}
                    </div>
                  )}
                </div>

                {/* Страна */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Страна
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData?.contact_info?.country || ''}
                      onChange={(e) => handleInputChange('contact_info', 'country', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                      placeholder="Россия"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.contact_info?.country || 'Не указано'}
                    </div>
                  )}
                </div>

                {/* Адрес (только для чтения - из companies таблицы как legal_address) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Юридический адрес
                    <span className="ml-2 text-xs text-dark-400">(изменяется в настройках компании)</span>
                  </label>
                  <div className="px-4 py-3 bg-dark-800/20 border border-dark-600/20 rounded-xl text-dark-300">
                    {profile?.contact_info?.address || 'Не указано'}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Социальные сети */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-accent-purple to-accent-blue rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/>
                  </svg>
                </div>
                Социальные сети
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LinkedIn */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    LinkedIn
                  </label>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editData?.social_links?.linkedin || ''}
                      onChange={(e) => handleInputChange('social_links', 'linkedin', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                      placeholder="https://linkedin.com/company/..."
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.social_links?.linkedin ? (
                        <a 
                          href={profile.social_links.linkedin} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-accent-blue hover:underline"
                        >
                          {profile.social_links.linkedin}
                        </a>
                      ) : (
                        'Не указано'
                      )}
                    </div>
                  )}
                </div>

                {/* Telegram */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Telegram
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData?.social_links?.telegram || ''}
                      onChange={(e) => handleInputChange('social_links', 'telegram', e.target.value)}
                      className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                      placeholder="@company_channel"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-dark-800/30 border border-dark-600/30 rounded-xl text-white">
                      {profile?.social_links?.telegram || 'Не указано'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Кнопки управления */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-dark-600/30">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex-1 px-6 py-4 border border-dark-600/50 text-dark-300 rounded-xl font-medium hover:border-dark-500/50 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Отменить
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="flex-1 px-6 py-4 bg-accent-blue hover:bg-accent-blue/80 text-white rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                  </svg>
                  <span>Редактировать профиль</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompanyProfilePage