import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardProvider } from './context/DashboardContext';
import { ToastProvider } from './components/ui/Toast';
import { PageLoader } from './components/ui/Spinner';
import { PublicLayout } from './components/layout/PublicLayout';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { HomePage } from './pages/HomePage';
import { ServicesPage } from './pages/ServicesPage';
import { BookingPage } from './pages/BookingPage';
import { DashboardOverviewPage } from './pages/dashboard/DashboardOverviewPage';
import { MyAppointmentsPage } from './pages/dashboard/MyAppointmentsPage';
import { NotificationsPage } from './pages/dashboard/NotificationsPage';
import { ReviewsPage } from './pages/dashboard/ReviewsPage';
import { ProfilePage } from './pages/dashboard/ProfilePage';
import { AdminPage } from './pages/AdminPage';

function RequireAuth({ children }) {
  const { status, customer } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'guest') return <Navigate to="/?openAuth=login" replace />;
  if (['staff', 'admin'].includes(customer?.role)) return <Navigate to="/admin" replace />;
  if (customer?.role !== 'customer') return <Navigate to="/?openAuth=login" replace />;
  return children;
}

function RequireStaff({ children }) {
  const { status, customer } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'guest') return <Navigate to="/?openAuth=admin" replace />;
  if (customer?.role === 'customer') return <Navigate to="/dashboard/overview" replace />;
  if (!['staff', 'admin'].includes(customer?.role) || customer?.is_active === false) return <Navigate to="/?openAuth=admin" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <span className="font-display text-6xl font-extrabold text-brand-800">404</span>
      <p className="text-ink-500">This page doesn't exist.</p>
      <Link to="/" className="rounded-xl bg-brand-800 px-6 py-3 text-sm font-semibold text-white shadow-card hover:bg-brand-900">
        Back to Home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DashboardProvider>
          <Routes>
            {/* Marketing site */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/reset-password" element={<HomePage />} />
            </Route>

            {/* Web-app shell — deliberately distinct layout */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<DashboardOverviewPage />} />
              <Route path="book" element={<BookingPage />} />
              <Route path="appointments" element={<MyAppointmentsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route path="/admin" element={<RequireStaff><AdminPage /></RequireStaff>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
