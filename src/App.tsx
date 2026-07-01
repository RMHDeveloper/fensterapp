import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }             from './context/AuthContext'
import { AppDataProvider }          from './context/AppDataContext'
import { OfflineBanner }            from './components/pwa/OfflineBanner'
import { InstallAppPrompt }         from './components/pwa/InstallAppPrompt'
import { PWAUpdatePrompt }          from './components/pwa/PWAUpdatePrompt'
import { SidebarNavigation }        from './components/navigation/SidebarNavigation'
import { NavigationBar }            from './components/navigation/NavigationBar'
import { ProtectedRoute }           from './components/layout/ProtectedRoute'
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
            <Route path="/home"         element={<ProtectedRoute screenPath="home">         <HomeScreen />         </ProtectedRoute>} />
            <Route path="/tasks"        element={<ProtectedRoute screenPath="tasks">        <TodayTasksScreen />   </ProtectedRoute>} />
            <Route path="/task/:id"     element={<ProtectedRoute screenPath="tasks">        <TaskDetailScreen />   </ProtectedRoute>} />
            <Route path="/projects"     element={<ProtectedRoute screenPath="projects">     <ProjectsScreen />     </ProtectedRoute>} />
            <Route path="/project/:id"  element={<ProtectedRoute screenPath="projects">     <ProjectDetailScreen /></ProtectedRoute>} />
            <Route path="/leads"        element={<ProtectedRoute screenPath="leads">        <LeadsScreen />        </ProtectedRoute>} />
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

// Route switcher — uses auth state to decide which shell to render
function AppRoutes() {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <AppShell /> : <LoginShell />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppDataProvider>
          <OfflineBanner />
          <AppRoutes />
          <InstallAppPrompt />
          <PWAUpdatePrompt />
        </AppDataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
