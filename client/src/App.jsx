import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/Auth.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Supervisors from './pages/Supervisors.jsx';
import SupervisorDetail from './pages/SupervisorDetail.jsx';
import Students from './pages/Students.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Reports from './pages/Reports.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import ActivityPage from './pages/Activity.jsx';

function Protected({ children, admin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="جارٍ التحميل…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="جارٍ التحميل…" />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="reports" element={<Reports />} />
        <Route path="profile" element={<Profile />} />
        <Route
          path="supervisors"
          element={
            <Protected admin>
              <Supervisors />
            </Protected>
          }
        />
        <Route
          path="supervisors/:id"
          element={
            <Protected admin>
              <SupervisorDetail />
            </Protected>
          }
        />
        <Route
          path="activity"
          element={
            <Protected admin>
              <ActivityPage />
            </Protected>
          }
        />
        <Route
          path="settings"
          element={
            <Protected admin>
              <Settings />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
