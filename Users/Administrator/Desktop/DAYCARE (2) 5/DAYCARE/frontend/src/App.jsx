import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';

// Components & Routing guards
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import LoadingFallback from './components/common/LoadingFallback';
import { ChunkErrorBoundary } from './components/common/ChunkErrorBoundary';
import BackendWakeupBanner from './components/common/BackendWakeupBanner';

// Lazy Loaded Pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

// Role Dashboards
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'));
const ParentDashboard = lazy(() => import('./pages/dashboards/ParentDashboard'));
const TeacherDashboard = lazy(() => import('./pages/dashboards/TeacherDashboard'));
const ReceptionDashboard = lazy(() => import('./pages/dashboards/ReceptionDashboard'));
const FeatureMockup = lazy(() => import('./pages/dashboards/FeatureMockup'));
const Settings = lazy(() => import('./pages/Settings'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));
const PaymentSuccess = lazy(() => import('./pages/features/PaymentSuccess'));

/**
 * Prefetch a lazy route's JS chunk without rendering it.
 * Call on link hover / focus so the chunk is in-flight before navigation.
 * Usage: prefetch(() => import('./pages/features/Communication'))
 */
export function prefetch(importFn) {
  importFn().catch(() => {}); // fire-and-forget
}

const DashboardRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // Staff no longer has its own dashboard — redirect to reception
  const role = user.role === 'staff' ? 'reception' : user.role;
  return <Navigate to={`/dashboard/${role}`} replace />;
};

function App() {
  return (
    <ChunkErrorBoundary label="App">
      <Router>
        <ThemeProvider>
          <LanguageProvider>
            <SettingsProvider>
              <AuthProvider>
                <SocketProvider>
                  <Suspense fallback={<LoadingFallback fullPage />}>
                    <BackendWakeupBanner />
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<Home />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/unauthorized" element={<Unauthorized />} />

                      {/* Dashboard redirect route */}
                      <Route element={<ProtectedRoute allowedRoles={['admin', 'parent', 'teacher', 'reception', 'staff']} />}>
                        <Route path="/dashboard" element={<DashboardRedirect />} />
                      </Route>

                      {/* Secure Role-Based Dashboards */}
                      {/* Admin Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                        <Route element={<DashboardLayout titleKey="adminPortal" />}>
                          <Route path="/dashboard/admin" element={<AdminDashboard />} />
                          <Route path="/dashboard/admin/settings" element={<Settings />} />
                          <Route path="/dashboard/admin/help" element={<HelpSupport />} />
                          <Route path="/dashboard/admin/:feature" element={<FeatureMockup />} />
                        </Route>
                      </Route>

                      {/* Parent Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
                        <Route element={<DashboardLayout titleKey="parentPortal" />}>
                          <Route path="/dashboard/parent" element={<ParentDashboard />} />
                          <Route path="/dashboard/parent/settings" element={<Settings />} />
                          <Route path="/dashboard/parent/help" element={<HelpSupport />} />
                          <Route path="/dashboard/parent/payments/success" element={<PaymentSuccess />} />
                          <Route path="/dashboard/parent/:feature" element={<FeatureMockup />} />
                        </Route>
                      </Route>

                      {/* Teacher Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
                        <Route element={<DashboardLayout titleKey="teacherPortal" />}>
                          <Route path="/dashboard/teacher" element={<TeacherDashboard />} />
                          <Route path="/dashboard/teacher/settings" element={<Settings />} />
                          <Route path="/dashboard/teacher/help" element={<HelpSupport />} />
                          <Route path="/dashboard/teacher/:feature" element={<FeatureMockup />} />
                        </Route>
                      </Route>

                      {/* Receptionist Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['reception']} />}>
                        <Route element={<DashboardLayout titleKey="receptionPortal" />}>
                          <Route path="/dashboard/reception" element={<ReceptionDashboard />} />
                          <Route path="/dashboard/reception/settings" element={<Settings />} />
                          <Route path="/dashboard/reception/help" element={<HelpSupport />} />
                          <Route path="/dashboard/reception/:feature" element={<FeatureMockup />} />
                        </Route>
                      </Route>

                      {/* Wildcard 404 handler - redirects back to main index */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </SocketProvider>
              </AuthProvider>
            </SettingsProvider>
          </LanguageProvider>
        </ThemeProvider>
      </Router>
    </ChunkErrorBoundary>
  );
}

export default App;
