import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function Plantillas() {
  const { userProfile } = useAuth();
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlantillaModal, setShowPlantillaModal] = useState(false);
  const [showCriteriosModal, setShowCriteriosModal] = useState(false);
  const [showAplicarModal, setShowAplicarModal] = useState(false);
  const [selectedPlantilla, setSelectedPlantilla] = useState(null);
  const [criterios, setCriterios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [plantillaForm, setPlantillaForm] = useState({
    nombre: '',
    descripcion: ''
  });

  const [criterioForm, setCriterioForm] = useState({
    nombre_criterio: '',
    competencia_grupo: 'C1',
    valor_maximo: 10
  });

  const [cursosSeleccionados, setCursosSeleccionados] = useState([]);

  useEffect(() => {
    loadPlantillas();
  }, []);

  const loadPlantillas = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('plantillas_criterios')
        .select('*')
        .order('created_at', { ascending: false });

      // Si es profesor, solo ver sus plantillas y las del admin
      if (userProfile?.rol === 'Profesor') {
        query = query.or(`creado_por.eq.${userProfile.id},creado_por.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setPlantillas(data || []);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al cargar plantillas' });
    } finally {
      setLoading(false);
    }
  };

  const loadCriterios = async (plantillaId) => {
    try {
      const { data, error } = await supabase
        .from('plantillas_criterios_detalle')
        .select('*')
        .eq('plantilla_id', plantillaId)
        .order('orden');

      if (error) throw error;
      setCriterios(data || []);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al cargar criterios' });
    }
  };

  const loadCursos = async () => {
    try {
      let query = supabase
        .from('cursos')
        .select(`
          *,
          grupos (nivel, grado, seccion),
          asignaturas (nombre)
        `);

      // Si es profesor, solo sus cursos
      if (userProfile?.rol === 'Profesor') {
        const { data: asignaciones } = await supabase
          .from('asignaciones')
          .select('curso_id')
          .eq('user_id', userProfile.id);
        
        const cursosIds = asignaciones?.map(a => a.curso_id) || [];
        query = query.in('id', cursosIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setCursos(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // CREAR PLANTILLA
  const handleCreatePlantilla = () => {
    setPlantillaForm({ nombre: '', descripcion: '' });
    setShowPlantillaModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleSavePlantilla = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('plantillas_criterios')
        .insert({
          nombre: plantillaForm.nombre,
          descripcion: plantillaForm.descripcion,
          creado_por: userProfile.id
        });

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Plantilla creada' });
      await loadPlantillas();
      setShowPlantillaModal(false);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // GESTIONAR CRITERIOS
  const handleGestionarCriterios = async (plantilla) => {
    setSelectedPlantilla(plantilla);
    await loadCriterios(plantilla.id);
    setCriterioForm({ nombre_criterio: '', competencia_grupo: 'C1', valor_maximo: 10 });
    setShowCriteriosModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleAddCriterio = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Obtener el orden máximo actual
      const { data: maxOrden } = await supabase
        .from('plantillas_criterios_detalle')
        .select('orden')
        .eq('plantilla_id', selectedPlantilla.id)
        .order('orden', { ascending: false })
        .limit(1);

      const nuevoOrden = maxOrden && maxOrden.length > 0 ? maxOrden[0].orden + 1 : 1;

      const { error } = await supabase
        .from('plantillas_criterios_detalle')
        .insert({
          plantilla_id: selectedPlantilla.id,
          nombre_criterio: criterioForm.nombre_criterio,
          competencia_grupo: criterioForm.competencia_grupo,
          valor_maximo: parseInt(criterioForm.valor_maximo),
          orden: nuevoOrden
        });

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Criterio agregado' });
      await loadCriterios(selectedPlantilla.id);
      setCriterioForm({ nombre_criterio: '', competencia_grupo: 'C1', valor_maximo: 10 });
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCriterio = async (criterioId) => {
    if (!confirm('¿Eliminar este criterio?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('plantillas_criterios_detalle')
        .delete()
        .eq('id', criterioId);

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Criterio eliminado' });
      await loadCriterios(selectedPlantilla.id);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // APLICAR PLANTILLA
  const handleAplicarPlantilla = async (plantilla) => {
    setSelectedPlantilla(plantilla);
    await loadCriterios(plantilla.id);
    await loadCursos();
    setCursosSeleccionados([]);
    setShowAplicarModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleConfirmarAplicar = async () => {
    if (cursosSeleccionados.length === 0) {
      setMessage({ type: 'error', text: '❌ Seleccione al menos un curso' });
      return;
    }

    if (criterios.length === 0) {
      setMessage({ type: 'error', text: '❌ La plantilla no tiene criterios' });
      return;
    }

    try {
      setLoading(true);
      
      // Por cada curso seleccionado
      for (const cursoId of cursosSeleccionados) {
        // Crear una unidad con el nombre de la plantilla
        const { data: unidad, error: unidadError } = await supabase
          .from('unidades')
          .insert({
            curso_id: cursoId,
            nombre: selectedPlantilla.nombre
          })
          .select()
          .single();

        if (unidadError) throw unidadError;

        // Copiar todos los criterios a esa unidad
        const criteriosParaInsertar = criterios.map(c => ({
          unidad_id: unidad.id,
          competencia_grupo: c.competencia_grupo,
          nombre: c.nombre_criterio,
          valor_maximo: c.valor_maximo
        }));

        const { error: criteriosError } = await supabase
          .from('criterios')
          .insert(criteriosParaInsertar);

        if (criteriosError) throw criteriosError;
      }
      
      setMessage({ 
        type: 'success', 
        text: `✅ Plantilla aplicada a ${cursosSeleccionados.length} curso(s)` 
      });
      setShowAplicarModal(false);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // ELIMINAR PLANTILLA
  const handleDeletePlantilla = async (plantilla) => {
    if (!confirm(`¿Eliminar la plantilla "${plantilla.nombre}"?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('plantillas_criterios')
        .delete()
        .eq('id', plantilla.id);

      if (error) throw error;
      
      setMessage({ type: 'success', text: '✅ Plantilla eliminada' });
      await loadPlantillas();
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading && plantillas.length === 0) {
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
        <p>Cargando plantillas...</p>
      </div>
    );
  }

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
          📋 Plantillas de Criterios
        </h1>
        <p style={{ color: '#666', margin: 0 }}>
          Crea bloques reutilizables de criterios de evaluación
        </p>
      </div>

      {/* Info */}
      <div style={{ 
        background: '#e3f2fd', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem',
        border: '1px solid #90caf9'
      }}>
        <p style={{ margin: 0, color: '#1976d2' }}>
          💡 <strong>Las plantillas</strong> te permiten crear una vez y aplicar a múltiples cursos. 
          Ejemplo: "Evaluación Estándar" con 4 criterios → Aplicar a 10 cursos diferentes.
        </p>
      </div>

      {/* Botón crear */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={handleCreatePlantilla}
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
          ➕ Nueva Plantilla
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

      {/* Grid de plantillas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '1.5rem'
      }}>
        {plantillas.length === 0 ? (
          <div style={{ 
            gridColumn: '1 / -1',
            padding: '3rem', 
            textAlign: 'center', 
            color: '#999' 
          }}>
            No hay plantillas creadas. Haz clic en "Nueva Plantilla" para comenzar.
          </div>
        ) : (
          plantillas.map((plantilla) => (
            <div
              key={plantilla.id}
              style={{
                border: '2px solid #e1e8ed',
                borderRadius: '12px',
                padding: '1.5rem',
                transition: 'all 0.3s'
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                  {plantilla.nombre}
                </h3>
                {plantilla.descripcion && (
                  <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                    {plantilla.descripcion}
                  </p>
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    background: plantilla.creado_por ? '#e3f2fd' : '#f3e5f5',
                    color: plantilla.creado_por ? '#1976d2' : '#7b1fa2'
                  }}>
                    {plantilla.creado_por ? 'Personal' : 'Sistema'}
                  </span>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <button
                  onClick={() => handleGestionarCriterios(plantilla)}
                  style={{
                    padding: '0.75rem',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  📝 Gestionar Criterios
                </button>
                <button
                  onClick={() => handleAplicarPlantilla(plantilla)}
                  style={{
                    padding: '0.75rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  ✅ Aplicar a Cursos
                </button>
                <button
                  onClick={() => handleDeletePlantilla(plantilla)}
                  style={{
                    padding: '0.75rem',
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
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Crear Plantilla */}
      {showPlantillaModal && (
        <Modal onClose={() => setShowPlantillaModal(false)}>
          <h2 style={{ marginBottom: '1.5rem' }}>➕ Nueva Plantilla</h2>
          <form onSubmit={handleSavePlantilla}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Nombre de la Plantilla *
              </label>
              <input
                type="text"
                value={plantillaForm.nombre}
                onChange={(e) => setPlantillaForm({ ...plantillaForm, nombre: e.target.value })}
                required
                placeholder="Ej: Evaluación Estándar"
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
                Descripción (opcional)
              </label>
              <textarea
                value={plantillaForm.descripcion}
                onChange={(e) => setPlantillaForm({ ...plantillaForm, descripcion: e.target.value })}
                rows="3"
                placeholder="Breve descripción de la plantilla"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowPlantillaModal(false)}
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
                Crear
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Gestionar Criterios */}
      {showCriteriosModal && selectedPlantilla && (
        <Modal onClose={() => setShowCriteriosModal(false)} large>
          <h2 style={{ marginBottom: '1rem' }}>
            📝 Criterios de: {selectedPlantilla.nombre}
          </h2>
          
          {/* Formulario para agregar criterio */}
          <form onSubmit={handleAddCriterio} style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Agregar Criterio</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                  Nombre del Criterio
                </label>
                <input
                  type="text"
                  value={criterioForm.nombre_criterio}
                  onChange={(e) => setCriterioForm({ ...criterioForm, nombre_criterio: e.target.value })}
                  required
                  placeholder="Ej: Examen escrito"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                  Competencia
                </label>
                <select
                  value={criterioForm.competencia_grupo}
                  onChange={(e) => setCriterioForm({ ...criterioForm, competencia_grupo: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                  <option value="C3">C3</option>
                  <option value="C4">C4</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '600' }}>
                  Valor Máx.
                </label>
                <input
                  type="number"
                  value={criterioForm.valor_maximo}
                  onChange={(e) => setCriterioForm({ ...criterioForm, valor_maximo: e.target.value })}
                  required
                  min="1"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '6px',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                ➕
              </button>
            </div>
          </form>

          {/* Lista de criterios */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>
              Criterios ({criterios.length})
            </h3>
            {criterios.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
                No hay criterios. Agrega algunos usando el formulario de arriba.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Criterio</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>Comp.</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>Valor</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {criterios.map((criterio) => (
                    <tr key={criterio.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '0.75rem' }}>{criterio.nombre_criterio}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          background: '#e3f2fd',
                          color: '#1976d2',
                          fontWeight: '600'
                        }}>
                          {criterio.competencia_grupo}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {criterio.valor_maximo} pts
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteCriterio(criterio.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <button
              onClick={() => setShowCriteriosModal(false)}
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
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Aplicar a Cursos */}
      {showAplicarModal && selectedPlantilla && (
        <Modal onClose={() => setShowAplicarModal(false)} large>
          <h2 style={{ marginBottom: '1rem' }}>
            ✅ Aplicar: {selectedPlantilla.nombre}
          </h2>

          <div style={{ 
            background: '#fff3cd', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid #ffc107'
          }}>
            <p style={{ margin: 0, color: '#856404' }}>
              ℹ️ Se creará una <strong>unidad</strong> con el nombre de la plantilla en cada curso seleccionado, 
              y se copiarán todos los <strong>{criterios.length} criterios</strong>.
            </p>
          </div>

          {/* Selección de cursos */}
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>
              Selecciona los cursos donde aplicar la plantilla:
            </h3>
            {cursos.length === 0 ? (
              <p style={{ color: '#999', padding: '1rem', textAlign: 'center' }}>
                No hay cursos disponibles
              </p>
            ) : (
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto',
                border: '2px solid #e1e8ed',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                {cursos.map((curso) => (
                  <div key={curso.id} style={{ marginBottom: '0.5rem' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.5rem',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={cursosSeleccionados.includes(curso.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCursosSeleccionados([...cursosSeleccionados, curso.id]);
                          } else {
                            setCursosSeleccionados(cursosSeleccionados.filter(id => id !== curso.id));
                          }
                          }}
                        style={{ marginRight: '0.75rem' }}
                      />
                      <span style={{ fontWeight: '600' }}>
                        {curso.asignaturas.nombre}
                      </span>
                      <span style={{ margin: '0 0.5rem', color: '#999' }}>•</span>
                      <span>
                        {curso.grupos.grado}° {curso.grupos.seccion} ({curso.grupos.nivel})
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen */}
          <div style={{
            background: '#e3f2fd',
            padding: '1rem',
            borderRadius: '8px',
            marginTop: '1.5rem'
          }}>
            <p style={{ margin: 0, color: '#1976d2' }}>
              <strong>Resumen:</strong> Se aplicarán {criterios.length} criterios a {cursosSeleccionados.length} curso(s) seleccionado(s)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAplicarModal(false)}
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
              onClick={handleConfirmarAplicar}
              disabled={loading || cursosSeleccionados.length === 0}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: loading || cursosSeleccionados.length === 0 ? '#999' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || cursosSeleccionados.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {loading ? 'Aplicando...' : '✅ Aplicar Plantilla'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Componente Modal mejorado con opción de tamaño
function Modal({ onClose, children, large = false }) {
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
        maxWidth: large ? '800px' : '500px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {children}
      </div>
    </div>
  );
}

export default Plantillas;