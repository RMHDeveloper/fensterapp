import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }             from './context/AuthContext'
import { AppDataProvider, useAppData } from './context/AppDataContext'
import { OfflineBanner }            from './components/pwa/OfflineBanner'
import { DbBanner }               from './components/pwa/DbBanner'
import { InstallAppPrompt }         from './components/pwa/InstallAppPrompt'
import { PWAUpdatePrompt }          from './components/pwa/PWAUpdatePrompt'
import { SidebarNavigation }        from './components/navigation/SidebarNavigation'
import { NavigationBar }            from './components/navigation/NavigationBar'
import { ProtectedRoute }           from './components/layout/ProtectedRoute'
import { ErrorBoundary }            from './components/layout/ErrorBoundary'
import { useAuth }                  from './context/AuthContext'
import LoginScreen                  from './screens/Login/LoginScreen'
import HomeScreen                   from './screens/Home/HomeScreen'
import TodayTasksScreen             from './screens/TodayTasks/TodayTasksScreen'
import TaskDetailScreen             from './screens/TaskDetail/TaskDetailScreen'
import ProjectsScreen               from './screens/Projects/ProjectsScreen'
import ProjectDetailScreen          from './screens/ProjectDetail/ProjectDetailScreen'
import LeadsScreen                  from './screens/Leads/LeadsScreen'
import SiteVisitScreen              from './screens/SiteVisit/SiteVisitScreen'
import QuotationsScreen             from './screens/Quotations/QuotationsScreen'
import OrdersScreen                 from './screens/Orders/OrdersScreen'
import ProductionScreen             from './screens/Production/ProductionScreen'
import DeliveryQCScreen             from './screens/DeliveryQC/DeliveryQCScreen'
import MistakesScreen               from './screens/Mistakes/MistakesScreen'
import PaymentsScreen               from './screens/Payments/PaymentsScreen'
import InstallationScreen           from './screens/Installation/InstallationScreen'
import FilesScreen                  from './screens/Files/FilesScreen'
import ReportsScreen                from './screens/Reports/ReportsScreen'
import SettingsScreen               from './screens/Settings/SettingsScreen'
import UserManagementScreen         from './screens/Settings/UserManagementScreen'
import ApprovalsScreen              from './screens/Approvals/ApprovalsScreen'
import OwnerDashboardScreen         from './screens/Dashboard/OwnerDashboardScreen'
import LeaveApplicationScreen       from './screens/LeaveApplication/LeaveApplicationScreen'

// Home route — owners (MD/ED) land on the Dashboard, everyone else on Home
function HomeRoute() {
  const { user } = useAuth()
  return user?.role === 'owner' ? <Navigate to="/dashboard" replace /> : <HomeScreen />
}

// Leave Application — full management for Admin/MD (owner role, not ED); technicians
// get self-service access to apply for their own leave (gated inside the screen itself)
function LeaveApplicationRoute() {
  const { user } = useAuth()
  const canManage = user?.role === 'owner' && (user.displayRole?.includes('MD') || user.displayRole?.includes('Admin'))
  const canApply  = user?.role === 'technician' || user?.role === 'installation_incharge'
  return (canManage || canApply) ? <LeaveApplicationScreen /> : <Navigate to="/home" replace />
}

