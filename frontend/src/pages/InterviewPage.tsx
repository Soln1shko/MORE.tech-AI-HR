import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AudioRecorder from '../components/AudioRecorder'
import { startInterview, saveInterviewAnswer, deleteInterview, InterviewData } from '../services/api'
import { ttsClient } from '../services/tts'

const InterviewPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'uploading' | 'recorded' | 'error'>('idle')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [isAIPreparingToSpeak, setIsAIPreparingToSpeak] = useState(false)
  const [showTranscription, setShowTranscription] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState("Начинаем собеседование...")
  const [transcription, setTranscription] = useState("")
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)  // Хранение последнего анализа
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null)
  const [interviewStatus, setInterviewStatus] = useState<'starting' | 'active' | 'completed' | 'error'>('starting')
  const isInitializing = useRef(false)
  
  // Получаем ID вакансии из state роутера
  const vacancyId = location.state?.vacancyId

  console.log('🔍 Компонент перерендерился, состояние:', {
    vacancyId,
    interviewData,
    interviewStatus,
    'location.state': location.state
  })

  // Инициализация собеседования при загрузке компонента
  useEffect(() => {
    console.log('🚀 useEffect инициализации запущен, vacancyId:', vacancyId)
    console.log('🔍 Текущее состояние interviewData:', interviewData)
    console.log('🔍 isInitializing.current:', isInitializing.current)
    
    // Предотвращаем повторную инициализацию
    if (interviewData !== null || isInitializing.current) {
      console.log('⚠️ Интервью уже инициализировано или инициализируется, пропускаем')
      return
    }
    
    isInitializing.current = true
    
    if (!vacancyId) {
      console.warn('❌ ID вакансии не найден, переходим к активному состоянию для тестирования')
      // Для тестирования позволим записывать без инициализации
      const testData = {
        interview_id: 'test_interview_id',
        mlinterview_id: '',
        status: 'active' as const
      }
      console.log('✅ Устанавливаем тестовые данные:', testData)
      setInterviewData(testData)
      setInterviewStatus('active')
      setCurrentQuestion('Добро пожаловать в наш сервис собеседований! Пожалуйста, кратко расскажите о себе. Удачи! (тестовый режим)')
      return
    }

    const initializeInterview = async () => {
      try {
        console.log('Начинаем инициализацию собеседования...')
        setInterviewStatus('starting')
        setCurrentQuestion('Инициализируем собеседование...')
        
        const response = await startInterview(vacancyId)
        console.log('🔍 Ответ от startInterview:', response)
        console.log('🔍 response.data:', response.data)
        console.log('🔍 response.data.interview_id:', response.data?.interview_id)
        console.log('🔍 JSON.stringify(response):', JSON.stringify(response, null, 2))
        
        if (response.success && response.data) {
          const interviewData = {
            interview_id: response.data.interview_id,
            mlinterview_id: '', // Будет заполнен при первом запросе
            status: 'active' as const
          }
          console.log('✅ Создаем interviewData:', interviewData)
          setInterviewData(interviewData)
          
          setInterviewStatus('active')
          const firstQuestion = 'Добро пожаловать в наш сервис собеседований! Пожалуйста, кратко расскажите о себе. Удачи!'
          setCurrentQuestion(firstQuestion)
          console.log('✅ Собеседование инициализировано, ожидаем ответ пользователя')
          
          // Озвучиваем первый вопрос
          playAIQuestion(firstQuestion)
        } else {
          console.error('Ошибка ответа:', response.error)
          // Для тестирования переходим к активному состоянию
          setInterviewData({
            interview_id: 'test_interview_id',
            mlinterview_id: '',
            status: 'active'
          })
          setInterviewStatus('active')
          setCurrentQuestion('Добро пожаловать в наш сервис собеседований! Коротко расскажите о себе. Удачи! (резервный режим)')
        }
      } catch (error) {
        console.error('Ошибка при инициализации собеседования:', error)
        // Для тестирования переходим к активному состоянию  
        setInterviewData({
          interview_id: 'test_interview_id',
          mlinterview_id: '',
          status: 'active'
        })
        setInterviewStatus('active')
        setCurrentQuestion('Добро пожаловать в наш сервис собеседований! Коротко расскажите о себе. Удачи! (ошибка инициализации)')
      }
    }

    initializeInterview()
  }, [vacancyId])


  const handleRecordingStart = useCallback(() => {
    setIsRecording(true)
    setRecordingStatus('recording')
    setTranscription('') // Очищаем предыдущую транскрипцию
  }, [])

  const handleRecordingStop = useCallback(() => {
    setIsRecording(false)
    setRecordingStatus('uploading')
  }, [])

  const handleUploadSuccess = useCallback((blob?: Blob) => {
    if (blob) {
      setAudioBlob(blob)
    }
    setRecordingStatus('recorded')
    
    // Fallback: если через 3 секунды нет транскрипции, добавляем тестовую
    setTimeout(() => {
      if (!transcription.trim()) {
        console.log('📝 Нет транскрипции, добавляем тестовую...')
        setTranscription('Привет, это тестовый ответ для проверки функциональности')
      }
    }, 30000)
  }, [transcription])

  const handleUploadError = useCallback(() => {
    setRecordingStatus('error')
    setTimeout(() => setRecordingStatus('idle'), 3000)
  }, [])

  const handleTranscription = useCallback((text: string) => {
    console.log('Получена транскрипция:', text)
    setTranscription(text)
    
    // Показать уведомление о получении транскрипции
    if (text.trim()) {
      console.log('Транскрипция обновлена, текущий текст:', text)
      
      // Автоматически имитируем транскрипцию для тестирования
      if (!text.includes('Это тестовая транскрипция')) {
        // Если транскрипция пустая или короткая, добавим тестовый текст
        setTimeout(() => {
          if (text.length < 10) {
            setTranscription('Это тестовая транскрипция для проверки функциональности')
            console.log('📝 Добавлена тестовая транскрипция')
          }
        }, 1000)
      }
    }
  }, [])

  const handleAnalysis = useCallback(async (analysis: any) => {
    console.log('🎯 Получен анализ речи:', analysis)
    
    // Сохраняем анализ в состоянии для использования при отправке ответа
    setLastAnalysis(analysis)
    console.log('💾 Анализ сохранен в состоянии, будет отправлен вместе с ответом')
  }, [])

  const handleSendAnswer = useCallback(async () => {
    console.log('🔍 handleSendAnswer вызван, состояние:', {
      interviewData,
      transcription: transcription.trim(),
      interviewStatus
    })

    if (!interviewData || !transcription.trim()) {
      console.error('Нет данных для отправки ответа', { interviewData, transcription: transcription.trim() })
      return
    }

    if (!interviewData.interview_id) {
      console.error('interview_id не найден, не можем отправить ответ', { interviewData })
      setRecordingStatus('error')
      setTimeout(() => setRecordingStatus('idle'), 3000)
      return
    }

    try {
      setRecordingStatus('uploading')

      // Определяем, это первый запрос или нет
      const isFirstRequest = !interviewData.mlinterview_id || interviewData.mlinterview_id === ''
      
      console.log(`📤 Отправляем ${isFirstRequest ? 'первый' : 'последующий'} ответ:`, {
        interview_id: interviewData.interview_id,
        mlinterview_id: interviewData.mlinterview_id,
        question: isFirstRequest ? '' : (interviewData.question || currentQuestion),
        answer_text: transcription
      })

      const response = await saveInterviewAnswer(
        interviewData.interview_id,
        interviewData.mlinterview_id || '',
        isFirstRequest ? '' : (interviewData.question || currentQuestion),
        transcription,
        lastAnalysis  // Передаем анализ речи
      )

      if (response.success && response.data) {
        // Проверяем статус собеседования
        if (response.data.status === 'completed') {
          setInterviewStatus('completed')
          setCurrentQuestion('Собеседование завершено!')
          setShowCompletionModal(true)
        } else {
          // Получили следующий вопрос
          const nextQuestion = response.data.question || response.data.current_question
          if (nextQuestion) {
            setCurrentQuestion(nextQuestion)
            setInterviewData(prev => prev ? {
              ...prev,
              mlinterview_id: response.data.mlinterview_id || prev.mlinterview_id,
              question: nextQuestion
            } : null)
            
            // Озвучиваем новый вопрос
            playAIQuestion(nextQuestion)
          }

          // Состояние обработки ответа завершено
        }

        // Сбрасываем состояние записи
        setRecordingStatus('idle')
        setTranscription('')
        setLastAnalysis(null)  // Очищаем анализ после отправки
        setAudioBlob(null)
      } else {
        throw new Error(response.error || 'Ошибка при отправке ответа')
      }
    } catch (error) {
      console.error('Ошибка при отправке ответа:', error)
      setRecordingStatus('error')
      setTimeout(() => setRecordingStatus('idle'), 3000)
    }
  }, [interviewData, transcription, currentQuestion, navigate])

  const handleSendAndNext = useCallback(async () => {
    // Используем новую функцию отправки ответа
    await handleSendAnswer()
  }, [handleSendAnswer])

  const handleRerecord = useCallback(() => {
    setAudioBlob(null)
    setRecordingStatus('idle')
  }, [])



  const handleExitClick = useCallback(() => {
    setShowExitModal(true)
  }, [])

  const handleConfirmExit = useCallback(async () => {
    // Удаляем интервью из базы данных, если есть interview_id
    if (interviewData?.interview_id) {
      try {
        console.log('🗑️ Удаляем интервью с ID:', interviewData.interview_id)
        const result = await deleteInterview(interviewData.interview_id)
        
        if (result.success) {
          console.log('✅ Интервью успешно удалено')
        } else {
          console.error('❌ Ошибка при удалении интервью:', result.error)
        }
      } catch (error) {
        console.error('❌ Ошибка при удалении интервью:', error)
      }
    }

    // Сброс состояния записи
    setIsRecording(false)
    setRecordingStatus('idle')
    setAudioBlob(null)
    
    // Переход на главную страницу
    navigate('/welcomescreen')
  }, [navigate, interviewData?.interview_id])

  const handleCancelExit = useCallback(() => {
    setShowExitModal(false)
  }, [])

  const handleLogoClick = useCallback(() => {
    // При клике на логотип показываем модальное окно выхода
    setShowExitModal(true)
  }, [])

  const handleCompletionModalClose = useCallback(() => {
    setShowCompletionModal(false)
    navigate('/welcomescreen')
  }, [navigate])

  const playAIQuestion = useCallback(async (questionText: string) => {
    if (!questionText || questionText.trim() === '') return;
    
    try {
      console.log('🎤 Начинаем синтез речи для вопроса:', questionText);
      
      // Сразу блокируем микрофон на этапе подготовки
      setIsAIPreparingToSpeak(true);
      
      // Подключаемся к TTS серверу если нужно
      if (!ttsClient.isConnected()) {
        await ttsClient.connect();
      }
      
      // Получаем аудио от TTS сервера
      const audioBlob = await ttsClient.speak(questionText, 'xenia', 48000);
      
      // Создаем URL для воспроизведения
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Настраиваем обработчики аудио
      audio.onended = () => {
        console.log('🎵 Воспроизведение завершено - выключаем подсветку');
        setIsAISpeaking(false);
        setIsAIPreparingToSpeak(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (error) => {
        console.error('❌ Ошибка воспроизведения аудио:', error);
        setIsAISpeaking(false);
        setIsAIPreparingToSpeak(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onpause = () => {
        console.log('⏸️ Воспроизведение приостановлено - выключаем подсветку');
        setIsAISpeaking(false);
        setIsAIPreparingToSpeak(false);
      };
      
      // Включаем подсветку и убираем состояние подготовки
      console.log('✨ Включаем подсветку перед воспроизведением');
      setIsAISpeaking(true);
      setIsAIPreparingToSpeak(false);
      
      // Запускаем воспроизведение
      await audio.play();
      console.log('▶️ Воспроизведение запущено');
      
    } catch (error) {
      console.error('❌ Ошибка синтеза или воспроизведения речи:', error);
      setIsAISpeaking(false);
      setIsAIPreparingToSpeak(false);
    }
  }, [])

  // Инициализация TTS при загрузке компонента
  useEffect(() => {
    console.log('🎤 Инициализация TTS клиента...')
    ttsClient.connect().catch((error) => {
      console.warn('⚠️ TTS сервер недоступен:', error)
    })
    
    return () => {
      ttsClient.disconnect()
    }
  }, [])

  return (
    <div className="min-h-screen bg-dark-950 text-white relative overflow-hidden focus:outline-none">
      {/* Фоновые элементы */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 30%, rgba(59, 130, 246, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
        <div className="absolute top-1/3 -right-48 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.04) 30%, rgba(168, 85, 247, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.03) 30%, rgba(16, 185, 129, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.06) 0%, rgba(245, 158, 11, 0.03) 30%, rgba(245, 158, 11, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
      </div>

      {/* TopPanel как на Welcome странице с кнопкой Назад */}
      <div className="fixed top-0 left-0 right-0 z-50 p-6">
        <div className="glass rounded-2xl px-8 py-4 w-full">
          <div className="flex items-center justify-between">
            {/* Логотип/название */}
            <div 
              className="flex items-center space-x-3 cursor-pointer group transition-all duration-200 hover:scale-105"
              onClick={handleLogoClick}
            >
              <img 
                src="/vtb.png" 
                alt="VTB Logo" 
                className="w-10 h-10 object-contain rounded-lg transition-all duration-200 group-hover:opacity-80"
              />
              <h1 className="text-xl font-semibold text-white tracking-tight transition-all duration-200 group-hover:text-accent-blue">MORE.tech</h1>
            </div>

            {/* Кнопка Назад */}
            <button 
              onClick={handleExitClick}
              className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50 focus:outline-none"
            >
              <div className="flex items-center space-x-2 relative z-10">
                <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
                </svg>
                <span className="text-sm font-medium">Назад</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
            </button>
          </div>
        </div>
      </div>
      
      {/* Видеоконференция в стиле Zoom/Discord */}
      <div className="relative z-10 pt-40 pb-20 px-6">
        <div className="w-full max-w-7xl mx-auto">
          
          {/* Заголовок видеоконференции */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
              AI Собеседование
            </h1>
            
            <div className="w-32 h-px bg-gradient-to-r from-transparent via-dark-600 to-transparent mx-auto mb-8"></div>
            
          </div>

          {/* Основная область с участниками видеоконференции */}
          <div className="mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              
              {/* Пользователь - теперь слева */}
              <div className="relative glass rounded-3xl border border-dark-600/30 overflow-hidden">
                <div style={{ aspectRatio: '4/3' }} className="relative">
                  {/* Аватар пользователя */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`relative transition-all duration-300 ${
                      isRecording ? 'animate-pulse' : ''
                    }`}>
                      <div className={`w-40 h-40 rounded-full border-4 transition-all duration-300 ${
                        isRecording 
                          ? 'border-green-500 shadow-xl shadow-green-500/50' 
                          : 'border-dark-600'
                      }`} style={{
                        background: isRecording 
                          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3))'
                          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))'
                      }}>
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center">
                          <svg className="w-20 h-20 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                        </div>
                      </div>
                      
                            </div>
                          </div>
                        </div>
                
                {/* Информация о пользователе */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dark-900/90 to-transparent p-6">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-semibold text-lg">Вы</span>
                    </div>
                  </div>
                </div>
                            </div>
                    
              {/* AI Ассистент - теперь справа */}
              <div className="relative glass rounded-3xl border border-dark-600/30 overflow-hidden">
                <div style={{ aspectRatio: '4/3' }} className="relative">
                  {/* Аватар AI */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`relative transition-all duration-300 ${
                      isAISpeaking ? 'animate-pulse' : ''
                    }`}>
                      <div className={`w-40 h-40 rounded-full border-4 transition-all duration-300 ${
                        isAISpeaking 
                          ? 'border-accent-blue shadow-xl shadow-accent-blue/50' 
                          : 'border-dark-600'
                      }`} style={{
                        background: isAISpeaking 
                          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3))'
                          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))'
                      }}>
                        <img 
                          src="/assistant.jpg" 
                          alt="AI Assistant"
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className="hidden w-full h-full rounded-full bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 flex items-center justify-center">
                          <svg className="w-20 h-20 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          </div>
                        </div>
                      
                    </div>
                    </div>
                    
                  {/* Кнопка транскрипции для AI */}
                      <button
                    onClick={() => setShowTranscription(true)}
                    className="absolute top-4 right-4 bg-dark-800/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm hover:bg-dark-700/80 transition-colors focus:outline-none"
                  >
                    Транскрипция
                  </button>
                        </div>
                
                {/* Информация об AI */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dark-900/90 to-transparent p-6">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-semibold text-lg">Ассистент Кирилл</span>
                    </div>
                  </div>
                </div>
                </div>
            </div>
          </div>

          {/* Нижняя панель управления */}
          <div className="flex items-center justify-center">
                    {recordingStatus === 'recorded' ? (
          <div className="flex flex-col items-center space-y-4">
            {/* Отображение транскрипции */}
            {transcription && (
              <div className="max-w-2xl p-4 bg-dark-800/50 rounded-xl border border-dark-600/30">
                <h4 className="text-sm text-dark-400 mb-2">Ваш ответ:</h4>
                <p className="text-white text-sm leading-relaxed">{transcription}</p>
                        </div>
            )}
                      
            <div className="flex items-center space-x-4">
                      <button
                        onClick={handleRerecord}
                className="px-6 py-3 bg-dark-700/50 hover:bg-dark-600/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300 hover:scale-105 focus:outline-none"
              >
                Перезаписать
              </button>
              <button
                onClick={handleSendAndNext}
                disabled={!transcription.trim()}
                className="px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg shadow-accent-blue/25 disabled:shadow-none focus:outline-none"
              >
                Отправить и продолжить
                      </button>
                    </div>
                  </div>
            ) : (
              <div className="relative flex items-center justify-center min-h-[120px]">
                {/* Описание слева - исчезает при записи */}
                <div className={`absolute right-full mr-8 text-right w-80 transition-all duration-500 focus:outline-none select-none pointer-events-none ${isRecording ? 'opacity-0' : 'opacity-100'}`}>
                  {(isAISpeaking || isAIPreparingToSpeak) ? (
                    <div className="focus:outline-none">
                      <p className="text-amber-400 text-sm leading-relaxed font-medium focus:outline-none">
                        {isAIPreparingToSpeak ? '⏳ Ассистент Кирилл готовит вопрос...' : '🎤 Ассистент Кирилл говорит...'}
                      </p>
                      <p className="text-dark-400 text-xs mt-2 focus:outline-none">
                        Дождитесь окончания вопроса, затем можете отвечать.
                      </p>
                </div>
              ) : (
                    <div className="focus:outline-none">
                      <p className="text-dark-300 text-sm leading-relaxed focus:outline-none">
                        Нажмите на <span className="text-red-400 font-medium focus:outline-none">красный микрофон</span> для начала записи. 
                        Ассистент Кирилл ждёт вашего рассказа о себе.
                      </p>
                      <p className="text-dark-400 text-xs mt-2 focus:outline-none">
                        По завершению вашей речи, выключите микрофон.
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Микрофон всегда в центре */}
                  <AudioRecorder
                    onRecordingStart={handleRecordingStart}
                    onRecordingStop={handleRecordingStop}
                    onUploadSuccess={handleUploadSuccess}
                    onUploadError={handleUploadError}
                    onTranscription={handleTranscription}
                    onAnalysis={handleAnalysis}
                    isRecording={isRecording}
                    disabled={recordingStatus === 'uploading' || interviewStatus !== 'active' || isAISpeaking || isAIPreparingToSpeak}
                  />
                </div>
              )}
            </div>
          </div>
                </div>
                
      {/* Модальное окно транскрипции */}
      {showTranscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Фон */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowTranscription(false)}
          ></div>
          
          {/* Модальное окно */}
          <div className="relative glass rounded-3xl max-w-2xl w-full max-h-[80vh] border border-dark-600/30 shadow-2xl animate-fade-in-scale overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold text-xl">Текущий вопрос</h3>
                <button
                  onClick={() => setShowTranscription(false)}
                  className="w-10 h-10 bg-dark-700/50 hover:bg-dark-600/50 rounded-full flex items-center justify-center text-dark-300 hover:text-white transition-colors focus:outline-none"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
                </button>
                </div>
                
              <div className="overflow-y-auto space-y-4 max-h-[60vh]">
                {/* Сообщение от AI */}
                <div className="flex items-start space-x-3 animate-fade-in">
                  <div className="w-12 h-12 bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 rounded-full flex items-center justify-center flex-shrink-0 border border-accent-blue/30">
                    <svg className="w-6 h-6 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-accent-blue mb-2 font-medium">Ассистент Кирилл</div>
                    <div className="glass rounded-xl p-4 border border-accent-blue/20">
                      <p className="text-dark-200 leading-relaxed">{currentQuestion}</p>
                  </div>
                  </div>
                </div>
                
                {/* Если есть запись пользователя */}
                {audioBlob && (
                  <div className="flex items-start space-x-3 animate-fade-in">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-full flex items-center justify-center flex-shrink-0 border border-green-500/30">
                      <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                    <div className="flex-1">
                      <div className="text-sm text-green-400 mb-2 font-medium">Вы</div>
                      <div className="glass rounded-xl p-4 border border-green-500/20">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-green-300 text-sm">Аудиозапись получена</span>
                  </div>
                        <p className="text-dark-200">Обрабатывается транскрипция...</p>
                </div>
              </div>
            </div>
          )}
        </div>

              {/* Информация внизу */}
              <div className="mt-6 pt-4 border-t border-dark-600/30">
                <div className="flex items-center justify-center space-x-2 text-dark-400 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Сессия активна</span>
                  </div>
                  </div>
                </div>
        </div>
      </div>
      )}

      {/* Модальное окно подтверждения выхода */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Фон */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={handleCancelExit}
          ></div>
          
          {/* Модальное окно */}
          <div className="relative glass rounded-3xl max-w-md w-full border border-dark-600/30 shadow-2xl animate-fade-in-scale overflow-hidden">
            <div className="p-6">
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
              </div>
                <h3 className="text-white font-semibold text-xl mb-2">Завершить собеседование?</h3>
                <p className="text-dark-300 text-sm">
                  Вы уверены, что хотите выйти? Это прервет текущее собеседование и весь прогресс будет потерян.
              </p>
            </div>
            
              <div className="flex items-center space-x-3">
              <button
                  onClick={handleCancelExit}
                  className="flex-1 px-6 py-3 glass border border-dark-600/40 hover:border-dark-500/50 text-dark-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 focus:outline-none"
              >
                  Отмена
              </button>
              <button
                  onClick={handleConfirmExit}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg shadow-red-500/25 focus:outline-none"
              >
                  Выйти
              </button>
                  </div>
                  </div>
                </div>
              </div>
      )}

      {/* Модальное окно завершения собеседования */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Фон */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
          ></div>
          
          {/* Модальное окно */}
          <div className="relative glass rounded-3xl max-w-lg w-full border border-dark-600/30 shadow-2xl animate-fade-in-scale overflow-hidden">
            <div className="p-8">
              <div className="text-center mb-8">
                {/* Иконка успеха */}
                <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500/30">
                  <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                
                <h3 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  Собеседование завершено!
                </h3>
                <p className="text-dark-300 text-lg leading-relaxed">
                  Спасибо за прохождение AI собеседования. 
                  <br />
                  Результаты будут обработаны и переданы HR-специалистам.
                </p>
              </div>

              {/* Дополнительная информация */}
              <div className="bg-dark-700/30 p-4 rounded-xl mb-6 border border-dark-600/30">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Интервью успешно записано</span>
                  </div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-blue-400 text-sm font-medium">Ответы проанализированы AI</span>
                  </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-purple-400 text-sm font-medium">Результаты переданы компании</span>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleCompletionModalClose}
                  className="px-8 py-4 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-xl shadow-accent-blue/25 focus:outline-none"
                >
                  Вернуться на главную
                </button>
                
                <p className="text-dark-400 text-xs mt-4">
                  Мы свяжемся с вами в ближайшее время с результатами
                    </p>
                  </div>
                </div>
              </div>
            </div>
      )}

    </div>
  )
}

export default InterviewPage

