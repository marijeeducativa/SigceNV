function DashboardCoordinador() {
  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '2rem', borderBottom: '2px solid #667eea', paddingBottom: '1rem' }}>
        <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
          📊 Panel de Coordinación Académica
        </h1>
        <p style={{ color: '#666', margin: 0 }}>
          Vista general del progreso académico institucional
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ padding: '1.5rem', background: '#e3f2fd', borderRadius: '10px', border: '2px solid #90caf9' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Profesores</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#667eea' }}>-</div>
        </div>

        <div style={{ padding: '1.5rem', background: '#e8f5e9', borderRadius: '10px', border: '2px solid #81c784' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Cursos</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#28a745' }}>-</div>
        </div>

        <div style={{ padding: '1.5rem', background: '#fff3e0', borderRadius: '10px', border: '2px solid #ffb74d' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏫</div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Grupos</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffc107' }}>-</div>
        </div>

        <div style={{ padding: '1.5rem', background: '#e0f7fa', borderRadius: '10px', border: '2px solid #4dd0e1' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Estudiantes</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#17a2b8' }}>-</div>
        </div>
      </div>

      <div style={{ padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '1rem' }}>Bienvenido al Panel de Coordinación</h2>
        <p style={{ margin: 0, lineHeight: '1.8' }}>
          Desde aquí podrás visualizar el progreso académico general de la institución.
          Las estadísticas se cargarán próximamente.
        </p>
      </div>
    </div>
  );
}

export default DashboardCoordinador;