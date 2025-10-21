import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function Reportes() {
  const { userProfile } = useAuth();
  
  // Estados principales
  const [config, setConfig] = useState(null);
  const [cursos, setCursos] = useState([]);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [selectedEstudiante, setSelectedEstudiante] = useState('');
  const [selectedPeriodo, setSelectedPeriodo] = useState('1er Trimestre');
  const [reporteData, setReporteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const periodos = ['1er Trimestre', '2do Trimestre', '3er Trimestre', 'Anual'];

  // Cargar configuración y cursos al montar
  useEffect(() => {
    loadConfig();
    loadCursos();
  }, [userProfile]);

  // Cargar estudiantes cuando cambia el curso
  useEffect(() => {
    if (selectedCurso) {
      loadEstudiantes();
    }
  }, [selectedCurso]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase.from('config').select('*').single();
      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCursos = async () => {
    try {
      setLoading(true);
      let query = supabase.from('cursos').select('*, grupos(nivel, grado, seccion), asignaturas(nombre)');
      
      if (userProfile?.rol === 'Profesor') {
        const { data: asignaciones } = await supabase.from('asignaciones').select('curso_id').eq('user_id', userProfile.id);
        const cursosIds = asignaciones?.map(a => a.curso_id) || [];
        if (cursosIds.length > 0) {
          query = query.in('id', cursosIds);
        } else {
          setCursos([]);
          setLoading(false);
          return;
        }
      }

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

  const loadEstudiantes = async () => {
    try {
      const curso = cursos.find(c => c.id === selectedCurso);
      if (!curso) return;
      
      const { data, error } = await supabase.from('estudiantes').select('*').eq('grupo_id', curso.grupo_id).order('num_orden');
      if (error) throw error;
      setEstudiantes(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleGenerarReporte = async () => {
    if (!selectedCurso || !selectedEstudiante) {
      setMessage({ type: 'error', text: '❌ Selecciona curso y estudiante' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      // 1. Obtener datos del curso y estudiante
      const curso = cursos.find(c => c.id === selectedCurso);
      const estudiante = estudiantes.find(e => e.id === selectedEstudiante);

      // 2. Obtener todas las unidades del curso
      const { data: unidades, error: unidadesError } = await supabase
        .from('unidades')
        .select('*')
        .eq('curso_id', selectedCurso)
        .order('created_at');

      if (unidadesError) throw unidadesError;

      // 3. Por cada unidad, obtener criterios y calificaciones
      const unidadesConDatos = await Promise.all(
        unidades.map(async (unidad) => {
          // Obtener criterios de la unidad
          const { data: criterios } = await supabase
            .from('criterios')
            .select('*')
            .eq('unidad_id', unidad.id)
            .order('competencia_grupo');

          // Obtener calificaciones del estudiante en esta unidad
          const { data: calificaciones } = await supabase
            .from('calificaciones')
            .select('*')
            .eq('unidad_id', unidad.id)
            .eq('estudiante_id', selectedEstudiante);

          return {
            ...unidad,
            criterios: criterios || [],
            calificaciones: calificaciones || []
          };
        })
      );

      // 4. Obtener comentario del período
      const { data: comentario } = await supabase
        .from('comentarios')
        .select('*')
        .eq('curso_id', selectedCurso)
        .eq('estudiante_id', selectedEstudiante)
        .eq('periodo', selectedPeriodo)
        .single();

      // 5. Construir objeto de reporte
      setReporteData({
        curso,
        estudiante,
        periodo: selectedPeriodo,
        unidades: unidadesConDatos,
        comentario: comentario?.texto || 'Sin comentarios registrados',
        config
      });

      setMessage({ type: 'success', text: '✅ Reporte generado' });
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ Error al generar reporte' });
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const calcularTotalCompetencia = (unidad, competencia) => {
    const criteriosComp = unidad.criterios.filter(c => c.competencia_grupo === competencia);
    let total = 0;
    
    criteriosComp.forEach(criterio => {
      const cal = unidad.calificaciones.find(c => c.criterio_id === criterio.id);
      if (cal) total += cal.valor;
    });
    
    return total;
  };

  const calcularTotalGeneral = (competencia) => {
    if (!reporteData) return 0;
    let total = 0;
    reporteData.unidades.forEach(unidad => {
      total += calcularTotalCompetencia(unidad, competencia);
    });
    return total;
  };

  const cursoSeleccionado = cursos.find(c => c.id === selectedCurso);

  if (loading && cursos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #667eea', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }}></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Panel de control (no se imprime) */}
      <div className="no-print" style={{ background: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
        <div style={{ marginBottom: '2rem', borderBottom: '2px solid #667eea', paddingBottom: '1rem' }}>
          <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>📊 Generación de Reportes</h1>
          <p style={{ color: '#666', margin: 0 }}>Genera boletines de calificaciones para tus estudiantes</p>
        </div>

        {message.text && (
          <div style={{ padding: '1rem', borderRadius: '8px', marginBottom: '1rem', background: message.type === 'success' ? '#d4edda' : '#f8d7da', color: message.type === 'success' ? '#155724' : '#721c24', border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}` }}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📚 Curso</label>
            <select value={selectedCurso} onChange={(e) => { setSelectedCurso(e.target.value); setSelectedEstudiante(''); setReporteData(null); }} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
              <option value="">Seleccione...</option>
              {cursos.map(curso => <option key={curso.id} value={curso.id}>{curso.asignaturas.nombre} - {curso.grupos.grado}° {curso.grupos.seccion}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>🎓 Estudiante</label>
            <select value={selectedEstudiante} onChange={(e) => { setSelectedEstudiante(e.target.value); setReporteData(null); }} disabled={!selectedCurso} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
              <option value="">Seleccione...</option>
              {estudiantes.map(est => <option key={est.id} value={est.id}>{est.num_orden}. {est.nombres} {est.apellidos}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📅 Período</label>
            <select value={selectedPeriodo} onChange={(e) => { setSelectedPeriodo(e.target.value); setReporteData(null); }} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
              {periodos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleGenerarReporte} disabled={loading || !selectedCurso || !selectedEstudiante} style={{ padding: '0.75rem 2rem', background: loading || !selectedCurso || !selectedEstudiante ? '#999' : '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: loading || !selectedCurso || !selectedEstudiante ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '1rem' }}>
            {loading ? 'Generando...' : '📊 Generar Reporte'}
          </button>
          
          {reporteData && (
            <button onClick={handleImprimir} style={{ padding: '0.75rem 2rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}>
              🖨️ Imprimir
            </button>
          )}
        </div>
      </div>

      {/* Boletín (se imprime) */}
      {reporteData && (
        <div className="boletin" style={{ background: 'white', padding: '3rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', maxWidth: '1000px', margin: '0 auto' }}>
          {/* Header del boletín */}
          <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '3px solid #667eea', paddingBottom: '1.5rem' }}>
            <h1 style={{ margin: '0 0 0.5rem 0', color: '#667eea', fontSize: '2rem' }}>
              {reporteData.config?.nombre_centro || 'Centro Educativo'}
            </h1>
            <h2 style={{ margin: 0, color: '#666', fontSize: '1.5rem', fontWeight: '400' }}>
              Boletín de Calificaciones
            </h2>
            {reporteData.config?.codigo_sigerd && (
              <p style={{ margin: '0.5rem 0 0 0', color: '#999', fontSize: '0.9rem' }}>
                Código SIGERD: {reporteData.config.codigo_sigerd}
              </p>
            )}
          </div>

          {/* Información del estudiante y curso */}
          <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <strong style={{ color: '#667eea' }}>Estudiante:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>{reporteData.estudiante.nombres} {reporteData.estudiante.apellidos}</p>
              </div>
              <div>
                <strong style={{ color: '#667eea' }}>Curso:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>{reporteData.curso.asignaturas.nombre}</p>
              </div>
              <div>
                <strong style={{ color: '#667eea' }}>Grupo:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>{reporteData.curso.grupos.grado}° {reporteData.curso.grupos.seccion} ({reporteData.curso.grupos.nivel})</p>
              </div>
              <div>
                <strong style={{ color: '#667eea' }}>Período:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>{reporteData.periodo}</p>
              </div>
              <div>
                <strong style={{ color: '#667eea' }}>Año Lectivo:</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>{reporteData.config?.anio_lectivo || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Calificaciones por unidad */}
          {reporteData.unidades.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
              <p style={{ margin: 0, color: '#856404' }}>No hay unidades registradas en este curso</p>
            </div>
          ) : (
            reporteData.unidades.map((unidad, idx) => {
              const competencias = [...new Set(unidad.criterios.map(c => c.competencia_grupo))].sort();
              
              return (
                <div key={unidad.id} style={{ marginBottom: '2rem', pageBreakInside: 'avoid' }}>
                  <h3 style={{ background: '#667eea', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', margin: 0 }}>
                    {unidad.nombre}
                  </h3>
                  
                  {unidad.criterios.length === 0 ? (
                    <div style={{ padding: '1rem', background: '#f8f9fa', border: '1px solid #dee2e6', borderTop: 'none' }}>
                      <p style={{ margin: 0, color: '#666' }}>Sin criterios registrados</p>
                    </div>
                  ) : (
                    <>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6', borderTop: 'none' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6', borderRight: '1px solid #dee2e6' }}>Criterio</th>
                            {competencias.map(comp => (
                              <th key={comp} style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6', borderRight: '1px solid #dee2e6', minWidth: '80px' }}>{comp}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {unidad.criterios.map((criterio, idx) => {
                            const cal = unidad.calificaciones.find(c => c.criterio_id === criterio.id);
                            return (
                              <tr key={criterio.id} style={{ background: idx % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                <td style={{ padding: '0.75rem', borderBottom: '1px solid #dee2e6', borderRight: '1px solid #dee2e6' }}>
                                  {criterio.nombre} <span style={{ color: '#999', fontSize: '0.85rem' }}>({criterio.valor_maximo}pts)</span>
                                </td>
                                {competencias.map(comp => (
                                  <td key={comp} style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #dee2e6', borderRight: '1px solid #dee2e6', fontWeight: criterio.competencia_grupo === comp ? '600' : 'normal' }}>
                                    {criterio.competencia_grupo === comp ? (cal ? cal.valor.toFixed(2) : '-') : ''}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#e3f2fd', fontWeight: '600' }}>
                            <td style={{ padding: '0.75rem', borderRight: '1px solid #dee2e6' }}>Total por Competencia</td>
                            {competencias.map(comp => (
                              <td key={comp} style={{ padding: '0.75rem', textAlign: 'center', borderRight: '1px solid #dee2e6', color: '#1976d2', fontSize: '1.1rem' }}>
                                {calcularTotalCompetencia(unidad, comp).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              );
            })
          )}

          {/* Totales generales */}
          {reporteData.unidades.length > 0 && reporteData.unidades.some(u => u.criterios.length > 0) && (
            <div style={{ marginBottom: '2rem', pageBreakInside: 'avoid' }}>
              <h3 style={{ background: '#28a745', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', margin: 0 }}>
                Totales Generales del Período
              </h3>
              <div style={{ border: '1px solid #dee2e6', borderTop: 'none', padding: '1.5rem', background: '#f8f9fa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem' }}>
                  {['C1', 'C2', 'C3', 'C4'].map(comp => {
                    const total = calcularTotalGeneral(comp);
                    if (total > 0) {
                      return (
                        <div key={comp} style={{ textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '8px', minWidth: '100px', border: '2px solid #28a745' }}>
                          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>{comp}</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#28a745' }}>{total.toFixed(2)}</div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Comentarios */}
          <div style={{ marginBottom: '2rem', pageBreakInside: 'avoid' }}>
            <h3 style={{ background: '#ffc107', color: '#333', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', margin: 0 }}>
              💬 Observaciones del Profesor
            </h3>
            <div style={{ border: '1px solid #dee2e6', borderTop: 'none', padding: '1.5rem', background: 'white', minHeight: '100px' }}>
              <p style={{ margin: 0, lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {reporteData.comentario}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px solid #dee2e6', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
            <p style={{ margin: 0 }}>Fecha de emisión: {new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style={{ margin: '0.5rem 0 0 0' }}>Sistema Integral de Gestión de Calificaciones Escolares (SIGCE)</p>
          </div>
        </div>
      )}

      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .boletin { 
            box-shadow: none !important; 
            max-width: 100% !important;
            padding: 1cm !important;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Reportes;