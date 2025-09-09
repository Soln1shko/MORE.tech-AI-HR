import React, { useState, useEffect } from 'react';
import TopPanel from '../components/TopPanel';
import { getAllVacancies, getCandidatesForVacancy, getCandidateAnswers, updateCandidateStatus, downloadCandidateResume, type Candidate, type CandidateAnswer } from '../services/api';

// Функция для перевода тегов анализа на русский язык
const translateAnalysisTag = (tag: string): string => {
  const translations: Record<string, string> = {
    'Достаточно уверенный': 'Достаточно уверенный',
    'Быстрая речь': 'Быстрая речь',
    'Слабая коммуникация': 'Слабая коммуникация',
    'Пассивный': 'Пассивный',
    'Подвержен стрессу': 'Подвержен стрессу',
    'Уверенный': 'Уверенный',
    'Спокойная речь': 'Спокойная речь',
    'Хорошая коммуникация': 'Хорошая коммуникация',
    'Активный': 'Активный',
    'Стрессоустойчивый': 'Стрессоустойчивый',
    'Неуверенный': 'Неуверенный',
    'Медленная речь': 'Медленная речь',
    'Отличная коммуникация': 'Отличная коммуникация',
    'Очень активный': 'Очень активный'
  };
  
  return translations[tag] || tag;
};

// Функция для перевода названий оценок
const translateScoreName = (scoreName: string): string => {
  const translations: Record<string, string> = {
    'confidence': 'Уверенность',
    'stress_resistance': 'Стрессоустойчивость', 
    'communication': 'Коммуникация',
    'energy': 'Энергичность'
  };
  
  return translations[scoreName] || scoreName;
};

