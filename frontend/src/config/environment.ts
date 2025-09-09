// Конфигурация окружения для развертывания на одном сервере

// Вспомогательная функция для получения текущего хоста
const getCurrentHost = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.host
  }
  return 'localhost'
}

// Вспомогательная функция для определения протокола WebSocket
const getWsProtocol = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  }
  return 'ws:'
}

export const config = {
  // API базовый URL - использует Nginx проксирование
  API_BASE_URL: '/api',
  
  // WebSocket URLs - используют текущий хост и правильный протокол
  WS_VOICE_URL: `${getWsProtocol()}//${getCurrentHost()}/ws/voice`,
  WS_TTS_URL: `${getWsProtocol()}//${getCurrentHost()}/ws/speak`,
  
  // Для разработки
  DEV_API_BASE_URL: 'http://localhost:5000',
  DEV_WS_VOICE_URL: 'ws://localhost:8001/ws/voice',
  DEV_WS_TTS_URL: 'ws://localhost:8003/ws/speak'
}

// Функция для получения конфигурации в зависимости от окружения
export const getConfig = () => {
  // Vite использует import.meta.env вместо process.env
  const isDevelopment = import.meta.env.DEV
  const viteApi = import.meta.env.VITE_API_URL as string | undefined
  const viteWsVoice = import.meta.env.VITE_WS_TRANSCRIPTION_URL as string | undefined
  const viteWsTts = import.meta.env.VITE_WS_TTS_URL as string | undefined
  
  return {
    API_BASE_URL: viteApi || (isDevelopment ? config.DEV_API_BASE_URL : config.API_BASE_URL),
    WS_VOICE_URL: viteWsVoice || (isDevelopment ? config.DEV_WS_VOICE_URL : config.WS_VOICE_URL),
    WS_TTS_URL: viteWsTts || (isDevelopment ? config.DEV_WS_TTS_URL : config.WS_TTS_URL)
  }
}
