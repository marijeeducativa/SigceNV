import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function Calificaciones() {
  const { userProfile } = useAuth();
  
  // Estados principales
  const [cursos, setCursos] = useState([]);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [unidades, setUnidades] = useState([]);
  const [selectedUnidad, setSelectedUnidad] = useState('');
  const [criterios, setCriterios] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showUnidadModal, setShowUnidadModal] = useState(false);
  const [showCriterioModal, setShowCriterioModal] = useState(false);
  
  // Formularios
  const [unidadForm, setUnidadForm] = useState({ nombre: '' });
  const [criterioForm, setCriterioForm] = useState({
    competencia_grupo: 'C1',
    nombre: '',
    valor_maximo: 10
  });

  // Cargar cursos al montar
  useEffect(() => {
    loadCursos();
  }, [userProfile]);

  // Cargar datos cuando cambia el curso
  useEffect(() => {
    if (selectedCurso) {
      loadUnidades();
      loadEstudiantes();
    }
  }, [selectedCurso]);

  // Cargar datos cuando cambia la unidad
  useEffect(() => {
    if (selectedUnidad) {
      loadCriterios();
      loadCalificaciones();
    }
  }, [selectedUnidad]);

  // ==========================================
  // FUNCIONES DE CARGA DE DATOS
  // ==========================================

  const loadCursos = async () => {
  try {
    setLoading(true);
    
    let query = supabase
      .from('cursos')
      .select(`
        *,
        grupos (nivel, grado, seccion),
        asignaturas (nombre)
      `);

    // Si es profesor, solo sus cursos asignados
    if (userProfile?.rol === 'Profesor') {
      const { data: asignaciones } = await supabase
        .from('asignaciones')
        .select('curso_id')
        .eq('user_id', userProfile.id);
      
      const cursosIds = asignaciones?.map(a => a.curso_id) || [];
      if (cursosIds.length > 0) {
        query = query.in('id', cursosIds);
      } else {
        setCursos([]);
        setLoading(false);
        return;
      }
    }
    // Si es Administrador, no aplicar filtro (ve todos los cursos)

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    setCursos(data || []);
  } catch (error) {
    console.error('Error:', error);
    setMessage({ type: 'error', text: 'Error al cargar cursos' });
  } finally {
    setLoading(false);
  }
};

  const loadUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('curso_id', selectedCurso)
        .order('created_at');

      if (error) throw error;
      setUnidades(data || []);
      
      // Seleccionar primera unidad automáticamente
      if (data && data.length > 0 && !selectedUnidad) {
        setSelectedUnidad(data[0].id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCriterios = async () => {
    try {
      const { data, error } = await supabase
        .from('criterios')
        .select('*')
        .eq('unidad_id', selectedUnidad)
        .order('competencia_grupo', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      setCriterios(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadEstudiantes = async () => {
    try {
      // Obtener el grupo_id del curso seleccionado
      const curso = cursos.find(c => c.id === selectedCurso);
      if (!curso) return;

      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('grupo_id', curso.grupo_id)
        .order('num_orden');

      if (error) throw error;
      setEstudiantes(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCalificaciones = async () => {
    try {
      const { data, error } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('unidad_id', selectedUnidad);

      if (error) throw error;
      setCalificaciones(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ==========================================
  // FUNCIONES PARA UNIDADES
  // ==========================================

  const handleCreateUnidad = () => {
    setUnidadForm({ nombre: '' });
    setShowUnidadModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleSaveUnidad = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('unidades')
        .insert({
          curso_id: selectedCurso,
          nombre: unidadForm.nombre
        })
        .select()
        .single();

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Unidad creada' });
      await loadUnidades();
      setSelectedUnidad(data.id); // Seleccionar la nueva unidad
      setShowUnidadModal(false);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnidad = async () => {
    if (!selectedUnidad) return;
    
    const unidad = unidades.find(u => u.id === selectedUnidad);
    if (!confirm(`¿Eliminar "${unidad?.nombre}"? Se eliminarán todos los criterios y calificaciones.`)) {
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('unidades')
        .delete()
        .eq('id', selectedUnidad);

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Unidad eliminada' });
      setSelectedUnidad('');
      await loadUnidades();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FUNCIONES PARA CRITERIOS
  // ==========================================

  const handleCreateCriterio = () => {
    setCriterioForm({
      competencia_grupo: 'C1',
      nombre: '',
      valor_maximo: 10
    });
    setShowCriterioModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleSaveCriterio = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('criterios')
        .insert({
          unidad_id: selectedUnidad,
          competencia_grupo: criterioForm.competencia_grupo,
          nombre: criterioForm.nombre,
          valor_maximo: parseInt(criterioForm.valor_maximo)
        });

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Criterio creado' });
      await loadCriterios();
      await loadCalificaciones(); // Recargar para actualizar tabla
      setShowCriterioModal(false);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCriterio = async (criterioId) => {
    if (!confirm('¿Eliminar este criterio? Se eliminarán todas las calificaciones asociadas.')) {
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('criterios')
        .delete()
        .eq('id', criterioId);

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Criterio eliminado' });
      await loadCriterios();
      await loadCalificaciones();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FUNCIONES PARA CALIFICACIONES
  // ==========================================

  const getCalificacion = (estudianteId, criterioId) => {
    const cal = calificaciones.find(
      c => c.estudiante_id === estudianteId && c.criterio_id === criterioId
    );
    return cal ? cal.valor : '';
  };

  const handleCalificacionChange = async (estudianteId, criterioId, valor) => {
    // Validar que no exceda el valor máximo
    const criterio = criterios.find(c => c.id === criterioId);
    if (criterio && valor && parseFloat(valor) > criterio.valor_maximo) {
      setMessage({ 
        type: 'error', 
        text: `❌ El valor no puede exceder ${criterio.valor_maximo}` 
      });
      return;
    }

    try {
      setSaving(true);

      // Buscar si ya existe la calificación
      const calExistente = calificaciones.find(
        c => c.estudiante_id === estudianteId && c.criterio_id === criterioId
      );

      if (calExistente) {
        // Actualizar
        if (valor === '' || valor === null) {
          // Eliminar si está vacío
          const { error } = await supabase
            .from('calificaciones')
            .delete()
            .eq('id', calExistente.id);

          if (error) throw error;
        } else {
          // Actualizar valor
          const { error } = await supabase
            .from('calificaciones')
            .update({ 
              valor: parseFloat(valor),
              updated_at: new Date().toISOString()
            })
            .eq('id', calExistente.id);

          if (error) throw error;
        }
      } else if (valor !== '' && valor !== null) {
        // Crear nueva
        const { error } = await supabase
          .from('calificaciones')
          .insert({
            unidad_id: selectedUnidad,
            estudiante_id: estudianteId,
            criterio_id: criterioId,
            valor: parseFloat(valor)
          });

        if (error) throw error;
      }

      // Recargar calificaciones
      await loadCalificaciones();
      setMessage({ type: 'success', text: '💾 Guardado' });
      
      // Limpiar mensaje después de 2 segundos
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  // Calcular totales por competencia para un estudiante
  const calcularTotalCompetencia = (estudianteId, competencia) => {
    const criteriosCompetencia = criterios.filter(c => c.competencia_grupo === competencia);
    let total = 0;
    
    criteriosCompetencia.forEach(criterio => {
      const cal = calificaciones.find(
        c => c.estudiante_id === estudianteId && c.criterio_id === criterio.id
      );
      if (cal) {
        total += cal.valor;
      }
    });
    
    return total;
  };

  // Obtener competencias únicas
  const competenciasUnicas = [...new Set(criterios.map(c => c.competencia_grupo))].sort();

  // ==========================================
  // RENDER
  // ==========================================

  if (loading && cursos.length === 0) {
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

  const cursoSeleccionado = cursos.find(c => c.id === selectedCurso);
  const unidadSeleccionada = unidades.find(u => u.id === selectedUnidad);

  return (
    <div style={{
      background: 'white',
      padding: '2rem',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '2rem',
        borderBottom: '2px solid #667eea',
        paddingBottom: '1rem'
      }}>
        <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
          📝 Gestión de Calificaciones
        </h1>
        <p style={{ color: '#666', margin: 0 }}>
          Ingresa y administra las calificaciones de tus estudiantes
        </p>
      </div>

      {/* Mensajes */}
      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Selector de Curso */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '0.5rem', 
          fontWeight: '600',
          fontSize: '1.1rem'
        }}>
          📚 Seleccionar Curso
        </label>
        
        {cursos.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffc107'
          }}>
            <p style={{ margin: 0, color: '#856404' }}>
              {userProfile?.rol === 'Profesor' 
                ? 'No tienes cursos asignados. Contacta al administrador.'
                : 'No hay cursos creados. Ve a Estructura Académica → Cursos.'}
            </p>
          </div>
        ) : (
          <select
            value={selectedCurso}
            onChange={(e) => {
              setSelectedCurso(e.target.value);
              setSelectedUnidad('');
            }}
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '0.75rem',
              border: '2px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            <option value="">-- Seleccione un curso --</option>
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.asignaturas.nombre} - {curso.grupos.grado}° {curso.grupos.seccion} ({curso.grupos.nivel})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Contenido principal (solo si hay curso seleccionado) */}
      {selectedCurso && (
        <>
          {/* Selector de Unidad */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: '600',
              fontSize: '1.1rem'
            }}>
              📑 Unidad Didáctica
            </label>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {unidades.length === 0 ? (
                <div style={{
                  padding: '1rem',
                  background: '#fff3cd',
                  borderRadius: '8px',
                  border: '1px solid #ffc107',
                  flex: 1
                }}>
                  <p style={{ margin: 0, color: '#856404' }}>
                    No hay unidades. Crea una para comenzar.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedUnidad}
                  onChange={(e) => setSelectedUnidad(e.target.value)}
                  style={{
                    flex: 1,
                    maxWidth: '400px',
                    padding: '0.75rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Seleccione una unidad --</option>
                  {unidades.map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>
                      {unidad.nombre}
                    </option>
                  ))}
                </select>
              )}
              
              <button
                onClick={handleCreateUnidad}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                ➕ Nueva Unidad
              </button>
              
              {selectedUnidad && (
                <button
                  onClick={handleDeleteUnidad}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🗑️ Eliminar Unidad
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Calificaciones (solo si hay unidad seleccionada) */}
          {selectedUnidad && (
            <>
              {/* Botón para agregar criterio */}
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={handleCreateCriterio}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  ➕ Nuevo Criterio
                </button>
              </div>

              {/* Info del curso y unidad */}
              <div style={{
                background: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <strong>Curso:</strong> {cursoSeleccionado?.asignaturas.nombre} - {cursoSeleccionado?.grupos.grado}° {cursoSeleccionado?.grupos.seccion}
                </div>
                <div>
                  <strong>Unidad:</strong> {unidadSeleccionada?.nombre}
                </div>
                <div>
                  <strong>Estudiantes:</strong> {estudiantes.length}
                </div>
                <div>
                  <strong>Criterios:</strong> {criterios.length}
                </div>
              </div>

              {/* Tabla de Calificaciones */}
              {criterios.length === 0 ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: '#fff3cd',
                  borderRadius: '8px',
                  border: '1px solid #ffc107'
                }}>
                  <p style={{ margin: 0, color: '#856404', fontSize: '1.1rem' }}>
                    📋 No hay criterios de evaluación en esta unidad.
                    <br />
                    Haz clic en "Nuevo Criterio" para comenzar.
                  </p>
                </div>
              ) : estudiantes.length === 0 ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: '#fff3cd',
                  borderRadius: '8px',
                  border: '1px solid #ffc107'
                }}>
                  <p style={{ margin: 0, color: '#856404', fontSize: '1.1rem' }}>
                    🎓 No hay estudiantes en este grupo.
                    <br />
                    Ve a Estructura Académica → Estudiantes para agregar.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem',
                    minWidth: '800px'
                  }}>
                    <thead>
                      {/* Fila 1: Competencias agrupadas */}
                      <tr style={{ background: '#667eea', color: 'white' }}>
                        <th rowSpan="2" style={{
                          padding: '1rem',
                          borderRight: '2px solid white',
                          position: 'sticky',
                          left: 0,
                          background: '#667eea',
                          zIndex: 2
                        }}>
                          Estudiante
                        </th>
                        {competenciasUnicas.map(comp => {
                          const criteriosComp = criterios.filter(c => c.competencia_grupo === comp);
                          return (
                            <th
                              key={comp}
                              colSpan={criteriosComp.length + 1}
                              style={{
                                padding: '0.5rem',
                                textAlign: 'center',
                                borderRight: '2px solid white'
                              }}
                            >
                              {comp}
                            </th>
                          );
                        })}
                      </tr>
                      {/* Fila 2: Criterios individuales */}
                      <tr style={{ background: '#764ba2', color: 'white' }}>
                        {competenciasUnicas.map(comp => {
                          const criteriosComp = criterios.filter(c => c.competencia_grupo === comp);
                          return (
                            <React.Fragment key={comp}>
                              {criteriosComp.map(criterio => (
                                <th key={criterio.id} style={{
                                  padding: '0.5rem',
                                  textAlign: 'center',
                                  fontSize: '0.8rem',
                                  minWidth: '100px',
                                  borderRight: '1px solid rgba(255,255,255,0.3)'
                                }}>
                                  <div>{criterio.nombre}</div>
                                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                    ({criterio.valor_maximo}pts)
                                  </div>
                                  <button
                                    onClick={() => handleDeleteCriterio(criterio.id)}
                                    style={{
                                      marginTop: '0.25rem',
                                      padding: '0.25rem 0.5rem',
                                      background: 'rgba(255,255,255,0.2)',
                                      color: 'white',
                                      border: '1px solid white',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    🗑️
                                  </button>
                                </th>
                              ))}
                              <th style={{
                                padding: '0.5rem',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                borderRight: '2px solid white',
                                background: 'rgba(0,0,0,0.2)'
                              }}>
                                Total {comp}
                              </th>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {estudiantes.map((estudiante, idx) => (
                        <tr
                          key={estudiante.id}
                          style={{
                            borderBottom: '1px solid #dee2e6',
                            background: idx % 2 === 0 ? 'white' : '#f8f9fa'
                          }}
                        >
                          <td style={{
                            padding: '0.75rem',
                            fontWeight: '600',
                            position: 'sticky',
                            left: 0,
                            background: idx % 2 === 0 ? 'white' : '#f8f9fa',
                            borderRight: '2px solid #dee2e6',
                            zIndex: 1
                          }}>
                            {estudiante.num_orden}. {estudiante.nombres} {estudiante.apellidos}
                          </td>
                          {competenciasUnicas.map(comp => {
                            const criteriosComp = criterios.filter(c => c.competencia_grupo === comp);
                            return (
                              <React.Fragment key={comp}>
                                {criteriosComp.map(criterio => (
                                  <td key={criterio.id} style={{
                                    padding: '0.5rem',
                                    textAlign: 'center',
                                    borderRight: '1px solid #dee2e6'
                                  }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={criterio.valor_maximo}
                                      step="0.01"
                                      value={getCalificacion(estudiante.id, criterio.id)}
                                      onChange={(e) => handleCalificacionChange(
                                        estudiante.id,
                                        criterio.id,
                                        e.target.value
                                      )}
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '2px solid #e1e8ed',
                                        borderRadius: '4px',
                                        textAlign: 'center',
                                        fontSize: '1rem'
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor =
                 e.target.style.borderColor = '#667eea';
                                        e.target.select();
                                      }}
                                      onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                                    />
                                  </td>
                                ))}
                                <td style={{
                                  padding: '0.75rem',
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  background: 'rgba(102, 126, 234, 0.1)',
                                  borderRight: '2px solid #dee2e6',
                                  fontSize: '1.1rem',
                                  color: '#667eea'
                                }}>
                                  {calcularTotalCompetencia(estudiante.id, comp).toFixed(2)}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal: Nueva Unidad */}
      {showUnidadModal && (
        <Modal onClose={() => setShowUnidadModal(false)}>
          <h2 style={{ marginBottom: '1.5rem' }}>➕ Nueva Unidad Didáctica</h2>
          <form onSubmit={handleSaveUnidad}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Nombre de la Unidad *
              </label>
              <input
                type="text"
                value={unidadForm.nombre}
                onChange={(e) => setUnidadForm({ ...unidadForm, nombre: e.target.value })}
                required
                placeholder="Ej: Primera Unidad, Unidad 1, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowUnidadModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#999' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {loading ? 'Guardando...' : 'Crear Unidad'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Nuevo Criterio */}
      {showCriterioModal && (
        <Modal onClose={() => setShowCriterioModal(false)}>
          <h2 style={{ marginBottom: '1.5rem' }}>➕ Nuevo Criterio de Evaluación</h2>
          <form onSubmit={handleSaveCriterio}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Competencia *
              </label>
              <select
                value={criterioForm.competencia_grupo}
                onChange={(e) => setCriterioForm({ ...criterioForm, competencia_grupo: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                <option value="C1">C1 - Competencia 1</option>
                <option value="C2">C2 - Competencia 2</option>
                <option value="C3">C3 - Competencia 3</option>
                <option value="C4">C4 - Competencia 4</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Nombre del Criterio *
              </label>
              <input
                type="text"
                value={criterioForm.nombre}
                onChange={(e) => setCriterioForm({ ...criterioForm, nombre: e.target.value })}
                required
                placeholder="Ej: Examen escrito, Tarea, Proyecto"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Valor Máximo (puntos) *
              </label>
              <input
                type="number"
                value={criterioForm.valor_maximo}
                onChange={(e) => setCriterioForm({ ...criterioForm, valor_maximo: e.target.value })}
                required
                min="1"
                max="100"
                placeholder="Ej: 30"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{
              background: '#e3f2fd',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              color: '#1976d2'
            }}>
              💡 <strong>Tip:</strong> Agrupa tus criterios por competencias (C1, C2, C3, C4) para facilitar el cálculo de totales.
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowCriterioModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#999' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {loading ? 'Guardando...' : 'Crear Criterio'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Importar React para usar Fragment
import React from 'react';

// Componente Modal
function Modal({ onClose, children }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '10px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {children}
      </div>
    </div>
  );
}

export default Calificaciones;                       