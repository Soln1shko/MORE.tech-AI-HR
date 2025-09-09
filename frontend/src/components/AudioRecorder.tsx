import React, { useState, useRef, useCallback, useEffect } from 'react'
import { getGlobalWebSocketClient } from '../services/websocket'

interface AudioRecorderProps {
  onRecordingStart: () => void
  onRecordingStop: () => void
  onUploadSuccess: (blob?: Blob) => void
  onUploadError: () => void
  onTranscription?: (text: string) => void
  onAnalysis?: (analysis: any) => void
  isRecording: boolean
  disabled?: boolean
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingStart,
  onRecordingStop,
  onUploadSuccess,
  onUploadError,
  onTranscription,
  onAnalysis,
  isRecording,
  disabled = false
}) => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const audioChunks = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wsClient = useRef<any>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Инициализация глобального WebSocket клиента
  useEffect(() => {
    const initializeWebSocket = async () => {
      // Получаем глобальный экземпляр WebSocket клиента
      wsClient.current = getGlobalWebSocketClient(
        (text: string) => {
          console.log('Транскрипция получена:', text)
          onTranscription?.(text)
        },
        (error: string) => {
          console.error('Ошибка WebSocket:', error)
          onUploadError()
        },
        () => {
          console.log('WebSocket подключен')
          setWsConnected(true)
        },
        () => {
          console.log('WebSocket отключен')
          setWsConnected(false)
        },
        (analysis: any) => {
          console.log('Анализ получен:', analysis)
          onAnalysis?.(analysis)
        }
      )

      // Подключаемся если еще не подключены
      try {
        if (!wsClient.current.connected) {
          await wsClient.current.connect()
          console.log('🔗 WebSocket успешно инициализирован и готов к работе')
        } else {
          console.log('🔗 WebSocket уже подключен, переиспользуем соединение')
          setWsConnected(true) // ✅ Устанавливаем состояние для уже подключенного WebSocket
        }
        // Дополнительная проверка состояния после подключения/переиспользования
        console.log('🔍 Проверяем состояние WebSocket:', wsClient.current.connected)
        if (wsClient.current.connected) {
          setWsConnected(true)
        }
      } catch (error) {
        console.error('❌ Не удалось подключиться к WebSocket:', error)
      }
    }

    initializeWebSocket()

    // НЕ возвращаем cleanup функцию - WebSocket остается открытым навсегда
    // return () => { ... }
  }, [onTranscription, onUploadError])

  // Анализ аудио уровня
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    // Вычисляем средний уровень звука
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = Math.min(average / 128, 1) // Нормализуем от 0 до 1
    
    setAudioLevel(normalizedLevel)
    
    if (isRecording) {
      animationRef.current = requestAnimationFrame(analyzeAudio)
    }
  }, [isRecording])

  const startRecording = useCallback(async () => {
    console.log('🎤 startRecording вызван')
    
    // Проверяем, что запись вызвана намеренно
    if (isRecording) {
      console.log('⚠️ Запись уже идет, игнорируем вызов')
      return
    }
    
    try {
      console.log('🎙️ Запрашиваем доступ к микрофону...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      streamRef.current = stream
      
      // Настраиваем анализатор аудио
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      
      // Запускаем анализ аудио
      // analyzeAudio()
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      audioChunks.current = []
      
      recorder.ondataavailable = (event) => {
        console.log(`🎵 ondataavailable вызван, размер данных: ${event.data.size} байт`)
        if (event.data.size > 0) {
          audioChunks.current.push(event.data)
          
          // Отправляем аудио чанк через WebSocket для транскрипции
          console.log(`🔍 Проверяем WebSocket: wsClient=${!!wsClient.current}, wsConnected=${wsConnected}, wsClient.connected=${wsClient.current?.connected}`)
          // Используем wsClient.current.connected вместо локального wsConnected
          if (wsClient.current && wsClient.current.connected) {
            console.log('📤 Конвертируем и отправляем аудио чанк через WebSocket')
            event.data.arrayBuffer().then(arrayBuffer => {
              console.log(`📊 ArrayBuffer размер: ${arrayBuffer.byteLength} байт`)
              wsClient.current?.sendAudioChunk(arrayBuffer)
              
              // Если это последний чанк (запись остановлена), отправляем 'end' после отправки данных
              if (!isRecording && recorder.state === 'inactive') {
                setTimeout(() => {
                  if (wsClient.current && wsClient.current.connected) {
                    console.log('🔚 Отправляем сигнал завершения после последнего чанка')
                    wsClient.current.endTranscription()
                  }
                }, 50)
              }
            })
          } else {
            console.warn('⚠️ WebSocket недоступен для отправки аудио чанка')
            console.warn('🔍 Детали WebSocket:', {
              wsClient: !!wsClient.current,
              wsConnected: wsConnected,
              wsClientConnected: wsClient.current?.connected
            })
          }
        } else {
          console.warn('⚠️ Получен пустой аудио чанк')
        }
      }
      
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })
        
        console.log('⏹️ Запись остановлена, обрабатываем аудио blob')
        
        // Сохраняем аудио для последующей отправки
        onUploadSuccess(audioBlob)
        
        // Очищаем ресурсы
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
        if (audioContextRef.current) {
          audioContextRef.current.close()
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
        setAudioLevel(0)
      }
      
      recorder.start(100) // Записываем данные каждые 100мс для real-time транскрипции
      setMediaRecorder(recorder)
      onRecordingStart()
    } catch (error) {
      console.error('Ошибка при доступе к микрофону:', error)
      onUploadError()
    }
  }, [onRecordingStart, onUploadError, analyzeAudio])

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setMediaRecorder(null)
      onRecordingStop()
    }
  }, [mediaRecorder, onRecordingStop])


  const handleClick = useCallback(() => {
    console.log('🎯 Клик по микрофону, disabled:', disabled, 'isRecording:', isRecording)
    
    if (disabled) {
      console.log('❌ Микрофон отключен, клик игнорируется')
      return
    }
    
    if (isRecording) {
      console.log('⏹️ Останавливаем запись')
      stopRecording()
    } else {
      console.log('🎤 Начинаем запись')
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording, disabled])

  // Вычисляем размер подсветки на основе уровня звука
  const glowOpacity = 0.3 + (audioLevel * 0.4) // От 0.3 до 0.7

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Динамические кольца подсветки для видеоконференции */}
        {isRecording && (
          <>
            {/* Внешнее кольцо - реагирует на звук */}
            <div 
              className="absolute inset-0 rounded-full transition-all duration-100"
              style={{
                transform: `scale(${1.8 + audioLevel * 0.6})`,
                opacity: glowOpacity * 0.3,
                filter: 'blur(8px)',
                background: `linear-gradient(135deg, rgba(34, 197, 94, ${glowOpacity * 0.5}), rgba(16, 185, 129, ${glowOpacity * 0.5}))`
              }}
            />
            
            {/* Внутреннее кольцо */}
            <div 
              className="absolute inset-0 rounded-full transition-all duration-150"
              style={{
                transform: `scale(${1.3 + audioLevel * 0.4})`,
                opacity: glowOpacity * 0.6,
                filter: 'blur(4px)',
                background: `linear-gradient(135deg, rgba(34, 197, 94, ${glowOpacity * 0.7}), rgba(16, 185, 129, ${glowOpacity * 0.7}))`
              }}
            />
          </>
        )}

        {/* Кнопка микрофона в цветах сайта */}
        <button
          onClick={handleClick}
          disabled={disabled}
          className={`relative group z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none border-2 ${
            isRecording 
              ? 'focus:ring-4 focus:ring-accent-blue/20' 
              : disabled
                ? ''
                : 'focus:ring-4 focus:ring-dark-500/20'
          }`}
          style={{
            background: isRecording 
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9))'
              : disabled
                ? 'rgba(75, 85, 99, 0.7)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))',
            borderColor: isRecording 
              ? 'rgba(59, 130, 246, 0.8)'
              : disabled
                ? 'rgba(107, 114, 128, 0.8)'
                : 'rgba(239, 68, 68, 0.8)',
            boxShadow: isRecording 
              ? '0 8px 25px -8px rgba(59, 130, 246, 0.4)'
              : disabled
                ? 'none'
                : '0 4px 15px -4px rgba(239, 68, 68, 0.3)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transform: isRecording ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          {/* Иконка микрофона */}
          {isRecording ? (
            <div className="w-5 h-5 bg-white rounded-sm"></div>
          ) : (
            <svg
              className="w-7 h-7 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              {/* Выключенный микрофон с перечеркиванием */}
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          )}

          {/* Шиммер эффект при наведении */}
          {!isRecording && !disabled && (
            <div className="absolute inset-0 rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer transform -skew-x-12"></div>
            </div>
          )}
        </button>
      </div>
      
      {disabled && !isRecording && (
        <div className="mt-2 text-xs text-dark-500">Обработка...</div>
      )}
    </div>
  )
}

export default AudioRecorder