// Dashboard shell — only rendered after login
function AppShell() {
  return (
    <div className="min-h-screen bg-[#dde3ea] lg:bg-[#f0f2f5]">
      <SidebarNavigation />
      <div className="lg:ml-[260px]">
        <div className="w-full max-w-[390px] mx-auto min-h-screen bg-[#f8f9fa] shadow-xl relative overflow-x-hidden lg:max-w-none lg:mx-0 lg:shadow-none lg:bg-[#f0f2f5]">
          <NavigationBar />
          <Routes>
            <Route path="/"             element={<Navigate to="/home" replace />} />
            <Route path="/login"        element={<Navigate to="/home" replace />} />

            <Route path="/dashboard"    element={<ProtectedRoute screenPath="home"><OwnerDashboardScreen /></ProtectedRoute>} />
            <Route path="/home"         element={<ProtectedRoute screenPath="home">         <HomeRoute />          </ProtectedRoute>} />
            <Route path="/tasks"        element={<ProtectedRoute screenPath="tasks">        <TodayTasksScreen />   </ProtectedRoute>} />
            <Route path="/task/:id"     element={<ProtectedRoute screenPath="tasks">        <TaskDetailScreen />   </ProtectedRoute>} />
            <Route path="/projects"     element={<ProtectedRoute screenPath="projects">     <ProjectsScreen />     </ProtectedRoute>} />
            <Route path="/project/:id"  element={<ProtectedRoute screenPath="projects">     <ProjectDetailScreen /></ProtectedRoute>} />
            <Route path="/leads"        element={<ProtectedRoute screenPath="leads">        <LeadsScreen />        </ProtectedRoute>} />
            <Route path="/leads/negotiation" element={<ProtectedRoute screenPath="leads">   <LeadsScreen />        </ProtectedRoute>} />
            <Route path="/site-visits"  element={<ProtectedRoute screenPath="site-visits">  <SiteVisitScreen />    </ProtectedRoute>} />
            <Route path="/quotations"   element={<ProtectedRoute screenPath="quotations">   <QuotationsScreen />   </ProtectedRoute>} />
            <Route path="/orders"       element={<ProtectedRoute screenPath="orders">       <OrdersScreen />       </ProtectedRoute>} />
            <Route path="/production"   element={<ProtectedRoute screenPath="production">   <ProductionScreen />   </ProtectedRoute>} />
            <Route path="/delivery-qc"  element={<ProtectedRoute screenPath="delivery-qc">  <DeliveryQCScreen />   </ProtectedRoute>} />
            <Route path="/mistakes"     element={<ProtectedRoute screenPath="mistakes">     <MistakesScreen />     </ProtectedRoute>} />
            <Route path="/payments"     element={<ProtectedRoute screenPath="payments">     <PaymentsScreen />     </ProtectedRoute>} />
            <Route path="/installation" element={<ProtectedRoute screenPath="installation"> <InstallationScreen /> </ProtectedRoute>} />
            <Route path="/files"        element={<ProtectedRoute screenPath="files">        <FilesScreen />        </ProtectedRoute>} />
            <Route path="/reports"      element={<ProtectedRoute screenPath="reports">      <ReportsScreen />      </ProtectedRoute>} />
            <Route path="/settings"       element={<ProtectedRoute screenPath="settings">     <SettingsScreen />        </ProtectedRoute>} />
            <Route path="/settings/users" element={<ProtectedRoute screenPath="settings">   <UserManagementScreen /> </ProtectedRoute>} />
            <Route path="/approvals"    element={<ProtectedRoute screenPath="approvals">    <ApprovalsScreen />    </ProtectedRoute>} />
            <Route path="/leave-applications" element={<ProtectedRoute screenPath="home">   <LeaveApplicationRoute /></ProtectedRoute>} />

            <Route path="*"             element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

// Login shell — full screen, no sidebar, no margin
function LoginShell() {
  return (
    <Routes>
      <Route path="*" element={<LoginScreen />} />
    </Routes>
  )
}

// Shown while auth/data rehydration is in progress after a refresh — prevents
// protected pages from mounting before tasks/projects/leads have loaded, which
// is what caused blank/crashed screens on refresh.
function AppLoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fa] gap-3">
      <div className="w-9 h-9 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400">Loading Fenster...</p>
    </div>
  )
}

// Route switcher — uses auth state to decide which shell to render
function AppRoutes() {
  const { isLoggedIn } = useAuth()
  const { isSupabaseReady } = useAppData()

  if (!isLoggedIn) return <LoginShell />
  if (!isSupabaseReady) return <AppLoadingScreen />
  return <AppShell />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppDataProvider>
            <DbBanner />
            <OfflineBanner />
            <AppRoutes />
            <InstallAppPrompt />
            <PWAUpdatePrompt />
          </AppDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
