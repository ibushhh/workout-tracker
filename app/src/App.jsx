import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import AppShell from "./components/AppShell.jsx";
import Spinner from "./components/Spinner.jsx";
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import LogWorkout from "./pages/LogWorkout.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import Progress from "./pages/Progress.jsx";
import ExerciseLibrary from "./pages/ExerciseLibrary.jsx";
import Profile from "./pages/Profile.jsx";
import Settings from "./pages/Settings.jsx";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner page />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function RootRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner page />;
  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/log" element={<LogWorkout />} />
        <Route path="/log/:date" element={<LogWorkout />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/exercises" element={<ExerciseLibrary />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <RootRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
