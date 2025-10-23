import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function Observaciones() {
  const { userProfile } = useAuth();
  
  const [cursos, setCursos] = useState([]);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [selectedPeriodo, setSelectedPeriodo] = useState('1er Trimestre');
  const [estudiantes, setEstudiantes] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingComentario, setEditingComentario] = useState(null);
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const periodos = ['1er Trimestre', '2do Trimestre', '3er Trimestre', 'Anual'];

  useEffect(() => {
    loadCursos();
  }, [userProfile]);

  useEffect(() => {
    if (selectedCurso) {
      loadEstudiantes();
      loadComentarios();
    }
  }, [selectedCurso, selectedPeriodo]);

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

  const loadComentarios = async () => {
    try {
      const { data, error } = await supabase.from('comentarios').select('*').eq('curso_id', selectedCurso).eq('periodo', selectedPeriodo);
      if (error) throw error;
      setComentarios(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getComentario = (estudianteId) => {
    return comentarios.find(c => c.estudiante_id === estudianteId);
  };

  const handleEditarComentario = (estudiante) => {
    const comentarioExistente = getComentario(estudiante.id);
    setEditingComentario(estudiante);
    setComentarioTexto(comentarioExistente?.texto || '');
    setMessage({ type: '', text: '' });
  };

  const handleCancelar = () => {
    setEditingComentario(null);
    setComentarioTexto('');
  };

  const handleGuardarComentario = async (estudiante) => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });
      const comentarioExistente = getComentario(estudiante.id);

      if (comentarioExistente) {
        if (comentarioTexto.trim() === '') {
          const { error } = await supabase.from('comentarios').delete().eq('id', comentarioExistente.id);
          if (error) throw error;
          setMessage({ type: 'success', text: '✅ Comentario eliminado' });
        } else {
          const { error } = await supabase.from('comentarios').update({ texto: comentarioTexto.trim(), updated_at: new Date().toISOString() }).eq('id', comentarioExistente.id);
          if (error) throw error;
          setMessage({ type: 'success', text: '✅ Comentario actualizado' });
        }
      } else {
        if (comentarioTexto.trim() !== '') {
          const { error } = await supabase.from('comentarios').insert({ curso_id: selectedCurso, estudiante_id: estudiante.id, periodo: selectedPeriodo, texto: comentarioTexto.trim() });
          if (error) throw error;
          setMessage({ type: 'success', text: '✅ Comentario guardado' });
        }
      }

      await loadComentarios();
      setEditingComentario(null);
      setComentarioTexto('');
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ Error al guardar: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarComentario = async (estudiante) => {
    const comentarioExistente = getComentario(estudiante.id);
    if (!comentarioExistente) return;
    if (!confirm(`¿Eliminar el comentario de ${estudiante.nombres} ${estudiante.apellidos}?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('comentarios').delete().eq('id', comentarioExistente.id);
      if (error) throw error;
      setMessage({ type: 'success', text: '✅ Comentario eliminado' });
      await loadComentarios();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ Error al eliminar' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && cursos.length === 0) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #667eea', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }}></div><p>Cargando...</p></div>;
  }

  const cursoSeleccionado = cursos.find(c => c.id === selectedCurso);

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '2rem', borderBottom: '2px solid #667eea', paddingBottom: '1rem' }}>
        <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>💬 Comentarios y Observaciones</h1>
        <p style={{ color: '#666', margin: 0 }}>Registra observaciones cualitativas sobre el desempeño de cada estudiante</p>
      </div>

      {message.text && (
        <div style={{ padding: '1rem', borderRadius: '8px', marginBottom: '1rem', background: message.type === 'success' ? '#d4edda' : '#f8d7da', color: message.type === 'success' ? '#155724' : '#721c24', border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}` }}>
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '1.1rem' }}>📚 Seleccionar Curso</label>
        {cursos.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
            <p style={{ margin: 0, color: '#856404' }}>{userProfile?.rol === 'Profesor' ? 'No tienes cursos asignados.' : 'No hay cursos creados.'}</p>
          </div>
        ) : (
          <select value={selectedCurso} onChange={(e) => setSelectedCurso(e.target.value)} style={{ width: '100%', maxWidth: '500px', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
            <option value="">-- Seleccione un curso --</option>
            {cursos.map(curso => <option key={curso.id} value={curso.id}>{curso.asignaturas.nombre} - {curso.grupos.grado}° {curso.grupos.seccion} ({curso.grupos.nivel})</option>)}
          </select>
        )}
      </div>

      {selectedCurso && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '1.1rem' }}>📅 Período Académico</label>
          <select value={selectedPeriodo} onChange={(e) => setSelectedPeriodo(e.target.value)} style={{ width: '100%', maxWidth: '300px', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
            {periodos.map(periodo => <option key={periodo} value={periodo}>{periodo}</option>)}
          </select>
        </div>
      )}

      {selectedCurso && cursoSeleccionado && (
        <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div><strong>Curso:</strong> {cursoSeleccionado.asignaturas.nombre} - {cursoSeleccionado.grupos.grado}° {cursoSeleccionado.grupos.seccion}</div>
          <div><strong>Período:</strong> {selectedPeriodo}</div>
          <div><strong>Estudiantes:</strong> {estudiantes.length}</div>
        </div>
      )}

      {selectedCurso && estudiantes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {estudiantes.map(estudiante => {
            const comentarioExistente = getComentario(estudiante.id);
            const isEditing = editingComentario?.id === estudiante.id;
            return (
              <div key={estudiante.id} style={{ border: '2px solid #e1e8ed', borderRadius: '10px', padding: '1.5rem', background: comentarioExistente ? '#f8f9fa' : 'white' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#333' }}>{estudiante.num_orden}. {estudiante.nombres} {estudiante.apellidos}</h3>
                  {comentarioExistente && !isEditing && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleEditarComentario(estudiante)} style={{ padding: '0.5rem 1rem', background: '#ffc107', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>✏️ Editar</button>
                      <button onClick={() => handleEliminarComentario(estudiante)} style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>🗑️</button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea value={comentarioTexto} onChange={(e) => setComentarioTexto(e.target.value)} placeholder="Escribe tus observaciones..." rows="4" style={{ width: '100%', padding: '0.75rem', border: '2px solid #667eea', borderRadius: '8px', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                      <button onClick={handleCancelar} style={{ padding: '0.75rem 1.5rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
                      <button onClick={() => handleGuardarComentario(estudiante)} disabled={loading} style={{ padding: '0.75rem 1.5rem', background: loading ? '#999' : '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600' }}>{loading ? 'Guardando...' : '💾 Guardar'}</button>
                    </div>
                  </div>
                ) : comentarioExistente ? (
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{comentarioExistente.texto}</p>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>Última actualización: {new Date(comentarioExistente.updated_at || comentarioExistente.created_at).toLocaleString('es-DO')}</div>
                  </div>
                ) : (
                  <button onClick={() => handleEditarComentario(estudiante)} style={{ width: '100%', padding: '1rem', background: '#e3f2fd', color: '#1976d2', border: '2px dashed #90caf9', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600' }}>➕ Agregar comentario para este estudiante</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedCurso && estudiantes.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
          <p style={{ margin: 0, color: '#856404', fontSize: '1.1rem' }}>🎓 No hay estudiantes en este grupo.</p>
        </div>
      )}
    </div>
  );
}

export default Observaciones;