// Компонент для отображения анализа речи
const VoiceAnalysisDisplay: React.FC<{ analysis: CandidateAnswer['voice_analysis'] }> = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <div className="mt-4 p-4 bg-dark-800/50 rounded-lg border border-dark-600/30">
      <h5 className="text-white font-medium mb-3 flex items-center">
        <svg className="w-4 h-4 mr-2 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        Анализ речи
      </h5>
      
      {/* Теги */}
      {analysis.tags && analysis.tags.length > 0 && (
        <div className="mb-4">
          <h6 className="text-dark-300 text-sm font-medium mb-2">Характеристики:</h6>
          <div className="flex flex-wrap gap-2">
            {analysis.tags.map((tag, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-accent-blue/20 text-accent-blue text-xs rounded-full border border-accent-blue/30"
              >
                {translateAnalysisTag(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Оценки */}
      {analysis.scores && (
        <div>
          <h6 className="text-dark-300 text-sm font-medium mb-2">Оценки:</h6>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(analysis.scores).map(([key, value]) => (
              <div key={key} className="bg-dark-700/50 p-2 rounded-lg">
                <div className="text-dark-400 text-xs mb-1">{translateScoreName(key)}</div>
                <div className="flex items-center">
                  <div className="flex-1 bg-dark-600 rounded-full h-2 mr-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(value, 100)}%` }}
                    ></div>
                  </div>
                  <span className={`text-sm font-medium ${
                    value >= 70 ? 'text-green-400' : value >= 40 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {value}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Общая оценка */}
      {analysis.overall_score !== undefined && (
        <div className="mt-3 pt-3 border-t border-dark-600/30">
          <div className="flex items-center justify-between">
            <span className="text-dark-300 text-sm font-medium">Общая оценка:</span>
            <span className={`text-lg font-bold ${
              analysis.overall_score >= 70 ? 'text-green-400' : 
              analysis.overall_score >= 40 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {analysis.overall_score}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ExtendedCandidate extends Candidate {
  user_name?: string;
  user_email?: string;
  answers?: CandidateAnswer[];
  answersLoaded?: boolean;
  vacancy_title?: string;
  vacancy_grade?: string;
  interview_result?: {
    report?: any;
    recommendation?: any;
    final_score?: number;
  };
}

interface Vacancy {
  _id: string;
  title: string;
  grade: string;
  required_skills: string[];
  company_id: string;
  work_field?: string;
  min_experience?: number;
  max_experience?: number;
}

const CandidatesPage: React.FC = () => {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<ExtendedCandidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<ExtendedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<ExtendedCandidate | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  
  // Фильтры
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedVacancy, setSelectedVacancy] = useState<string>('all');

  // Состояние для скачивания резюме
  const [downloadingResume, setDownloadingResume] = useState(false);

  // Загрузка вакансий при монтировании компонента
  useEffect(() => {
    loadVacancies();
  }, []);

  // Закрытие дропдауна при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Закрываем только если клик не по кнопке фильтра и не по dropdown'у
      if (!target.closest('.filter-dropdown') && !target.closest('.status-dropdown')) {
        setOpenStatusDropdown(null);
      }
    };

    if (openStatusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [openStatusDropdown]);

  // Загрузка кандидатов для всех вакансий после загрузки вакансий
  useEffect(() => {
    if (vacancies.length > 0) {
      loadAllCandidates();
    }
  }, [vacancies]);

  // Фильтрация кандидатов при изменении фильтров или кандидатов
  useEffect(() => {
    let filtered = [...candidates];

    // Фильтр по статусу
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(candidate => candidate.status === selectedStatus);
    }

    // Фильтр по вакансии
    if (selectedVacancy !== 'all') {
      filtered = filtered.filter(candidate => candidate.vacancy_id === selectedVacancy);
    }

    setFilteredCandidates(filtered);
  }, [candidates, selectedStatus, selectedVacancy]);

  const loadVacancies = async () => {
    try {
      const response = await getAllVacancies();
      if (response.success && response.data) {
        setVacancies(response.data.vacancies || []);
        console.log('📋 Загружено вакансий:', response.data.vacancies?.length);
        console.log('📋 Список вакансий:', response.data.vacancies?.map((v: any) => `${v.title} (ID: ${v._id})`));
        // НЕ выбираем вакансию автоматически - пусть пользователь выберет сам
      } else {
        setError(response.error || 'Ошибка загрузки вакансий');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      console.error('Ошибка при загрузке вакансий:', err);
    }
  };

  const loadAllCandidates = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔍 Загружаем кандидатов для всех вакансий компании');
      const allCandidates: ExtendedCandidate[] = [];
      
      // Загружаем кандидатов для каждой вакансии
      for (const vacancy of vacancies) {
        console.log(`📋 Загружаем кандидатов для вакансии: ${vacancy.title} (ID: ${vacancy._id})`);
        const response = await getCandidatesForVacancy(vacancy._id);
        
        if (response.success && response.data) {
          const candidatesData = response.data.candidates || [];
          console.log(`👥 Найдено кандидатов для ${vacancy.title}: ${candidatesData.length}`);
          
          // Добавляем информацию о вакансии к каждому кандидату
          const candidatesWithVacancy = candidatesData.map((candidate: ExtendedCandidate) => ({
            ...candidate,
            answersLoaded: false,
            vacancy_title: vacancy.title,
            vacancy_grade: vacancy.grade,
            interview_result: candidate.interview_analysis ? {
              report: candidate.interview_analysis,
              recommendation: (candidate as any).recommendation, // recommendation хранится отдельно в базе
              final_score: candidate.interview_analysis?.final_score || candidate.interview_analysis?.score
            } : (candidate as any).recommendation ? {
              // Если нет interview_analysis, но есть recommendation
              report: null,
              recommendation: (candidate as any).recommendation,
              final_score: null
            } : undefined
          }));
          
          allCandidates.push(...candidatesWithVacancy);
        } else {
          console.error(`❌ Ошибка загрузки кандидатов для ${vacancy.title}:`, response.error);
        }
      }
      
      // Сортируем кандидатов: сначала необработанные (completed), потом обработанные (accepted/rejected)
      const sortedCandidates = allCandidates.sort((a, b) => {
        const statusPriority = {
          'active': 0,
          'completed': 1,
          'test_task': 2,
          'finalist': 3,
          'offer': 4,
          'rejected': 5
        };
        
        const aPriority = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
        const bPriority = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
        
        return aPriority - bPriority;
      });
      
      setCandidates(sortedCandidates);
      console.log('✅ Всего кандидатов загружено:', sortedCandidates.length);
      
    } catch (err) {
      console.error('💥 Исключение при загрузке всех кандидатов:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const loadCandidateAnswers = async (candidate: ExtendedCandidate) => {
    try {
      const response = await getCandidateAnswers(candidate._id);
      if (response.success && response.data) {
        const updatedCandidate = {
          ...candidate,
          answers: response.data.qna || [],
          answersLoaded: true
        };
        setSelectedCandidate(updatedCandidate);
        setShowDetailsModal(true);
        
        // Обновляем данные в массиве кандидатов
        setCandidates(prev => prev.map(c => 
          c._id === candidate._id ? updatedCandidate : c
        ));
      } else {
        setError(response.error || 'Ошибка загрузки ответов кандидата');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      console.error('Ошибка при загрузке ответов кандидата:', err);
    }
  };

  const handleStatusUpdate = async (interviewId: string, status: 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer') => {
    try {
      const response = await updateCandidateStatus(interviewId, status);
      if (response.success) {
        // Обновляем статус в локальном состоянии и пересортировываем
        setCandidates(prev => {
          const updated = prev.map(c => 
            c._id === interviewId ? { ...c, status } : c
          );
          
          // Пересортировка после обновления статуса
          return updated.sort((a, b) => {
            const statusPriority = {
              'active': 0,
              'completed': 1,
              'test_task': 2,
              'finalist': 3,
              'offer': 4,
              'rejected': 5
            };
            
            const aPriority = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
            const bPriority = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
            
            return aPriority - bPriority;
          });
        });
        
        // Если модальное окно открыто, обновляем и его
        if (selectedCandidate && selectedCandidate._id === interviewId) {
          setSelectedCandidate(prev => prev ? { ...prev, status } : null);
        }
        
        console.log(`✅ Статус кандидата обновлён на: ${status}`);
      } else {
        setError(response.error || 'Ошибка обновления статуса');
        console.error('❌ Ошибка обновления статуса:', response.error);
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      console.error('Ошибка при обновлении статуса:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { text: 'Активные', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      rejected: { text: 'Отклонённые', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
      completed: { text: 'Одобренные ИИ', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      test_task: { text: 'Тестовое задание', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      finalist: { text: 'Финалисты', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      offer: { text: 'Оффер', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // Функция для скачивания резюме кандидата
  const handleDownloadResume = async () => {
    if (!selectedCandidate) return;

    try {
      setDownloadingResume(true);
      await downloadCandidateResume(selectedCandidate.user_id); // Используем новую функцию для кандидатов
    } catch (err) {
      console.error('Ошибка скачивания резюме:', err);
      alert('Ошибка при скачивании резюме');
    } finally {
      setDownloadingResume(false);
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAvailableStatuses = (currentStatus: string) => {
    // Определяем, какие статусы доступны для изменения в зависимости от текущего
    if (currentStatus === 'active') {
      return []; // Активные интервью нельзя менять вручную
    }
    
    // Для всех остальных статусов (включая rejected) можно менять на любой HR статус
    const allStatuses = [
      { value: 'rejected', label: 'Отклонённые' },
      { value: 'completed', label: 'Одобренные ИИ' },
      { value: 'test_task', label: 'Тестовое задание' },
      { value: 'finalist', label: 'Финалисты' },
      { value: 'offer', label: 'Оффер' }
    ];
    
    // Исключаем текущий статус из списка доступных
    return allStatuses.filter(status => status.value !== currentStatus);
  };

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Фон как в VacanciesListPage */}
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

      <TopPanel />
      
      <div className="relative z-10 pt-36 pb-20 px-6">
        <div className="w-full max-w-6xl mx-auto">

          {/* Заголовок и фильтры */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-light text-white">Кандидаты</h2>
                <p className="text-dark-400 text-sm mt-1">
                  {filteredCandidates.length} из {candidates.length} кандидатов
                </p>
              </div>
              
              {/* Фильтры */}
              <div className="flex items-center space-x-4">
                {/* Фильтр по статусу */}
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => setOpenStatusDropdown(openStatusDropdown === 'status' ? null : 'status')}
                    className="px-4 py-2 rounded-full text-sm font-medium border bg-dark-800/50 text-white border-dark-600/50 hover:opacity-80 transition-opacity cursor-pointer min-w-[160px] flex items-center justify-between"
                  >
                    <span>
                      {selectedStatus === 'all' ? 'Все статусы' :
                       selectedStatus === 'active' ? 'Активные' :
                       selectedStatus === 'rejected' ? 'Отклонённые' :
                       selectedStatus === 'completed' ? 'Одобренные ИИ' :
                       selectedStatus === 'test_task' ? 'Тестовое задание' :
                       selectedStatus === 'finalist' ? 'Финалисты' :
                       selectedStatus === 'offer' ? 'Оффер' : 'Все статусы'}
                    </span>
                    <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {openStatusDropdown === 'status' && (
                    <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                      <button
                        onClick={() => {
                          setSelectedStatus('all');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg"
                      >
                        Все статусы
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('active');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Активные
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('rejected');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Отклонённые
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('completed');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Одобренные ИИ
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('test_task');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Тестовое задание
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('finalist');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Финалисты
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('offer');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors last:rounded-b-lg"
                      >
                        Оффер
                      </button>
                    </div>
                  )}
                </div>

                {/* Фильтр по вакансии */}
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => setOpenStatusDropdown(openStatusDropdown === 'vacancy' ? null : 'vacancy')}
                    className="px-4 py-2 rounded-full text-sm font-medium border bg-dark-800/50 text-white border-dark-600/50 hover:opacity-80 transition-opacity cursor-pointer min-w-[200px] flex items-center justify-between"
                  >
                    <span>
                      {selectedVacancy === 'all' ? 'Все вакансии' : 
                       vacancies.find(v => v._id === selectedVacancy)?.title + ' • ' + vacancies.find(v => v._id === selectedVacancy)?.grade || 'Все вакансии'}
                    </span>
                    <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {openStatusDropdown === 'vacancy' && (
                    <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[200px]">
                      <button
                        onClick={() => {
                          setSelectedVacancy('all');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg"
                      >
                        Все вакансии
                      </button>
                      {vacancies.map((vacancy) => (
                        <button
                          key={vacancy._id}
                          onClick={() => {
                            setSelectedVacancy(vacancy._id);
                            setOpenStatusDropdown(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors last:rounded-b-lg"
                        >
                          {vacancy.title} • {vacancy.grade}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Сообщения об ошибках */}
          {error && (
            <div className="glass rounded-2xl p-6 border border-red-500/30 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Ошибка загрузки</h3>
                <p className="text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Индикатор загрузки */}
          {loading && (
            <div className="glass rounded-2xl p-12 border border-dark-600/30 mb-8">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mb-4"></div>
                <span className="text-dark-300 text-lg">Загрузка кандидатов...</span>
              </div>
            </div>
          )}

          {/* Список кандидатов как в VacanciesListPage */}
          {!loading && (
            <div className="space-y-6">
              {filteredCandidates.length === 0 ? (
                <div className="glass rounded-3xl p-8 border border-dark-600/30">
                  <div className="text-center">
                    <h3 className="text-xl text-white mb-2">Кандидаты не найдены</h3>
                    <p className="text-dark-400">
                      {candidates.length === 0 
                        ? "По вакансиям компании пока нет кандидатов"
                        : "По выбранным фильтрам кандидаты не найдены"
                      }
                    </p>
                  </div>
                </div>
              ) : (
                filteredCandidates.map((candidate, index) => (
                  <div
                    key={candidate._id}
                    className="cursor-pointer glass rounded-2xl p-6 border border-dark-600/30 hover:border-accent-blue/50 transition-all duration-300 hover:scale-105 group animate-stagger-fade-in text-left"
                    style={{
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-accent-blue to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {candidate.user_name?.charAt(0) || 'У'}
                            </span>
                          </div>
                          <h3 className="text-xl font-semibold text-white group-hover:text-accent-blue transition-colors">
                            {candidate.user_name || 'Пользователь'}
                          </h3>
                          
                          {/* Дропдаун статуса */}
                          <div className="relative status-dropdown">
                            {getAvailableStatuses(candidate.status).length > 0 ? (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenStatusDropdown(openStatusDropdown === candidate._id ? null : candidate._id);
                                  }}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                                    candidate.status === 'active' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                    candidate.status === 'rejected' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                                    candidate.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                    candidate.status === 'test_task' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                    candidate.status === 'finalist' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                    candidate.status === 'offer' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                  }`}
                                >
                                  {getStatusBadge(candidate.status).props.children}
                                  <svg className="w-3 h-3 ml-1 inline" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                
                                {openStatusDropdown === candidate._id && (
                                  <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                                    {getAvailableStatuses(candidate.status).map((status) => (
                                      <button
                                        key={status.value}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusUpdate(candidate._id, status.value as 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer');
                                          setOpenStatusDropdown(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                      >
                                        {status.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              getStatusBadge(candidate.status)
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 mb-4">
                          <span className="text-dark-300 font-medium">{candidate.user_email || 'user@example.com'}</span>
                          <span className="text-dark-500">•</span>
                          {candidate.vacancy_title && (
                            <>
                              <span className="text-dark-400">{candidate.vacancy_title}</span>
                              <span className="text-dark-500">•</span>
                              <span className="text-dark-400">{candidate.vacancy_grade}</span>
                            </>
                          )}
                          {candidate.resume_score && (
                            <>
                              <span className="text-dark-500">•</span>
                              <span className={`font-medium ${getScoreColor(candidate.resume_score)}`}>
                                Резюме: {candidate.resume_score}%
                              </span>
                            </>
                          )}
                          {candidate.interview_result?.final_score && (
                            <>
                              <span className="text-dark-500">•</span>
                              <span className={`font-medium ${getScoreColor(candidate.interview_result.final_score)}`}>
                                Интервью: {candidate.interview_result.final_score}%
                              </span>
                            </>
                          )}
                        </div>

                        {/* Рекомендация */}
                        {candidate.interview_result?.recommendation && (
                          <div className="mt-3 p-3 bg-dark-800/30 rounded-lg border border-dark-600/30">
                            <h4 className="text-white text-sm font-medium mb-2">Рекомендация AI:</h4>
                            <p className="text-dark-300 text-sm leading-relaxed">
                              {typeof candidate.interview_result.recommendation === 'string' 
                                ? candidate.interview_result.recommendation 
                                : JSON.stringify(candidate.interview_result.recommendation, null, 2)
                              }
                            </p>
                          </div>
                        )}

                      </div>

                      <div className="ml-6 flex-shrink-0">
                        <button
                          onClick={() => loadCandidateAnswers(candidate)}
                          className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-700/50 hover:bg-gradient-to-r hover:from-accent-blue hover:to-accent-purple text-dark-300 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-accent-blue/20 border border-dark-600/50 hover:border-transparent"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                          <span className="relative z-10 text-sm font-medium">Просмотреть ответы</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно с деталями кандидата */}
      {showDetailsModal && selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl border border-dark-600/30 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-dark-600/30 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-light text-white mb-2">
                  {selectedCandidate.user_name || 'Детали кандидата'}
                </h2>
                <p className="text-dark-400">{selectedCandidate.user_email}</p>
                {selectedCandidate.vacancy_title && (
                  <p className="text-accent-blue text-sm mt-1">{selectedCandidate.vacancy_title} • {selectedCandidate.vacancy_grade}</p>
                )}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-10 h-10 glass rounded-full border border-dark-600/30 text-dark-400 hover:text-white hover:border-accent-blue/50 transition-all duration-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Статистика */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm">Статус</p>
                  <div className="mt-2">
                    {/* Дропдаун статуса в модальном окне */}
                    {getAvailableStatuses(selectedCandidate.status).length > 0 ? (
                      <div className="relative status-dropdown">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenStatusDropdown(openStatusDropdown === `modal_${selectedCandidate._id}` ? null : `modal_${selectedCandidate._id}`);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                            selectedCandidate.status === 'active' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                            selectedCandidate.status === 'rejected' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                            selectedCandidate.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            selectedCandidate.status === 'test_task' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                            selectedCandidate.status === 'finalist' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            selectedCandidate.status === 'offer' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {getStatusBadge(selectedCandidate.status).props.children}
                          <svg className="w-3 h-3 ml-1 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {openStatusDropdown === `modal_${selectedCandidate._id}` && (
                          <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                            {getAvailableStatuses(selectedCandidate.status).map((status) => (
                              <button
                                key={status.value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(selectedCandidate._id, status.value as 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer');
                                  setOpenStatusDropdown(null);
                                  // Обновляем статус в selectedCandidate для мгновенного отображения
                                  setSelectedCandidate(prev => prev ? {...prev, status: status.value} : null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      getStatusBadge(selectedCandidate.status)
                    )}
                  </div>
                </div>
                
                {selectedCandidate.resume_score && (
                  <div className="bg-dark-700/30 p-4 rounded-lg">
                    <p className="text-dark-300 text-sm">Оценка резюме</p>
                    <p className={`text-2xl font-bold mt-1 ${getScoreColor(selectedCandidate.resume_score)}`}>
                      {selectedCandidate.resume_score}%
                    </p>
                  </div>
                )}

                {selectedCandidate.interview_result?.final_score && (
                  <div className="bg-dark-700/30 p-4 rounded-lg">
                    <p className="text-dark-300 text-sm">Оценка интервью</p>
                    <p className={`text-2xl font-bold mt-1 ${getScoreColor(selectedCandidate.interview_result.final_score)}`}>
                      {selectedCandidate.interview_result.final_score}%
                    </p>
                  </div>
                )}
                
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm">Количество ответов</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {selectedCandidate.answers?.length || 0}
                  </p>
                </div>
               </div>

               {/* Действия с кандидатом */}
               <div className="mb-6">
                 <h3 className="text-lg font-semibold text-white mb-4">Действия</h3>
                 <div className="flex flex-wrap gap-3">
                   <button
                     onClick={handleDownloadResume}
                     disabled={downloadingResume}
                     className="flex items-center space-x-2 px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 border border-accent-blue/30 hover:border-accent-blue/50 text-accent-blue rounded-lg font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {downloadingResume ? (
                       <>
                         <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
                         <span>Скачивание...</span>
                       </>
                     ) : (
                       <>
                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                         </svg>
                         <span>Скачать резюме</span>
                       </>
                     )}
                   </button>
                 </div>
               </div>

               {/* Ответы кандидата */}
               <div>
                <h3 className="text-lg font-semibold text-white mb-4">Ответы на вопросы</h3>
                
                {!selectedCandidate.answers || selectedCandidate.answers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-dark-300">Ответы кандидата не найдены</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedCandidate.answers.map((answer, index) => (
                      <div key={answer._id} className="bg-dark-700/30 p-4 rounded-lg">
                        <div className="mb-3">
                          <h4 className="text-white font-medium mb-2">
                            Вопрос {index + 1}:
                          </h4>
                          <p className="text-blue-300 italic">{answer.question}</p>
                        </div>
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">Ответ:</h4>
                          <p className="text-dark-300 leading-relaxed">{answer.answer_text}</p>
                        </div>
                        
                        {/* Анализ речи */}
                        <VoiceAnalysisDisplay analysis={answer.voice_analysis} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Результаты интервью */}
              {selectedCandidate.interview_result && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Результаты интервью</h3>
                  
                  {selectedCandidate.interview_result.recommendation && (
                    <div className="bg-dark-700/30 p-4 rounded-lg mb-4">
                      <h4 className="text-white font-medium mb-2">Рекомендация:</h4>
                      <p className="text-dark-300 leading-relaxed">
                        {typeof selectedCandidate.interview_result.recommendation === 'string' 
                          ? selectedCandidate.interview_result.recommendation 
                          : JSON.stringify(selectedCandidate.interview_result.recommendation, null, 2)
                        }
                      </p>
                    </div>
                  )}

                  {selectedCandidate.interview_result.report && (
                    <div className="bg-dark-700/30 p-4 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Отчёт:</h4>
                      <div className="text-dark-300 leading-relaxed whitespace-pre-wrap">
                        {typeof selectedCandidate.interview_result.report === 'string' 
                          ? selectedCandidate.interview_result.report 
                          : JSON.stringify(selectedCandidate.interview_result.report, null, 2)
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatesPage;
