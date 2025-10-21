import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DashboardCoordinador from './pages/DashboardCoordinador';
import Configuracion from './pages/Configuracion';
import Usuarios from './pages/Usuarios';
import Estructura from './pages/Estructura';
import Asignaciones from './pages/Asignaciones';
import Plantillas from './pages/Plantillas';
import Calificaciones from './pages/Calificaciones';
import Observaciones from './pages/Observaciones';
import Reportes from './pages/Reportes';

function DashboardRouter() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p>Cargando perfil...</p>
      </div>
    );
  }

  if (userProfile?.rol === 'Coordinador') {
    return <DashboardCoordinador />;
  }

  return <Dashboard />;
}

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Verificando sesión...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ecf0f1' }}>
      <Header />
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', minHeight: 'calc(100vh - 82px)', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedLayout><DashboardRouter /></ProtectedLayout>} />
          <Route path="/coordinador" element={<ProtectedLayout><DashboardCoordinador /></ProtectedLayout>} />
          <Route path="/configuracion" element={<ProtectedLayout><Configuracion /></ProtectedLayout>} />
          <Route path="/usuarios" element={<ProtectedLayout><Usuarios /></ProtectedLayout>} />
          <Route path="/estructura" element={<ProtectedLayout><Estructura /></ProtectedLayout>} />
          <Route path="/asignaciones" element={<ProtectedLayout><Asignaciones /></ProtectedLayout>} />
          <Route path="/plantillas" element={<ProtectedLayout><Plantillas /></ProtectedLayout>} />
          <Route path="/calificaciones" element={<ProtectedLayout><Calificaciones /></ProtectedLayout>} />
          <Route path="/observaciones" element={<ProtectedLayout><Observaciones /></ProtectedLayout>} />
          <Route path="/reportes" element={<ProtectedLayout><Reportes /></ProtectedLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </AuthProvider>
  );
}

export default App;