import { useAuth } from '../contexts/AuthContext';

function Header() {
  const { userProfile, signOut } = useAuth();

  return (
    <header style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Logo y título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '50px',
          height: '50px',
          background: 'white',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.5rem',
          color: '#667eea'
        }}>
          📚
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>SIGCE</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
            Sistema Integral de Gestión de Calificaciones
          </p>
        </div>
      </div>

      {/* Info del usuario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: '600' }}>
            {userProfile?.nombre_completo}
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
            {userProfile?.rol}
          </p>
        </div>
        <button
          onClick={signOut}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
          onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </header>
  );
}

export default Header;