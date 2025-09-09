import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TopPanel from '../components/TopPanel'
import WelcomeScreen from '../components/WelcomeScreen'

const WelcomeScreenPage: React.FC = () => {
  const navigate = useNavigate()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)

  const [selectedVacancyId, setSelectedVacancyId] = useState<string | null>(null)

  const handleStartInterview = useCallback((vacancyId: string) => {
    console.log('Получен vacancyId для собеседования:', vacancyId)
    setSelectedVacancyId(vacancyId)
    setShowConfirmation(true)
  }, [])

  const handleConfirmStart = useCallback(() => {
    setShowConfirmation(false)
    setShowRulesModal(true)
  }, [])

  const handleRulesAccept = useCallback(() => {
    setShowRulesModal(false)
    if (selectedVacancyId) {
      console.log('Переходим на собеседование с vacancyId:', selectedVacancyId)
      navigate('/interview', { state: { vacancyId: selectedVacancyId } })
    } else {
      console.error('Нет выбранной вакансии для собеседования')
      navigate('/interview') // Переход без vacancyId для тестирования
    }
  }, [navigate, selectedVacancyId])

  const handleRulesCancel = useCallback(() => {
    setShowRulesModal(false)
  }, [])

  const handleCancelStart = useCallback(() => {
    setShowConfirmation(false)
  }, [])


  const handleLogoClick = () => {
    // На странице приветствия логотип может просто обновить страницу
    window.location.reload()
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
      
      {/* Верхняя панель */}
      <TopPanel onLogoClick={handleLogoClick} />
      
      {/* Основной контент */}
      <WelcomeScreen 
        onStartInterview={handleStartInterview} 
      />

      {/* Модальное окно подтверждения */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Фон */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={handleCancelStart}
          ></div>
          
          {/* Модальное окно */}
          <div className="relative glass rounded-3xl p-8 max-w-md w-full border border-dark-600/30 shadow-2xl animate-fade-in-scale">
            <div className="text-center">
              {/* Иконка */}
              <div className="w-16 h-16 bg-accent-blue/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              
              <h3 className="text-2xl font-light text-white mb-4">Подтверждение</h3>
              <p className="text-dark-300 text-lg mb-8">
                Вы точно готовы начать AI собеседование?
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={handleCancelStart}
                  className="flex-1 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300"
                >
                  Отмена
                </button>
                
                <button
                  onClick={handleConfirmStart}
                  className="flex-1 px-6 py-3 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105"
                >
                  Да, начать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно с правилами */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Фон */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={handleRulesCancel}
          ></div>
          
          {/* Модальное окно */}
          <div className="relative glass rounded-3xl p-8 max-w-2xl w-full border border-dark-600/30 shadow-2xl animate-fade-in-scale max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              {/* Иконка */}
              <div className="w-16 h-16 bg-accent-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                </svg>
              </div>
              
              <h3 className="text-3xl font-bold text-white mb-2">
                Правила прохождения собеседования
              </h3>
              <p className="text-dark-300 text-lg">
                Внимательно ознакомьтесь с условиями
              </p>
            </div>
            
            <div className="space-y-6 mb-8">
              {/* Ограничение времени */}
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15,1H9V3H15M11,14H13V8H11M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39Z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-orange-300 font-semibold mb-2">⏰ Время ограничено</h4>
                    <p className="text-orange-200/80 text-sm">
                      На прохождение собеседования отводится ограниченное время. 
                      Рекомендуется заранее подготовиться и не откладывать ответы на потом.
                    </p>
                  </div>
                </div>
              </div>

              {/* Рекомендации по записи */}
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-red-300 font-semibold mb-2">🎤 Рекомендации по записи</h4>
                    <p className="text-red-200/80 text-sm mb-2">
                      Лучше не делать много попыток записать голос:
                    </p>
                    <ul className="text-red-200/80 text-sm space-y-1 list-disc list-inside">
                      <li>Найдите тихое место для записи</li>
                      <li>Проверьте микрофон заранее</li>
                      <li>Говорите четко и уверенно</li>
                      <li>Подумайте над ответом перед началом записи</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Общие правила */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-blue-300 font-semibold mb-2">📋 Общие правила</h4>
                    <ul className="text-blue-200/80 text-sm space-y-1 list-disc list-inside">
                      <li>Отвечайте честно и подробно</li>
                      <li>Приводите конкретные примеры из опыта</li>
                      <li>Не используйте сторонние материалы</li>
                      <li>Говорите от первого лица</li>
                      <li>При технических проблемах обратитесь к администратору</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Техническая информация */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1M10 17L6 13L7.41 11.59L10 14.17L16.59 7.59L18 9L10 17Z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-green-300 font-semibold mb-2">🔒 Конфиденциальность</h4>
                    <p className="text-green-200/80 text-sm">
                      Ваши записи обрабатываются с использованием современных технологий ИИ 
                      и защищены в соответствии с требованиями безопасности данных.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRulesCancel}
                className="px-6 py-3 bg-dark-700/50 hover:bg-dark-600/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-colors duration-300"
              >
                Вернуться назад
              </button>
              
              <button
                onClick={handleRulesAccept}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105"
              >
                Понятно, начать собеседование
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WelcomeScreenPage
