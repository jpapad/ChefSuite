import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RequireTeam } from './components/auth/RequireTeam'
import { PermissionGuard } from './components/auth/PermissionGuard'
import { AppShell } from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Recipes from './pages/Recipes'
import Inventory from './pages/Inventory'
import Prep from './pages/Prep'
import Team from './pages/Team'
import Profile from './pages/Profile'
import Analytics from './pages/Analytics'
import HACCPLog from './pages/HACCPLog'
import Chat from './pages/Chat'
import KDS from './pages/KDS'
import Walkie from './pages/Walkie'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Onboarding from './pages/Onboarding'
import Menus from './pages/Menus'
import MenuDetail from './pages/MenuDetail'
import MenuPublic from './pages/MenuPublic'
import Suppliers from './pages/Suppliers'
import WasteLog from './pages/WasteLog'
import Shifts from './pages/Shifts'
import PurchaseOrders from './pages/PurchaseOrders'
import Timeclock from './pages/Timeclock'
import Reservations from './pages/Reservations'
import ReservationPublic from './pages/ReservationPublic'
import MenuEngineering from './pages/MenuEngineering'
import PriceTracking from './pages/PriceTracking'
import ProfitLoss from './pages/ProfitLoss'
import StaffPerformance from './pages/StaffPerformance'
import ChefJournal from './pages/ChefJournal'
import KitchenPulse from './pages/KitchenPulse'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <RequireTeam>
                  <AppShell />
                </RequireTeam>
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="recipes" element={<PermissionGuard module="recipes"><Recipes /></PermissionGuard>} />
            <Route path="inventory" element={<PermissionGuard module="inventory"><Inventory /></PermissionGuard>} />
            <Route path="prep" element={<PermissionGuard module="prep"><Prep /></PermissionGuard>} />
            <Route path="team" element={<PermissionGuard module="team"><Team /></PermissionGuard>} />
            <Route path="analytics" element={<PermissionGuard module="analytics"><Analytics /></PermissionGuard>} />
            <Route path="haccp" element={<PermissionGuard module="haccp"><HACCPLog /></PermissionGuard>} />
            <Route path="chat" element={<PermissionGuard module="chat"><Chat /></PermissionGuard>} />
            <Route path="kds" element={<PermissionGuard module="kds"><KDS /></PermissionGuard>} />
            <Route path="walkie" element={<PermissionGuard module="walkie"><Walkie /></PermissionGuard>} />
            <Route path="profile" element={<Profile />} />
            <Route path="menus" element={<PermissionGuard module="menus"><Menus /></PermissionGuard>} />
            <Route path="menus/:id" element={<PermissionGuard module="menus"><MenuDetail /></PermissionGuard>} />
            <Route path="suppliers" element={<PermissionGuard module="suppliers"><Suppliers /></PermissionGuard>} />
            <Route path="waste" element={<PermissionGuard module="waste"><WasteLog /></PermissionGuard>} />
            <Route path="shifts" element={<PermissionGuard module="shifts"><Shifts /></PermissionGuard>} />
            <Route path="orders" element={<PermissionGuard module="orders"><PurchaseOrders /></PermissionGuard>} />
            <Route path="timeclock" element={<PermissionGuard module="timeclock"><Timeclock /></PermissionGuard>} />
            <Route path="reservations" element={<PermissionGuard module="reservations"><Reservations /></PermissionGuard>} />
            <Route path="menu-engineering" element={<PermissionGuard module="menu-engineering"><MenuEngineering /></PermissionGuard>} />
            <Route path="price-tracking" element={<PermissionGuard module="price-tracking"><PriceTracking /></PermissionGuard>} />
            <Route path="pl" element={<PermissionGuard module="pl"><ProfitLoss /></PermissionGuard>} />
            <Route path="staff-performance" element={<PermissionGuard module="staff-performance"><StaffPerformance /></PermissionGuard>} />
            <Route path="journal" element={<PermissionGuard module="journal"><ChefJournal /></PermissionGuard>} />
            <Route path="pulse" element={<PermissionGuard module="pulse"><KitchenPulse /></PermissionGuard>} />
          </Route>

          <Route path="/menu/:id" element={<MenuPublic />} />
          <Route path="/reserve/:id" element={<ReservationPublic />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
