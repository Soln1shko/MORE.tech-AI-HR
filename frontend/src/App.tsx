import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import WelcomeScreenPage from './pages/WelcomeScreenPage'
import InterviewPage from './pages/InterviewPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CompanyRegisterPage from './pages/CompanyRegisterPage'
import UserProfilePage from './pages/UserProfilePage'
import CompanyDashboard from './pages/CompanyDashboard'
import CompanyProfilePage from './pages/CompanyProfilePage'
import VacanciesListPage from './pages/VacanciesListPage'
import CandidatesPage from './pages/CandidatesPage'
import ApplicationsPage from './pages/ApplicationsPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Router>
      <Routes>
        {/* Главная страница приветствия - только для пользователей */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <WelcomeScreenPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Старый путь для совместимости */}
        <Route 
          path="/welcomescreen" 
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <WelcomeScreenPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Страница интервью - только для пользователей */}
        <Route 
          path="/interview" 
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <InterviewPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Список всех вакансий - только для пользователей */}
        <Route 
          path="/vacancies-list" 
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <VacanciesListPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Страница откликов - только для пользователей */}
        <Route 
          path="/applications" 
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <ApplicationsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Страницы без ограничений */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/company-register" element={<CompanyRegisterPage />} />
        
        {/* Профиль пользователя - только для пользователей */}
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <UserProfilePage />
            </ProtectedRoute>
          } 
        />
        
        {/* Панель компании - только для компаний */}
        <Route 
          path="/company-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['company']}>
              <CompanyDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Страница кандидатов - только для компаний */}
        <Route 
          path="/candidates" 
          element={
            <ProtectedRoute allowedRoles={['company']}>
              <CandidatesPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Профиль компании - только для компаний */}
        <Route 
          path="/company-profile" 
          element={
            <ProtectedRoute allowedRoles={['company']}>
              <CompanyProfilePage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  )
}

export default App
