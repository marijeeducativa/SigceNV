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
  const [unitsProgress, setUnitsProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      loadStats();
    }
  }, [userProfile]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Load basic stats based on role
      if (userProfile?.rol === 'Administrador') {
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
      } else {
        // For teachers and coordinators, only load relevant stats
        const { data: cursos } = await supabase
          .from('cursos')
          .select('id');

        const { data: estudiantes } = await supabase
          .from('estudiantes')
          .select('id');

        setStats({
          totalProfesores: 0, // Not shown for non-admins
          totalCursos: cursos?.length || 0,
          totalEstudiantes: estudiantes?.length || 0,
          totalGrupos: 0 // Not shown for non-admins
        });
      }

      // Load units progress for all roles
      await loadUnitsProgress();

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnitsProgress = async () => {
    try {
      // Get all units grouped by period with course information
      const { data: unidades, error: unidadesError } = await supabase
        .from('unidades')
        .select(`
          id,
          nombre,
          periodo,
          curso_id,
          cursos (
            id,
            asignaturas (
              nombre
            ),
            grupos (
              nivel,
              grado,
              seccion
            )
          ),
          criterios (
            id,
            unidad_id
          )
        `)
        .order('periodo', { ascending: true })
        .order('nombre', { ascending: true });

      if (unidadesError) {
        console.error('Error fetching unidades:', unidadesError);
        return;
      }

      if (!unidades || unidades.length === 0) {
        setUnitsProgress({});
        return;
      }

      // Group by period and calculate completion
      const periodosData = {};
      const periodos = ['1', '2', '3'];

      for (const periodo of periodos) {
        const unidadesPeriodo = unidades.filter(u => u.periodo === periodo);

        if (unidadesPeriodo.length > 0) {
          // Group units by course
          const cursosMap = new Map();

          // First pass: group units by course
          for (const unidad of unidadesPeriodo) {
            const cursoKey = unidad.curso_id;
            if (!cursosMap.has(cursoKey)) {
              cursosMap.set(cursoKey, {
                curso: unidad.cursos,
                unidades: []
              });
            }
            cursosMap.get(cursoKey).unidades.push(unidad);
          }

          // Second pass: calculate completion for each course's units
          const cursosConProgreso = await Promise.all(
            Array.from(cursosMap.entries()).map(async ([cursoId, cursoData]) => {
              const unidadesCurso = cursoData.unidades;

              // Calculate completion for each unit in this course
              const unidadesConProgreso = await Promise.all(
                unidadesCurso.map(async (unidad) => {
                  const criteriosCount = unidad.criterios?.length || 0;

                  if (criteriosCount === 0) {
                    return { ...unidad, completionPercentage: 0 };
                  }

                  // Get students for this course
                  const { data: curso, error: cursoError } = await supabase
                    .from('cursos')
                    .select('grupo_id')
                    .eq('id', cursoId)
                    .single();

                  if (cursoError || !curso) {
                    console.warn(`No course found for unit ${unidad.id}`);
                    return { ...unidad, completionPercentage: 0 };
                  }

                  const { data: estudiantes, error: estudiantesError } = await supabase
                    .from('estudiantes')
                    .select('id')
                    .eq('grupo_id', curso.grupo_id);

                  if (estudiantesError || !estudiantes || estudiantes.length === 0) {
                    console.warn(`No students found for course ${cursoId}`);
                    return { ...unidad, completionPercentage: 0 };
                  }

                  // Calculate completion for this unit
                  let totalGrades = 0;
                  let completedGrades = 0;

                  for (const estudiante of estudiantes) {
                    for (const criterio of unidad.criterios) {
                      totalGrades++;
                      const { data: calificacion, error: calError } = await supabase
                        .from('calificaciones')
                        .select('id')
                        .eq('estudiante_id', estudiante.id)
                        .eq('unidad_id', unidad.id)
                        .eq('criterio_id', criterio.id)
                        .not('calificacion', 'is', null)
                        .single();

                      if (!calError && calificacion) completedGrades++;
                    }
                  }

                  const completionPercentage = totalGrades > 0 ? Math.round((completedGrades / totalGrades) * 100) : 0;

                  return { ...unidad, completionPercentage };
                })
              );

              // Calculate course-level completion
              const totalCompletion = unidadesConProgreso.reduce((sum, u) => sum + u.completionPercentage, 0);
              const avgCompletion = unidadesConProgreso.length > 0 ? Math.round(totalCompletion / unidadesConProgreso.length) : 0;

              return {
                curso: cursoData.curso,
                unidades: unidadesConProgreso,
                avgCompletion,
                totalUnidades: unidadesConProgreso.length
              };
            })
          );

          // Calculate overall period completion
          const totalPeriodCompletion = cursosConProgreso.reduce((sum, c) => sum + c.avgCompletion, 0);
          const avgPeriodCompletion = cursosConProgreso.length > 0 ? Math.round(totalPeriodCompletion / cursosConProgreso.length) : 0;

          periodosData[periodo] = {
            cursos: cursosConProgreso,
            avgCompletion: avgPeriodCompletion,
            totalUnidades: unidadesPeriodo.length
          };
        } else {
          periodosData[periodo] = {
            cursos: [],
            avgCompletion: 0,
            totalUnidades: 0
          };
        }
      }

      setUnitsProgress(periodosData);
    } catch (error) {
      console.error('Error loading units progress:', error);
      setUnitsProgress({});
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
        gridTemplateColumns: userProfile?.rol === 'Administrador' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {userProfile?.rol === 'Administrador' && (
          <MiniStatCard
            icon="👥"
            title="Profesores"
            value={stats.totalProfesores}
            color="#667eea"
            bgGradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
        )}
        <MiniStatCard
          icon="📚"
          title="Cursos"
          value={stats.totalCursos}
          color="#28a745"
          bgGradient="linear-gradient(135deg, #28a745 0%, #20c997 100%)"
        />
        {userProfile?.rol === 'Administrador' && (
          <MiniStatCard
            icon="🏫"
            title="Grupos"
            value={stats.totalGrupos}
            color="#ffc107"
            bgGradient="linear-gradient(135deg, #ffc107 0%, #ff9800 100%)"
          />
        )}
        <MiniStatCard
          icon="🎓"
          title="Estudiantes"
          value={stats.totalEstudiantes}
          color="#17a2b8"
          bgGradient="linear-gradient(135deg, #17a2b8 0%, #138496 100%)"
        />
      </div>

      {/* Progreso de Unidades por Período */}
      {(userProfile?.rol === 'Profesor' || userProfile?.rol === 'Coordinador' || userProfile?.rol === 'Administrador') && (
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '15px',
          boxShadow: '0 2px 15px rgba(0,0,0,0.08)',
          marginBottom: '2rem'
        }}>
          <h2 style={{
            margin: '0 0 1.5rem 0',
            color: '#333',
            fontSize: '1.5rem',
            fontWeight: '600'
          }}>
            📊 Progreso de Calificaciones por Período
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {Object.entries(unitsProgress).map(([periodo, data]) => (
              <PeriodProgressCard
                key={periodo}
                periodo={periodo}
                data={data}
              />
            ))}
          </div>
        </div>
      )}

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

