import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function Estructura() {
  const [activeTab, setActiveTab] = useState('grupos');
  
  return (
    <div style={{
      background: 'white',
      padding: '2rem',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
          🏫 Estructura Académica
        </h1>
        <p style={{ color: '#666', margin: 0 }}>
          Gestiona grupos, asignaturas, cursos y estudiantes
        </p>
      </div>

      {/* Tabs */}
      <div style={{ 
        borderBottom: '2px solid #e1e8ed',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <TabButton 
            active={activeTab === 'grupos'} 
            onClick={() => setActiveTab('grupos')}
            icon="👥"
          >
            Grupos
          </TabButton>
          <TabButton 
            active={activeTab === 'asignaturas'} 
            onClick={() => setActiveTab('asignaturas')}
            icon="📚"
          >
            Asignaturas
          </TabButton>
          <TabButton 
            active={activeTab === 'cursos'} 
            onClick={() => setActiveTab('cursos')}
            icon="🔗"
          >
            Cursos
          </TabButton>
          <TabButton 
            active={activeTab === 'estudiantes'} 
            onClick={() => setActiveTab('estudiantes')}
            icon="🎓"
          >
            Estudiantes
          </TabButton>
        </div>
      </div>

      {/* Contenido de las tabs */}
      {activeTab === 'grupos' && <GruposTab />}
      {activeTab === 'asignaturas' && <AsignaturasTab />}
      {activeTab === 'cursos' && <CursosTab />}
      {activeTab === 'estudiantes' && <EstudiantesTab />}
    </div>
  );
}

// Componente auxiliar para los botones de tabs
function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.75rem 1.5rem',
        border: 'none',
        borderBottom: active ? '3px solid #667eea' : '3px solid transparent',
        background: active ? '#f8f9fa' : 'transparent',
        color: active ? '#667eea' : '#666',
        fontWeight: active ? '600' : '400',
        cursor: 'pointer',
        fontSize: '1rem',
        transition: 'all 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}
    >
      <span>{icon}</span>
      {children}
    </button>
  );
}

// ============================================
// TAB 1: GRUPOS
// ============================================
function GruposTab() {
  const [grupos, setGrupos] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    nivel: 'Primario',
    grado: '',
    seccion: '',
    moderador_user_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
// Cargar grupos
      const { data: gruposData, error: gruposError } = await supabase
        .from('grupos')
        .select('*')
        .order('nivel', { ascending: true })
        .order('grado', { ascending: true })
        .order('seccion', { ascending: true });

      if (gruposError) throw gruposError;
 // ...existing code...

      // Cargar profesores para el selector
      const { data: profesoresData, error: profesoresError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('rol', 'Profesor')
        .order('nombre_completo');

      if (profesoresError) throw profesoresError;

      setGrupos(gruposData || []);
      setProfesores(profesoresData || []);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingGrupo(null);
    setFormData({
      nivel: 'Primario',
      grado: '',
      seccion: '',
      moderador_user_id: ''
    });
    setShowModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleEdit = (grupo) => {
    setEditingGrupo(grupo);
    setFormData({
      nivel: grupo.nivel,
      grado: grupo.grado,
      seccion: grupo.seccion,
      moderador_user_id: grupo.moderador_user_id || ''
    });
    setShowModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      if (editingGrupo) {
        // Actualizar
        const { error } = await supabase
          .from('grupos')
          .update({
            nivel: formData.nivel,
            grado: formData.grado,
            seccion: formData.seccion,
            moderador_user_id: formData.moderador_user_id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingGrupo.id);

        if (error) throw error;
        setMessage({ type: 'success', text: '✅ Grupo actualizado' });
      } else {
        // Crear
        const { error } = await supabase
          .from('grupos')
          .insert({
            nivel: formData.nivel,
            grado: formData.grado,
            seccion: formData.seccion,
            moderador_user_id: formData.moderador_user_id || null
          });

        if (error) throw error;
        setMessage({ type: 'success', text: '✅ Grupo creado' });
      }

      await loadData();
      setShowModal(false);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (grupo) => {
    if (!confirm(`¿Eliminar ${grupo.grado}° ${grupo.seccion} (${grupo.nivel})?`)) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('grupos')
        .delete()
        .eq('id', grupo.id);

      if (error) throw error;
      setMessage({ type: 'success', text: '✅ Grupo eliminado' });
      await loadData();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading && grupos.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div>
      {/* Botón crear */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={handleCreate}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          ➕ Nuevo Grupo
        </button>
      </div>

      {/* Mensajes */}
      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24'
        }}>
          {message.text}
        </div>
      )}

      {/* Tabla */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '1rem', textAlign: 'left' }}>Nivel</th>
            <th style={{ padding: '1rem', textAlign: 'left' }}>Grado</th>
            <th style={{ padding: '1rem', textAlign: 'left' }}>Sección</th>
            <th style={{ padding: '1rem', textAlign: 'left' }}>Moderador</th>
            <th style={{ padding: '1rem', textAlign: 'center', width: '200px' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => {
            const moderador = profesores.find(p => p.id === grupo.moderador_user_id);
            return (
              <tr key={grupo.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '1rem' }}>{grupo.nivel}</td>
                <td style={{ padding: '1rem' }}>{grupo.grado}°</td>
                <td style={{ padding: '1rem' }}>{grupo.seccion}</td>
                <td style={{ padding: '1rem', color: '#666' }}>
                  {moderador ? moderador.nombre_completo : <em>Sin asignar</em>}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleEdit(grupo)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#ffc107',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(grupo)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ marginBottom: '1.5rem' }}>
            {editingGrupo ? '✏️ Editar Grupo' : '➕ Nuevo Grupo'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Nivel *
              </label>
              <select
                value={formData.nivel}
                onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="Primario">Primario</option>
                <option value="Secundario">Secundario</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Grado *
              </label>
              <input
                type="text"
                value={formData.grado}
                onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                required
                placeholder="Ej: 4to"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Sección *
              </label>
              <input
                type="text"
                value={formData.seccion}
                onChange={(e) => setFormData({ ...formData, seccion: e.target.value })}
                required
                placeholder="Ej: A"
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
                Moderador (opcional)
              </label>
              <select
                value={formData.moderador_user_id}
                onChange={(e) => setFormData({ ...formData, moderador_user_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Sin moderador</option>
                {profesores.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.nombre_completo}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ============================================
// TAB 2: ASIGNATURAS
// ============================================
function AsignaturasTab() {
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAsignatura, setEditingAsignatura] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    loadAsignaturas();
  }, []);

  const loadAsignaturas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('asignaturas')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setAsignaturas(data || []);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al cargar asignaturas' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAsignatura(null);
    setNombre('');
    setShowModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleEdit = (asignatura) => {
    setEditingAsignatura(asignatura);
    setNombre(asignatura.nombre);
    setShowModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      if (editingAsignatura) {
        const { error } = await supabase
          .from('asignaturas')
          .update({ nombre, updated_at: new Date().toISOString() })
          .eq('id', editingAsignatura.id);

        if (error) throw error;
        setMessage({ type: 'success', text: '✅ Asignatura actualizada' });
      } else {
        const { error } = await supabase
          .from('asignaturas')
          .insert({ nombre });

        if (error) throw error;
        setMessage({ type: 'success', text: '✅ Asignatura creada' });
      }

      await loadAsignaturas();
      setShowModal(false);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (asignatura) => {
    if (!confirm(`¿Eliminar ${asignatura.nombre}?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('asignaturas')
        .delete()
        .eq('id', asignatura.id);

      if (error) throw error;
      setMessage({ type: 'success', text: '✅ Asignatura eliminada' });
      await loadAsignaturas();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading && asignaturas.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={handleCreate}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          ➕ Nueva Asignatura
        </button>
      </div>

      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24'
        }}>
          {message.text}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '1rem', textAlign: 'left' }}>Nombre de la Asignatura</th>
            <th style={{ padding: '1rem', textAlign: 'center', width: '200px' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {asignaturas.map((asignatura) => (
            <tr key={asignatura.id} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={{ padding: '1rem' }}>{asignatura.nombre}</td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleEdit(asignatura)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ffc107',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(asignatura)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ marginBottom: '1.5rem' }}>
            {editingAsignatura ? '✏️ Editar Asignatura' : '➕ Nueva Asignatura'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Nombre de la Asignatura *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ej: Matemáticas"
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
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ============================================
// Componente auxiliar: Modal reutilizable
// ============================================
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
      zIndex: 1000
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

// ============================================
// TAB 3: CURSOS (Relación Grupo-Asignatura)
// ============================================
function CursosTab() {
  const [cursos, setCursos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCurso, setEditingCurso] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    grupo_id: '',
    asignatura_ids: [] // Array para selección múltiple
  });

  useEffect(() => {
    loadData();
  }, []);

// ...existing code...
  const loadData = async () => {
    try {
      setLoading(true);

      const { data: cursosData, error: cursosError } = await supabase
        .from('cursos')
        .select('*')
        .order('created_at', { ascending: false });

      if (cursosError) throw cursosError;

      // Cargar grupos
const { data: gruposData, error: gruposError } = await supabase
  .from('grupos')
  .select('*')
  .order('nivel, grado, seccion');

      if (gruposError) throw gruposError;

      // Cargar asignaturas
      const { data: asignaturasData, error: asignaturasError } = await supabase
        .from('asignaturas')
        .select('*')
        .order('nombre');

      if (asignaturasError) throw asignaturasError;

      // Combinar datos y generar nombre del grupo
      const cursosConInfo = (cursosData || []).map(curso => {
        const grupo = (gruposData || []).find(g => g.id === curso.grupo_id) || null;
        const asignatura = (asignaturasData || []).find(a => a.id === curso.asignatura_id) || null;
        if (grupo) {
          grupo.nombre = `${grupo.nivel} ${grupo.grado}${grupo.seccion}`;
        }
        return { ...curso, grupo, asignatura };
      });

      setCursos(cursosConInfo);
const gruposConNombre = (gruposData || []).map(g => ({
  ...g,
  nombre: `${g.nivel} ${g.grado}${g.seccion}`
}));

setGrupos(gruposConNombre);
setAsignaturas(asignaturasData || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setMessage({ type: 'error', text: 'Error al cargar: ' + (error.message || error) });
    } finally {
      setLoading(false);
    }
  };
// ...existing code...

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.asignatura_ids.length === 0) {
      setError('⚠️ Debes seleccionar al menos una asignatura');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (editingCurso) {
        // EDITAR (un solo curso)
        const { error } = await supabase
          .from('cursos')
          .update({
            grupo_id: formData.grupo_id,
            asignatura_id: formData.asignatura_ids[0]
          })
          .eq('id', editingCurso.id);

        if (error) throw error;

        setMessage({ type: 'success', text: '✅ Curso actualizado exitosamente' });
      } else {
        // CREAR MÚLTIPLES CURSOS
        const { data: existentes } = await supabase
          .from('cursos')
          .select('asignatura_id')
          .eq('grupo_id', formData.grupo_id)
          .in('asignatura_id', formData.asignatura_ids);

        const asignaturasExistentes = existentes?.map(e => e.asignatura_id) || [];
        const asignaturasNuevas = formData.asignatura_ids.filter(id => !asignaturasExistentes.includes(id));

        if (asignaturasNuevas.length === 0) {
          setError('⚠️ Todos los cursos ya existen para este grupo');
          setSaving(false);
          return;
        }

        const cursosNuevos = asignaturasNuevas.map(asignatura_id => ({
          grupo_id: formData.grupo_id,
          asignatura_id
        }));

        const { error } = await supabase
          .from('cursos')
          .insert(cursosNuevos);

        if (error) throw error;

        const mensaje = asignaturasExistentes.length > 0
          ? `✅ ${asignaturasNuevas.length} curso(s) creado(s). ${asignaturasExistentes.length} ya existía(n).`
          : `✅ ${asignaturasNuevas.length} curso(s) creado(s) exitosamente`;

        setMessage({ type: 'success', text: mensaje });
      }

      setShowModal(false);
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error guardando curso:', error);
      setError('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (curso) => {
    setEditingCurso(curso);
    setFormData({
      grupo_id: curso.grupo_id,
      asignatura_ids: [curso.asignatura_id]
    });
    setShowModal(true);
    setError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este curso?')) return;

    try {
      const { error } = await supabase
        .from('cursos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: '✅ Curso eliminado exitosamente' });
      await loadData();
    } catch (error) {
      console.error('Error eliminando curso:', error);
      setMessage({ type: 'error', text: 'Error al eliminar: ' + error.message });
    }
  };

  const resetForm = () => {
    setFormData({
      grupo_id: '',
      asignatura_ids: []
    });
    setEditingCurso(null);
    setError('');
  };

  const handleAsignaturaToggle = (asignaturaId) => {
    setFormData(prev => {
      const yaSeleccionada = prev.asignatura_ids.includes(asignaturaId);
      return {
        ...prev,
        asignatura_ids: yaSeleccionada
          ? prev.asignatura_ids.filter(id => id !== asignaturaId)
          : [...prev.asignatura_ids, asignaturaId]
      };
    });
  };

  const seleccionarTodas = () => {
    setFormData(prev => ({
      ...prev,
      asignatura_ids: asignaturas.map(a => a.id)
    }));
  };

  const deseleccionarTodas = () => {
    setFormData(prev => ({
      ...prev,
      asignatura_ids: []
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
        <p>Cargando cursos...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>🔗 Cursos (Grupo + Asignatura)</h2>
        <button
          onClick={() => { setShowModal(true); resetForm(); }}
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
          ➕ Nuevo Curso
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

      {cursos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>🔗</p>
          <p style={{ fontSize: '1.2rem', margin: 0 }}>No hay cursos registrados</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Grupo</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Asignatura</th>
              <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cursos.map(curso => (
              <tr key={curso.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '1rem' }}>{curso.grupo?.nombre}</td>
                <td style={{ padding: '1rem' }}>{curso.asignatura?.nombre}</td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <button
                    onClick={() => handleEdit(curso)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ffc107',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      marginRight: '0.5rem',
                      fontWeight: '600'
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDelete(curso.id)}
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
            <h2 style={{ marginTop: 0, color: '#667eea' }}>
              {editingCurso ? '✏️ Editar Curso' : '➕ Crear Cursos Múltiples'}
            </h2>

            {error && (
              <div style={{
                padding: '1rem',
                background: '#f8d7da',
                color: '#721c24',
                borderRadius: '6px',
                marginBottom: '1rem',
                border: '1px solid #f5c6cb'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Grupo *
                </label>
                <select
                  value={formData.grupo_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, grupo_id: e.target.value }))}
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
                  <option value="">Selecciona un grupo</option>
                  {grupos.map(grupo => (
  <option key={grupo.id} value={grupo.id}>
    {`${grupo.nivel} ${grupo.grado}${grupo.seccion}`}
  </option>
))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: '600' }}>
                    Asignaturas * ({formData.asignatura_ids.length} seleccionadas)
                  </label>
                  {!editingCurso && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={seleccionarTodas}
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
                        ✅ Todas
                      </button>
                      <button
                        type="button"
                        onClick={deseleccionarTodas}
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
                        ❌ Ninguna
                      </button>
                    </div>
                  )}
                </div>
                
                <div style={{
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  padding: '0.5rem'
                }}>
                  {asignaturas.map(asignatura => (
                    <label
                      key={asignatura.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem',
                        margin: '0.25rem 0',
                        background: formData.asignatura_ids.includes(asignatura.id) ? '#e7f3ff' : 'white',
                        border: `2px solid ${formData.asignatura_ids.includes(asignatura.id) ? '#667eea' : '#e1e8ed'}`,
                        borderRadius: '6px',
                        cursor: editingCurso ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.asignatura_ids.includes(asignatura.id)}
                        onChange={() => handleAsignaturaToggle(asignatura.id)}
                        disabled={editingCurso}
                        style={{
                          marginRight: '0.75rem',
                          width: '18px',
                          height: '18px',
                          cursor: editingCurso ? 'not-allowed' : 'pointer'
                        }}
                      />
                      <span style={{ fontWeight: '500' }}>{asignatura.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', borderTop: '2px solid #f0f0f0', paddingTop: '1rem' }}>
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
                  {saving 
                    ? '💾 Guardando...' 
                    : editingCurso 
                      ? '💾 Actualizar' 
                      : `💾 Crear ${formData.asignatura_ids.length} Curso(s)`
                  }
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
// ============================================
// TAB 4: ESTUDIANTES
// ============================================
function EstudiantesTab() {
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    num_orden: '',
    nombres: '',
    apellidos: ''
  });

  useEffect(() => {
    loadGrupos();
  }, []);

  useEffect(() => {
    if (selectedGrupo) {
      loadEstudiantes();
    }
  }, [selectedGrupo]);

  const loadGrupos = async () => {
    try {
      const { data, error } = await supabase
        .from('grupos')
        .select('*')
        .order('nivel', { ascending: true })
        .order('grado', { ascending: true })
        .order('seccion', { ascending: true });

      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadEstudiantes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('grupo_id', selectedGrupo)
        .order('num_orden');

      if (error) throw error;
      setEstudiantes(data || []);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al cargar estudiantes' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({ num_orden: '', nombres: '', apellidos: '' });
    setShowModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedGrupo) {
      setMessage({ type: 'error', text: '❌ Seleccione un grupo primero' });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('estudiantes')
        .insert({
          grupo_id: selectedGrupo,
          num_orden: parseInt(formData.num_orden),
          nombres: formData.nombres,
          apellidos: formData.apellidos
        });

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Estudiante agregado' });
      await loadEstudiantes();
      setShowModal(false);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (estudiante) => {
    if (!confirm(`¿Eliminar a ${estudiante.nombres} ${estudiante.apellidos}?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('estudiantes')
        .delete()
        .eq('id', estudiante.id);

      if (error) throw error;
      setMessage({ type: 'success', text: '✅ Estudiante eliminado' });
      await loadEstudiantes();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!selectedGrupo) {
      setMessage({ type: 'error', text: '❌ Seleccione un grupo primero' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parsear CSV (formato: numOrden,nombres,apellidos)
        const estudiantesData = lines.map(line => {
          const [num_orden, nombres, apellidos] = line.split(',').map(s => s.trim());
          return {
            grupo_id: selectedGrupo,
            num_orden: parseInt(num_orden),
            nombres,
            apellidos
          };
        }).filter(e => e.num_orden && e.nombres && e.apellidos);

        if (estudiantesData.length === 0) {
          setMessage({ type: 'error', text: '❌ El archivo CSV está vacío o tiene formato incorrecto' });
          return;
        }

        setLoading(true);
        const { error } = await supabase
          .from('estudiantes')
          .insert(estudiantesData);

        if (error) throw error;

        setMessage({ 
          type: 'success', 
          text: `✅ ${estudiantesData.length} estudiantes agregados` 
        });
        await loadEstudiantes();
      } catch (error) {
        console.error('Error:', error);
        setMessage({ type: 'error', text: '❌ Error al procesar CSV: ' + error.message });
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const grupoSeleccionado = grupos.find(g => g.id === selectedGrupo);

  return (
    <div>
      <div style={{ 
        background: '#fff3cd', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem',
        border: '1px solid #ffc107'
      }}>
        <p style={{ margin: 0, color: '#856404' }}>
          💡 <strong>Formato CSV:</strong> numOrden,nombres,apellidos (sin encabezado)
          <br />
          Ejemplo: 1,Juan Carlos,Pérez García
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
          Seleccionar Grupo
        </label>
        <select
          value={selectedGrupo}
          onChange={(e) => setSelectedGrupo(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.75rem',
            border: '2px solid #e1e8ed',
            borderRadius: '8px',
            fontSize: '1rem'
          }}
        >
          <option value="">-- Seleccione un grupo --</option>
          {grupos.map((grupo) => (
            <option key={grupo.id} value={grupo.id}>
              {grupo.grado}° {grupo.seccion} ({grupo.nivel})
            </option>
          ))}
        </select>
      </div>

      {selectedGrupo && (
        <>
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleCreate}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ Agregar Estudiante
            </button>
            <label style={{
              padding: '0.75rem 1.5rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-block'
            }}>
              📄 Cargar CSV
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleCSVUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {message.text && (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              background: message.type === 'success' ? '#d4edda' : '#f8d7da',
              color: message.type === 'success' ? '#155724' : '#721c24'
            }}>
              {message.text}
            </div>
          )}

          {loading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>}

          {!loading && (
            <>
              <div style={{ marginBottom: '1rem', color: '#666' }}>
                <strong>Grupo:</strong> {grupoSeleccionado?.grado}° {grupoSeleccionado?.seccion} ({grupoSeleccionado?.nivel})
                {' | '}
                <strong>Total estudiantes:</strong> {estudiantes.length}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '1rem', textAlign: 'center', width: '80px' }}>#</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Nombres</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Apellidos</th>
                    <th style={{ padding: '1rem', textAlign: 'center', width: '150px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {estudiantes.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                        No hay estudiantes en este grupo
                      </td>
                    </tr>
                  ) : (
                    estudiantes.map((estudiante) => (
                      <tr key={estudiante.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>
                          {estudiante.num_orden}
                        </td>
                        <td style={{ padding: '1rem' }}>{estudiante.nombres}</td>
                        <td style={{ padding: '1rem' }}>{estudiante.apellidos}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDelete(estudiante)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ marginBottom: '1.5rem' }}>➕ Agregar Estudiante</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Número de Orden *
              </label>
              <input
                type="number"
                value={formData.num_orden}
                onChange={(e) => setFormData({ ...formData, num_orden: e.target.value })}
                required
                min="1"
                placeholder="Ej: 1"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Nombres *
              </label>
              <input
                type="text"
                value={formData.nombres}
                onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                required
                placeholder="Ej: Juan Carlos"
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
                Apellidos *
              </label>
              <input
                type="text"
                value={formData.apellidos}
                onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                required
                placeholder="Ej: Pérez García"
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
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
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
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Estructura;