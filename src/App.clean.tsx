import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WorkingLogin from './pages/WorkingLogin';
import StaffDashboard from './pages/StaffDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole: 'staff' | 'volunteer' }) {
  const { user, loading } = useAuth();

  // No localStorage checks - rely on AuthContext for authentication state

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-green-100 animate-fade-in">
        {/* Logo/Brand */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">CN</span>
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">Community Node</h1>
            <p className="text-gray-600 text-sm lg:text-base">Connecting volunteers with communities</p>
          </div>
        </div>
        
        {/* Animated Loading Spinner */}
        <div className="relative mb-8">
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-green-400 rounded-full animate-spin animation-delay-150"></div>
        </div>
        
        {/* Loading Text with Animated Dots */}
        <div className="text-center">
          <p className="text-gray-700 text-lg font-medium">
            Loading
            <span className="inline-flex">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse animation-delay-200">.</span>
              <span className="animate-pulse animation-delay-400">.</span>
            </span>
          </p>
        </div>
        
              </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-green-100 animate-fade-in">
        {/* Logo/Brand */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">CN</span>
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">Community Node</h1>
            <p className="text-gray-600 text-sm lg:text-base">Connecting volunteers with communities</p>
          </div>
        </div>
        
        {/* Animated Loading Spinner */}
        <div className="relative mb-8">
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-green-400 rounded-full animate-spin animation-delay-150"></div>
        </div>
        
        {/* Loading Text with Animated Dots */}
        <div className="text-center">
          <p className="text-gray-700 text-lg font-medium">
            Loading
            <span className="inline-flex">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse animation-delay-200">.</span>
              <span className="animate-pulse animation-delay-400">.</span>
            </span>
          </p>
        </div>
        
              </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={user ? <Navigate to={user.role === 'staff' ? '/staff' : '/volunteer'} replace /> : <WorkingLogin />} 
      />
      <Route 
        path="/staff" 
        element={
          <ProtectedRoute requiredRole="staff">
            <StaffDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/volunteer" 
        element={
          <ProtectedRoute requiredRole="volunteer">
            <VolunteerDashboard />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