// Componente para mostrar el progreso de unidades por período
function PeriodProgressCard({ periodo, data }) {
  const { cursos, avgCompletion, totalUnidades } = data;

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return '#28a745';
    if (percentage >= 60) return '#ffc107';
    if (percentage >= 40) return '#fd7e14';
    return '#dc3545';
  };

  const getProgressBg = (percentage) => {
    if (percentage >= 80) return 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    if (percentage >= 60) return 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)';
    if (percentage >= 40) return 'linear-gradient(135deg, #fd7e14 0%, #e8590c 100%)';
    return 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
  };

  return (
    <div style={{
      background: 'white',
      border: '2px solid #e9ecef',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{
          margin: 0,
          color: '#495057',
          fontSize: '1.2rem',
          fontWeight: '600'
        }}>
          📚 Período {periodo}
        </h3>
        <div style={{
          background: getProgressBg(avgCompletion),
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          fontSize: '0.9rem',
          fontWeight: '600'
        }}>
          {avgCompletion}% Completado
        </div>
      </div>

      <div style={{
        width: '100%',
        height: '8px',
        background: '#e9ecef',
        borderRadius: '4px',
        marginBottom: '1rem',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${avgCompletion}%`,
          height: '100%',
          background: getProgressColor(avgCompletion),
          borderRadius: '4px',
          transition: 'width 0.3s ease'
        }}></div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{
          margin: '0 0 0.5rem 0',
          color: '#6c757d',
          fontSize: '0.9rem'
        }}>
          <strong>{totalUnidades}</strong> unidad(es) en total
        </p>

        {cursos.length > 0 && (
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '0.5rem'
          }}>
            {cursos.map((cursoData, cursoIndex) => (
              <div key={cursoData.curso?.id || cursoIndex} style={{
                marginBottom: cursoIndex < cursos.length - 1 ? '1rem' : 0,
                padding: '0.75rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                {/* Course Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#495057'
                  }}>
                    {cursoData.curso?.asignaturas?.nombre || 'S/A'} - {cursoData.curso?.grupos?.nivel} {cursoData.curso?.grupos?.grado}{cursoData.curso?.grupos?.seccion}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '80px',
                      height: '8px',
                      background: '#e9ecef',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${cursoData.avgCompletion}%`,
                        height: '100%',
                        background: getProgressColor(cursoData.avgCompletion),
                        borderRadius: '4px'
                      }}></div>
                    </div>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: getProgressColor(cursoData.avgCompletion),
                      minWidth: '40px',
                      textAlign: 'right'
                    }}>
                      {cursoData.avgCompletion}%
                    </span>
                  </div>
                </div>

                {/* Units within this course */}
                <div style={{
                  display: 'grid',
                  gap: '0.5rem'
                }}>
                  {cursoData.unidades.map((unidad, unidadIndex) => (
                    <div key={unidad.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem',
                      background: 'white',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        color: '#495057',
                        flex: 1,
                        marginRight: '0.5rem'
                      }}>
                        {unidad.nombre}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '5px',
                          background: '#e9ecef',
                          borderRadius: '2.5px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${unidad.completionPercentage}%`,
                            height: '100%',
                            background: getProgressColor(unidad.completionPercentage),
                            borderRadius: '2.5px'
                          }}></div>
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: getProgressColor(unidad.completionPercentage),
                          minWidth: '30px',
                          textAlign: 'right'
                        }}>
                          {unidad.completionPercentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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