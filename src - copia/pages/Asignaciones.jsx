import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    curso_ids: [] // CAMBIO: Ahora es un array
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: asignacionesData, error: asignacionesError } = await supabase
        .from('asignaciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (asignacionesError) throw asignacionesError;

      const { data: profesoresData, error: profesoresError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('rol', 'Profesor')
        .order('nombre_completo');

      if (profesoresError) throw profesoresError;

      const { data: cursosData, error: cursosError } = await supabase
        .from('cursos')
        .select('*');

      if (cursosError) throw cursosError;

      const { data: gruposData, error: gruposError } = await supabase
        .from('grupos')
        .select('*');

      if (gruposError) throw gruposError;

      const { data: asignaturasData, error: asignaturasError } = await supabase
        .from('asignaturas')
        .select('*');

      if (asignaturasError) throw asignaturasError;

 const asignacionesConDatos = (asignacionesData || []).map(asignacion => {
  const profesor = profesoresData.find(p => p.id === asignacion.user_id);
  const curso = cursosData.find(c => c.id === asignacion.curso_id);
  const grupo = gruposData.find(g => g.id === curso?.grupo_id);
  const asignatura = asignaturasData.find(a => a.id === curso?.asignatura_id);

  // Generar nombre del grupo
  if (grupo) {
    grupo.nombre = `${grupo.nivel} ${grupo.grado}${grupo.seccion}`;
  }

  return {
    ...asignacion,
    profesor,
    curso: {
      ...curso,
      grupo,
      asignatura
    }
  };
});

      setAsignaciones(asignacionesConDatos);
      setProfesores(profesoresData || []);
      
// Preparar cursos con nombres completos
const cursosConInfo = (cursosData || []).map(curso => {
  const grupo = gruposData.find(g => g.id === curso.grupo_id);
  const asignatura = asignaturasData.find(a => a.id === curso.asignatura_id);
  
  // Generar nombre del grupo
  const nombreGrupo = grupo 
    ? `${grupo.nivel} ${grupo.grado}${grupo.seccion}` 
    : 'Sin grupo';
  
  return { 
    ...curso, 
    grupo: { ...grupo, nombre: nombreGrupo },
    asignatura,
    nombre_completo: `${asignatura?.nombre || 'Sin asignatura'} - ${nombreGrupo}`
  };
});

setCursos(cursosConInfo);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setMessage({ type: 'error', text: 'Error al cargar datos: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.curso_ids.length === 0) {
      setMessage({ type: 'error', text: '⚠️ Debes seleccionar al menos un curso' });
      return;
    }

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      // Verificar asignaciones existentes
      const { data: existentes } = await supabase
        .from('asignaciones')
        .select('curso_id')
        .eq('user_id', formData.user_id)
        .in('curso_id', formData.curso_ids);

      const cursosExistentes = existentes?.map(e => e.curso_id) || [];
      const cursosNuevos = formData.curso_ids.filter(id => !cursosExistentes.includes(id));

      if (cursosNuevos.length === 0) {
        setMessage({ type: 'error', text: '⚠️ Todas las asignaciones ya existen' });
        setSaving(false);
        return;
      }

      // Crear asignaciones múltiples
      const asignacionesNuevas = cursosNuevos.map(curso_id => ({
        user_id: formData.user_id,
        curso_id
      }));

      const { error } = await supabase
        .from('asignaciones')
        .insert(asignacionesNuevas);

      if (error) throw error;

      const mensaje = cursosExistentes.length > 0 
        ? `✅ ${cursosNuevos.length} asignación(es) creada(s). ${cursosExistentes.length} ya existía(n).`
        : `✅ ${cursosNuevos.length} asignación(es) creada(s) exitosamente`;

      setMessage({ type: 'success', text: mensaje });
      setShowModal(false);
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error guardando asignaciones:', error);
      setMessage({ type: 'error', text: 'Error: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta asignación?')) return;

    try {
      const { error } = await supabase
        .from('asignaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: '✅ Asignación eliminada exitosamente' });
      await loadData();
    } catch (error) {
      console.error('Error eliminando asignación:', error);
      setMessage({ type: 'error', text: 'Error al eliminar: ' + error.message });
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      curso_ids: []
    });
  };

  const handleProfesorChange = (e) => {
    setFormData(prev => ({
      ...prev,
      user_id: e.target.value
    }));
  };

  const handleCursoToggle = (cursoId) => {
    setFormData(prev => {
      const yaSeleccionado = prev.curso_ids.includes(cursoId);
      return {
        ...prev,
        curso_ids: yaSeleccionado
          ? prev.curso_ids.filter(id => id !== cursoId)
          : [...prev.curso_ids, cursoId]
      };
    });
  };

  const seleccionarTodos = () => {
    setFormData(prev => ({
      ...prev,
      curso_ids: cursos.map(c => c.id)
    }));
  };

  const deseleccionarTodos = () => {
    setFormData(prev => ({
      ...prev,
      curso_ids: []
    }));
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
          margin: '0 auto',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Cargando asignaciones...</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #667eea', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>👨‍🏫 Asignación de Cursos</h1>
          <p style={{ color: '#666', margin: 0 }}>Asigna múltiples cursos a profesores en una sola operación</p>
        </div>
        <button
          onClick={() => { setShowModal(true); resetForm(); }}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          ➕ Nueva Asignación
        </button>
      </div>

      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message.text}
        </div>
      )}

      {asignaciones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📚</p>
          <p style={{ fontSize: '1.2rem', margin: 0 }}>No hay asignaciones registradas</p>
          <p style={{ margin: '0.5rem 0 0 0' }}>Crea la primera asignación haciendo clic en "Nueva Asignación"</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Profesor</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Asignatura</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Grupo</th>
              <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map(asignacion => (
              <tr key={asignacion.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{asignacion.profesor?.nombre_completo || 'Sin profesor'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{asignacion.profesor?.email}</div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  {asignacion.curso?.asignatura?.nombre || 'Sin asignatura'}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    background: '#e3f2fd',
                    color: '#1976d2'
                  }}>
                    {asignacion.curso?.grupo?.nombre || 'Sin grupo'}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <button
                    onClick={() => handleDelete(asignacion.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    🗑️ Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '10px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#667eea' }}>➕ Nueva Asignación Múltiple</h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Profesor *
                </label>
                <select
                  value={formData.user_id}
                  onChange={handleProfesorChange}
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
                  <option value="">Selecciona un profesor</option>
                  {profesores.map(profesor => (
                    <option key={profesor.id} value={profesor.id}>
                      {profesor.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: '600' }}>
                    Cursos * ({formData.curso_ids.length} seleccionados)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={seleccionarTodos}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}
                    >
                      ✅ Todos
                    </button>
                    <button
                      type="button"
                      onClick={deseleccionarTodos}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}
                    >
                      ❌ Ninguno
                    </button>
                  </div>
                </div>
                
                <div style={{
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  padding: '0.5rem'
                }}>
                  {cursos.map(curso => (
                    <label
                      key={curso.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem',
                        margin: '0.25rem 0',
                        background: formData.curso_ids.includes(curso.id) ? '#e7f3ff' : 'white',
                        border: `2px solid ${formData.curso_ids.includes(curso.id) ? '#667eea' : '#e1e8ed'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        if (!formData.curso_ids.includes(curso.id)) {
                          e.currentTarget.style.background = '#f8f9fa';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!formData.curso_ids.includes(curso.id)) {
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.curso_ids.includes(curso.id)}
                        onChange={() => handleCursoToggle(curso.id)}
                        style={{
                          marginRight: '0.75rem',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontWeight: '500' }}>{curso.nombre_completo}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', borderTop: '2px solid #f0f0f0', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: saving ? '#999' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {saving ? '💾 Guardando...' : `💾 Asignar ${formData.curso_ids.length} Curso(s)`}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Asignaciones;