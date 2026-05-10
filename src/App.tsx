import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RequireTeam } from './components/auth/RequireTeam'
import { PermissionGuard } from './components/auth/PermissionGuard'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PageLoader } from './components/ui/PageLoader'

const Dashboard          = lazy(() => import('./pages/Dashboard'))
const Recipes            = lazy(() => import('./pages/Recipes'))
const Inventory          = lazy(() => import('./pages/Inventory'))
const Prep               = lazy(() => import('./pages/Prep'))
const Team               = lazy(() => import('./pages/Team'))
const Profile            = lazy(() => import('./pages/Profile'))
const Analytics          = lazy(() => import('./pages/Analytics'))
const HACCPLog           = lazy(() => import('./pages/HACCPLog'))
const Chat               = lazy(() => import('./pages/Chat'))
const KDS                = lazy(() => import('./pages/KDS'))
const Walkie             = lazy(() => import('./pages/Walkie'))
const NotFound           = lazy(() => import('./pages/NotFound'))
const Login              = lazy(() => import('./pages/Login'))
const SignUp             = lazy(() => import('./pages/SignUp'))
const Onboarding         = lazy(() => import('./pages/Onboarding'))
const Welcome            = lazy(() => import('./pages/Welcome'))
const Menus              = lazy(() => import('./pages/Menus'))
const MenuDetail         = lazy(() => import('./pages/MenuDetail'))
const MenuPublic         = lazy(() => import('./pages/MenuPublic'))
const Suppliers          = lazy(() => import('./pages/Suppliers'))
const WasteLog           = lazy(() => import('./pages/WasteLog'))
const Shifts             = lazy(() => import('./pages/Shifts'))
const PurchaseOrders     = lazy(() => import('./pages/PurchaseOrders'))
const Timeclock          = lazy(() => import('./pages/Timeclock'))
const Reservations       = lazy(() => import('./pages/Reservations'))
const ReservationPublic  = lazy(() => import('./pages/ReservationPublic'))
const MenuEngineering    = lazy(() => import('./pages/MenuEngineering'))
const PriceTracking      = lazy(() => import('./pages/PriceTracking'))
const ProfitLoss         = lazy(() => import('./pages/ProfitLoss'))
const StaffPerformance   = lazy(() => import('./pages/StaffPerformance'))
const ChefJournal        = lazy(() => import('./pages/ChefJournal'))
const KitchenPulse       = lazy(() => import('./pages/KitchenPulse'))
const ChefCopilot        = lazy(() => import('./pages/ChefCopilot'))
const CulinaryTools      = lazy(() => import('./pages/CulinaryTools'))
const CulinaryGlossary   = lazy(() => import('./pages/CulinaryGlossary'))
const TechniqueLibrary   = lazy(() => import('./pages/TechniqueLibrary'))
const HelpCenter         = lazy(() => import('./pages/HelpCenter'))
const IngredientsEncyclopedia = lazy(() => import('./pages/IngredientsEncyclopedia'))
const PosSettings        = lazy(() => import('./pages/PosSettings'))
const HandoverNotes      = lazy(() => import('./pages/HandoverNotes'))
const Labels             = lazy(() => import('./pages/Labels'))
const Stocktake          = lazy(() => import('./pages/Stocktake'))
const Costing            = lazy(() => import('./pages/Costing'))
const DishInfo           = lazy(() => import('./pages/DishInfo'))

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
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
                path="/welcome"
                element={
                  <ProtectedRoute>
                    <Welcome />
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
                <Route path="handover" element={<PermissionGuard module="handover"><HandoverNotes /></PermissionGuard>} />
                <Route path="labels" element={<PermissionGuard module="labels"><Labels /></PermissionGuard>} />
                <Route path="stocktake" element={<PermissionGuard module="stocktake"><Stocktake /></PermissionGuard>} />
                <Route path="costing" element={<PermissionGuard module="costing"><Costing /></PermissionGuard>} />
                <Route path="journal" element={<PermissionGuard module="journal"><ChefJournal /></PermissionGuard>} />
                <Route path="pulse" element={<PermissionGuard module="pulse"><KitchenPulse /></PermissionGuard>} />
                <Route path="copilot" element={<PermissionGuard module="copilot"><ChefCopilot /></PermissionGuard>} />
                <Route path="culinary-tools" element={<PermissionGuard module="culinary-tools"><CulinaryTools /></PermissionGuard>} />
                <Route path="glossary" element={<PermissionGuard module="glossary"><CulinaryGlossary /></PermissionGuard>} />
                <Route path="techniques" element={<PermissionGuard module="techniques"><TechniqueLibrary /></PermissionGuard>} />
                <Route path="help" element={<PermissionGuard module="help"><HelpCenter /></PermissionGuard>} />
                <Route path="ingredients" element={<PermissionGuard module="ingredients"><IngredientsEncyclopedia /></PermissionGuard>} />
                <Route path="pos-settings" element={<PermissionGuard module="pos-settings"><PosSettings /></PermissionGuard>} />
              </Route>

              <Route path="/menu/:id" element={<MenuPublic />} />
              <Route path="/reserve/:id" element={<ReservationPublic />} />
              <Route path="/dish" element={<DishInfo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
