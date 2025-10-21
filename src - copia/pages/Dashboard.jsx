import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';

function Dashboard() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalProfesores: 0,
    totalCursos: 0,
    totalEstudiantes: 0,
    totalGrupos: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      loadStats();
    }
  }, [userProfile]);

  const loadStats = async () => {
    try {
      setLoading(true);

      const { data: profesores } = await supabase
        .from('usuarios')
        .select('id')
        .eq('rol', 'Profesor');

      const { data: cursos } = await supabase
        .from('cursos')
        .select('id');

      const { data: estudiantes } = await supabase
        .from('estudiantes')
        .select('id');

      const { data: grupos } = await supabase
        .from('grupos')
        .select('id');

      setStats({
        totalProfesores: profesores?.length || 0,
        totalCursos: cursos?.length || 0,
        totalEstudiantes: estudiantes?.length || 0,
        totalGrupos: grupos?.length || 0
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          margin: '0 auto 1rem',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header con bienvenida */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        borderRadius: '15px',
        marginBottom: '2rem',
        color: 'white',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
      }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700' }}>
          👋 ¡Bienvenido, {userProfile?.nombre_completo}!
        </h1>
        <p style={{ margin: 0, opacity: 0.95, fontSize: '1.1rem' }}>
          Panel de administración del sistema
        </p>
      </div>

      {/* Estadísticas en formato horizontal compacto */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <MiniStatCard 
          icon="👥" 
          title="Profesores" 
          value={stats.totalProfesores} 
          color="#667eea"
          bgGradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
        <MiniStatCard 
          icon="📚" 
          title="Cursos" 
          value={stats.totalCursos} 
          color="#28a745"
          bgGradient="linear-gradient(135deg, #28a745 0%, #20c997 100%)"
        />
        <MiniStatCard 
          icon="🏫" 
          title="Grupos" 
          value={stats.totalGrupos} 
          color="#ffc107"
          bgGradient="linear-gradient(135deg, #ffc107 0%, #ff9800 100%)"
        />
        <MiniStatCard 
          icon="🎓" 
          title="Estudiantes" 
          value={stats.totalEstudiantes} 
          color="#17a2b8"
          bgGradient="linear-gradient(135deg, #17a2b8 0%, #138496 100%)"
        />
      </div>

      {/* Accesos Rápidos en grid */}
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '15px',
        boxShadow: '0 2px 15px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ 
          margin: '0 0 1.5rem 0', 
          color: '#333',
          fontSize: '1.5rem',
          fontWeight: '600'
        }}>
          🚀 Accesos Rápidos
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '1rem'
        }}>
          {userProfile?.rol === 'Administrador' && (
            <>
              <QuickLink icon="⚙️" title="Configuración" to="/configuracion" color="#667eea" />
              <QuickLink icon="👥" title="Usuarios" to="/usuarios" color="#6f42c1" />
              <QuickLink icon="🏫" title="Estructura" to="/estructura" color="#fd7e14" />
            </>
          )}
          <QuickLink icon="📋" title="Plantillas" to="/plantillas" color="#20c997" />
          <QuickLink icon="📝" title="Calificaciones" to="/calificaciones" color="#e83e8c" />
          <QuickLink icon="💬" title="Observaciones" to="/observaciones" color="#17a2b8" />
          <QuickLink icon="📊" title="Reportes" to="/reportes" color="#28a745" />
        </div>
      </div>

      {/* Información adicional */}
      {userProfile?.rol === 'Administrador' && (
        <div style={{
          marginTop: '2rem',
          background: '#f8f9fa',
          padding: '1.5rem',
          borderRadius: '15px',
          border: '2px solid #e9ecef'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#495057', fontSize: '1.2rem' }}>
            📌 Acceso Administrativo
          </h3>
          <p style={{ margin: 0, color: '#6c757d', lineHeight: '1.6' }}>
            Como administrador, tienes acceso completo a todas las funcionalidades del sistema. 
            Puedes gestionar usuarios, configurar el centro educativo, administrar la estructura académica 
            y supervisar todo el proceso de calificaciones.
          </p>
        </div>
      )}
    </div>
  );
}

// Tarjeta de estadística compacta y elegante
function MiniStatCard({ icon, title, value, color, bgGradient }) {
  return (
    <div style={{
      background: bgGradient,
      padding: '1.25rem',
      borderRadius: '12px',
      color: 'white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'transform 0.2s',
      cursor: 'default'
    }}
    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '0.75rem'
      }}>
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        <div style={{ 
          fontSize: '2rem', 
          fontWeight: '700',
          lineHeight: '1'
        }}>
          {value}
        </div>
      </div>
      <div style={{ 
        fontSize: '0.9rem', 
        fontWeight: '500',
        opacity: 0.95
      }}>
        {title}
      </div>
    </div>
  );
}

// Tarjeta de acceso rápido mejorada
function QuickLink({ icon, title, to, color }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
        background: 'white',
        border: `2px solid ${color}20`,
        borderRadius: '12px',
        textDecoration: 'none',
        color: color,
        transition: 'all 0.3s',
        minHeight: '120px'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 8px 20px ${color}30`;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = `${color}20`;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <h3 style={{ 
        margin: 0, 
        fontSize: '0.95rem',
        fontWeight: '600',
        textAlign: 'center'
      }}>
        {title}
      </h3>
    </Link>
  );
}

export default Dashboard;