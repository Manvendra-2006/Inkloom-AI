// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeSubmissionsPage from './pages/EmployeeSubmissionsPage';
import CreateAdPage from './pages/CreateAdPage';
import EmployeeAdDetail from './pages/EmployeeAdDetail';
import AdminDashboard from './pages/AdminDashboard';
import BrandProfile from './pages/BrandProfile';
import ReviewsPage from './pages/ReviewsPage';
import SocialPage from './pages/SocialPage';
import PublishingPage from './pages/PublishingPage';
import HistoryPage from './pages/HistoryPage';
import { useAuth } from './context/AuthContext';

function PrivateRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="container py-5 text-center" role="status">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Employee */}
        <Route
          path="/employee/dashboard"
          element={
            <PrivateRoute allowedRoles={['EMPLOYEE']}>
              <EmployeeDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/employee/create-ad"
          element={
            <PrivateRoute allowedRoles={['EMPLOYEE']}>
              <CreateAdPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/employee/submissions"
          element={
            <PrivateRoute allowedRoles={['EMPLOYEE']}>
              <EmployeeSubmissionsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/employee/ad/:id"
          element={
            <PrivateRoute allowedRoles={['EMPLOYEE']}>
              <EmployeeAdDetail />
            </PrivateRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/brand-profiles"
          element={
            <PrivateRoute allowedRoles={['ADMIN']}>
              <BrandProfile />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/guidelines"
          element={
            <PrivateRoute allowedRoles={['ADMIN']}>
              <Navigate to="/admin/brand-profiles" replace />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <PrivateRoute allowedRoles={['ADMIN']}>
              <ReviewsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/social"
          element={
            <PrivateRoute allowedRoles={['ADMIN']}>
              <SocialPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/publishing"
          element={
            <PrivateRoute allowedRoles={['ADMIN']}>
              <PublishingPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/history"
          element={
            <PrivateRoute allowedRoles={['ADMIN']}>
              <HistoryPage />
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
