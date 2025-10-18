import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Sidebar() {
  const location = useLocation();
  const { userProfile } = useAuth();

  return (
    <div style={{
      width: '250px',
      background: '#2c3e50',
      color: 'white',
      padding: '1rem 0',
      height: '100%',
      overflowY: 'auto'
    }}>
      <nav>
        <SidebarItem icon="🏠" text="Dashboard" to="/" />
        
        {/* Menú para Coordinador - SOLO LECTURA */}
        {userProfile?.rol === 'Coordinador' && (
          <>
            <SidebarItem icon="👥" text="Usuarios" to="/usuarios" />
            <SidebarItem icon="🏫" text="Estructura Académica" to="/estructura" />
            <SidebarItem icon="📝" text="Calificaciones" to="/calificaciones" />
            <SidebarItem icon="💬" text="Observaciones" to="/observaciones" />
            <SidebarItem icon="📊" text="Reportes" to="/reportes" />
          </>
        )}

        {/* Menú para Administrador y Profesor */}
        {(userProfile?.rol === 'Administrador' || userProfile?.rol === 'Profesor') && (
          <>
            {userProfile?.rol === 'Administrador' && (
              <>
                <SidebarItem icon="⚙️" text="Configuración" to="/configuracion" />
                <SidebarItem icon="👥" text="Usuarios" to="/usuarios" />
                <SidebarItem icon="🏫" text="Estructura Académica" to="/estructura" />
              </>
            )}
            <SidebarItem icon="📋" text="Plantillas de Criterios" to="/plantillas" />
            <SidebarItem icon="📝" text="Calificaciones" to="/calificaciones" />
            <SidebarItem icon="💬" text="Observaciones" to="/observaciones" />
            <SidebarItem icon="📊" text="Reportes" to="/reportes" />
          </>
        )}
      </nav>
    </div>
  );
}

function SidebarItem({ icon, text, to }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        color: 'white',
        textDecoration: 'none',
        background: isActive ? '#34495e' : 'transparent',
        borderLeft: isActive ? '4px solid #667eea' : '4px solid transparent',
        transition: 'all 0.3s'
      }}
      onMouseOver={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = '#34495e';
        }
      }}
      onMouseOut={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: '1.5rem', marginRight: '1rem' }}>{icon}</span>
      <span>{text}</span>
    </Link>
  );
}

export default Sidebar;