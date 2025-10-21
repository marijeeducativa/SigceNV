import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function DashboardCoordinador() {
  const [stats, setStats] = useState({
    totalProfesores: 0,
    totalCursos: 0,
    totalEstudiantes: 0,
    totalGrupos: 0
  });
  const [unitsProgress, setUnitsProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Load basic stats for coordinators - same as admin
      const { data: profesores, error: profError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('rol', 'Profesor');

      const { data: cursos, error: cursosError } = await supabase
        .from('cursos')
        .select('id');

      const { data: estudiantes, error: estError } = await supabase
        .from('estudiantes')
        .select('id');

      const { data: grupos, error: gruposError } = await supabase
        .from('grupos')
        .select('id');


      setStats({
        totalProfesores: profesores?.length || 0,
        totalCursos: cursos?.length || 0,
        totalEstudiantes: estudiantes?.length || 0,
        totalGrupos: grupos?.length || 0
      });

      // Load units progress for coordinators
      await loadUnitsProgress();

    } catch (error) {
      console.error('Error loading coordinator stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnitsProgress = async () => {
    try {
      // Get all courses with their details to ensure structure is shown
      const { data: cursos, error: cursosError } = await supabase
        .from('cursos')
        .select(`
          id,
          asignaturas (
            nombre
          ),
          grupos (
            nivel,
            grado,
            seccion
          )
        `);

      if (cursosError) {
        console.error('Error fetching cursos:', cursosError);
        return;
      }

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

      // Group by period and calculate completion
      const periodosData = {};
      const periodos = ['1', '2', '3'];

      for (const periodo of periodos) {
        const unidadesPeriodo = unidades.filter(u => u.periodo === periodo);

        // Always show courses, even if no units exist yet
        const cursosMap = new Map();

        // First, add all courses to the map
        if (cursos) {
          cursos.forEach(curso => {
            cursosMap.set(curso.id, {
              curso: curso,
              unidades: []
            });
          });
        }

        // Then add units to their respective courses
        for (const unidad of unidadesPeriodo) {
          const cursoKey = unidad.curso_id;
          if (cursosMap.has(cursoKey)) {
            cursosMap.get(cursoKey).unidades.push(unidad);
          }
        }

        // Sort courses alphabetically by group name (6toA, 6toB, etc.)
        const cursosOrdenados = Array.from(cursosMap.entries()).sort(([, a], [, b]) => {
          const grupoA = `${a.curso?.grupos?.nivel || ''} ${a.curso?.grupos?.grado || ''}${a.curso?.grupos?.seccion || ''}`.trim();
          const grupoB = `${b.curso?.grupos?.nivel || ''} ${b.curso?.grupos?.grado || ''}${b.curso?.grupos?.seccion || ''}`.trim();
          return grupoA.localeCompare(grupoB);
        });

        // Calculate completion for each course's units
        const cursosConProgreso = await Promise.all(
          cursosOrdenados.map(async ([cursoId, cursoData]) => {
            const unidadesCurso = cursoData.unidades;

            if (unidadesCurso.length === 0) {
              // Course exists but no units yet
              return {
                curso: cursoData.curso,
                unidades: [],
                avgCompletion: 0,
                totalUnidades: 0
              };
            }

            // Calculate competency scores for each unit in this course
            const unidadesConProgreso = await Promise.all(
              unidadesCurso.map(async (unidad) => {
                const criteriosCount = unidad.criterios?.length || 0;

                if (criteriosCount === 0) {
                  return { ...unidad, completionPercentage: 0, competencias: { C1: 0, C2: 0, C3: 0, C4: 0 } };
                }

                // Get students for this course
                const { data: curso, error: cursoError } = await supabase
                  .from('cursos')
                  .select('grupo_id')
                  .eq('id', cursoId)
                  .single();

                if (cursoError || !curso) {
                  console.warn(`No course found for unit ${unidad.id}`);
                  return { ...unidad, completionPercentage: 0, competencias: { C1: 0, C2: 0, C3: 0, C4: 0 } };
                }

                const { data: estudiantes, error: estudiantesError } = await supabase
                  .from('estudiantes')
                  .select('id')
                  .eq('grupo_id', curso.grupo_id);

                if (estudiantesError || !estudiantes || estudiantes.length === 0) {
                  console.warn(`No students found for course ${cursoId}`);
                  return { ...unidad, completionPercentage: 0, competencias: { C1: 0, C2: 0, C3: 0, C4: 0 } };
                }

                // Calculate competency scores for this unit
                const competencias = { C1: 0, C2: 0, C3: 0, C4: 0 };
                let totalGrades = 0;
                let completedGrades = 0;

                for (const estudiante of estudiantes) {
                  for (const criterio of unidad.criterios) {
                    totalGrades++;
                    const { data: calificacion, error: calError } = await supabase
                      .from('calificaciones')
                      .select('valor')
                      .eq('estudiante_id', estudiante.id)
                      .eq('unidad_id', unidad.id)
                      .eq('criterio_id', criterio.id)
                      .not('valor', 'is', null)
                      .single();

                    if (!calError && calificacion) {
                      completedGrades++;
                      const comp = criterio.competencia_grupo;
                      if (comp && competencias.hasOwnProperty(comp)) {
                        competencias[comp] += calificacion.valor;
                      }
                    }
                  }
                }

                // Calculate average for each competency
                const numEstudiantes = estudiantes.length;
                if (numEstudiantes > 0) {
                  Object.keys(competencias).forEach(comp => {
                    competencias[comp] = competencias[comp] / numEstudiantes;
                  });
                }

                const completionPercentage = totalGrades > 0 ? Math.round((completedGrades / totalGrades) * 100) : 0;

                return { ...unidad, completionPercentage, competencias };
              })
            );

            // Calculate course-level completion and competency averages
            const totalCompletion = unidadesConProgreso.reduce((sum, u) => sum + u.completionPercentage, 0);
            const avgCompletion = unidadesConProgreso.length > 0 ? Math.round(totalCompletion / unidadesConProgreso.length) : 0;

            // Calculate period competency averages
            const competenciasPeriodo = { C1: 0, C2: 0, C3: 0, C4: 0 };
            if (unidadesConProgreso.length > 0) {
              unidadesConProgreso.forEach(unidad => {
                Object.keys(competenciasPeriodo).forEach(comp => {
                  competenciasPeriodo[comp] += unidad.competencias[comp] || 0;
                });
              });
              Object.keys(competenciasPeriodo).forEach(comp => {
                competenciasPeriodo[comp] = competenciasPeriodo[comp] / unidadesConProgreso.length;
              });
            }

            return {
              curso: cursoData.curso,
              unidades: unidadesConProgreso,
              avgCompletion,
              totalUnidades: unidadesConProgreso.length,
              competencias: competenciasPeriodo
            };
          })
        );

        // Calculate overall period completion and competency averages
        const totalPeriodCompletion = cursosConProgreso.reduce((sum, c) => sum + c.avgCompletion, 0);
        const avgPeriodCompletion = cursosConProgreso.length > 0 ? Math.round(totalPeriodCompletion / cursosConProgreso.length) : 0;

        // Calculate overall period competency averages
        const competenciasTotales = { C1: 0, C2: 0, C3: 0, C4: 0 };
        if (cursosConProgreso.length > 0) {
          cursosConProgreso.forEach(curso => {
            Object.keys(competenciasTotales).forEach(comp => {
              competenciasTotales[comp] += curso.competencias[comp] || 0;
            });
          });
          Object.keys(competenciasTotales).forEach(comp => {
            competenciasTotales[comp] = competenciasTotales[comp] / cursosConProgreso.length;
          });
        }

        periodosData[periodo] = {
          cursos: cursosConProgreso,
          avgCompletion: avgPeriodCompletion,
          totalUnidades: unidadesPeriodo.length,
          competencias: competenciasTotales
        };
      }

      setUnitsProgress(periodosData);
    } catch (error) {
      console.error('Error loading units progress:', error);
      setUnitsProgress({});
    }
  };

  if (loading) {
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
          👋 ¡Bienvenido, Coordinador!
        </h1>
        <p style={{ margin: 0, opacity: 0.95, fontSize: '1.1rem' }}>
          Panel de coordinación académica institucional
        </p>
      </div>

      {/* Estadísticas */}
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

      {/* Progreso de Unidades por Período */}
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
          {['1', '2', '3'].map((periodo) => (
            <PeriodProgressCard
              key={periodo}
              periodo={periodo}
              data={unitsProgress[periodo] || { cursos: [], avgCompletion: 0, totalUnidades: 0, competencias: { C1: 0, C2: 0, C3: 0, C4: 0 } }}
            />
          ))}
        </div>

        {Object.keys(unitsProgress).length === 0 && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6c757d'
          }}>
            <p>No hay unidades con calificaciones para mostrar</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Las unidades aparecerán aquí cuando se hayan creado y se hayan registrado calificaciones
            </p>
          </div>
        )}
      </div>

      {/* Información adicional */}
      <div style={{
        background: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '15px',
        border: '2px solid #e9ecef'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#495057', fontSize: '1.2rem' }}>
          📌 Panel de Coordinación Académica
        </h3>
        <p style={{ margin: 0, color: '#6c757d', lineHeight: '1.6' }}>
          Como coordinador, tienes acceso completo al progreso académico institucional.
          Puedes visualizar el avance de calificaciones por período y curso, facilitando
          la toma de decisiones pedagógicas y el seguimiento del rendimiento académico.
        </p>
      </div>
    </div>
  );
}

// Componente para mostrar el progreso de unidades por período
function PeriodProgressCard({ periodo, data }) {
  const { cursos, avgCompletion, totalUnidades, competencias } = data;

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

      {/* Competency Scores */}
      {competencias && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
          gap: '0.5rem',
          marginBottom: '1rem',
          padding: '0.75rem',
          background: '#f8f9fa',
          borderRadius: '8px'
        }}>
          {Object.entries(competencias).map(([comp, value]) => (
            <div key={comp} style={{
              textAlign: 'center',
              padding: '0.25rem',
              background: 'white',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: '#666',
                fontWeight: '600'
              }}>
                {comp}
              </div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: '700',
                color: '#495057'
              }}>
                {value.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      )}

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

export default DashboardCoordinador;