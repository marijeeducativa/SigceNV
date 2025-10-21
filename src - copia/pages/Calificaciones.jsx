import { useState, useEffect, useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const Modal = ({ onClose, children }) => (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ background: 'white', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
      {children}
    </div>
  </div>
);

function Calificaciones() {
  const { userProfile } = useAuth();
  const [cursos, setCursos] = useState([]);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [selectedPeriodo, setSelectedPeriodo] = useState('1');
  const [plantillas, setPlantillas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [criterios, setCriterios] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [calificaciones, setCalificaciones] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [tipoCalculo, setTipoCalculo] = useState('promedio');
  const [competencias, setCompetencias] = useState([]);
  const [showAgregarUnidadModal, setShowAgregarUnidadModal] = useState(false);
  const [showAgregarCriterioModal, setShowAgregarCriterioModal] = useState(false);
  const [showCopiarModal, setShowCopiarModal] = useState(false);
  const [showCopiarUnidadesModal, setShowCopiarUnidadesModal] = useState(false);
  const [showEditUnidadModal, setShowEditUnidadModal] = useState(false);
  const [showEditCriterioModal, setShowEditCriterioModal] = useState(false);
  const [nuevaUnidad, setNuevaUnidad] = useState({ nombre: '', periodo: '1' });
  const [nuevoCriterio, setNuevoCriterio] = useState({ nombre: '', valor_maximo: '', unidad_id: '', competencia_grupo: '', periodo: '1' });
  const [usarPlantilla, setUsarPlantilla] = useState(false);
  const [selectedPlantilla, setSelectedPlantilla] = useState('');
  const [editingUnidad, setEditingUnidad] = useState(null);
  const [editingCriterio, setEditingCriterio] = useState(null);
  const [cursoDestino, setCursoDestino] = useState('');
  const [cursosDestinoCopiar, setCursosDestinoCopiar] = useState([]);
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024);

  const periodos = ['1', '2', '3'];

  useEffect(() => {
    const handleResize = () => setIsTablet(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadCursos();
    loadPlantillas();
    loadCompetencias();
  }, []);

  useEffect(() => {
    if (selectedCurso) {
      loadCursoData();
    }
  }, [selectedCurso, selectedPeriodo]);

  const loadCursos = async () => {
    try {
      const { data: cursosData } = await supabase.from('cursos').select('*');
      const { data: gruposData } = await supabase.from('grupos').select('*');
      const { data: asignaturasData } = await supabase.from('asignaturas').select('*');

      const cursosConInfo = (cursosData || []).map(curso => {
        const grupo = gruposData?.find(g => g.id === curso.grupo_id);
        const asignatura = asignaturasData?.find(a => a.id === curso.asignatura_id);
        return {
          ...curso,
          nombre_completo: `${asignatura?.nombre || 'S/A'} - ${grupo?.nivel} ${grupo?.grado}${grupo?.seccion}`
        };
      });
      setCursos(cursosConInfo);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al cargar cursos' });
    }
  };

  const loadPlantillas = async () => {
    try {
      const { data } = await supabase.from('plantillas_criterios').select('*').order('nombre', { ascending: true });
      setPlantillas(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCompetencias = async () => {
    try {
      const { data } = await supabase.from('competencia_config').select('competencia_grupo');
      const comp = [...new Set((data || []).map(c => c.competencia_grupo).filter(Boolean))];
      setCompetencias(comp);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCursoData = async () => {
    try {
      setLoading(true);
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('*')
        .eq('curso_id', selectedCurso)
        .eq('periodo', selectedPeriodo)
        .order('nombre', { ascending: true });

      const { data: criteriosData } = await supabase
        .from('criterios')
        .select('*')
        .eq('curso_id', selectedCurso)
        .eq('periodo', selectedPeriodo)
        .order('competencia_grupo', { ascending: true })
        .order('orden', { ascending: true });

      const curso = cursos.find(c => c.id === selectedCurso);
      
      const { data: estudiantesData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('grupo_id', curso?.grupo_id)
        .order('num_orden', { ascending: true });

      const { data: calificacionesData } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('curso_id', selectedCurso);

      const calificacionesMap = {};
      (calificacionesData || []).forEach(cal => {
        const key = `${cal.estudiante_id}-${cal.unidad_id}-${cal.criterio_id}`;
        calificacionesMap[key] = cal;
      });

      setUnidades(unidadesData || []);
      setCriterios(criteriosData || []);
      setEstudiantes(estudiantesData || []);
      setCalificaciones(calificacionesMap);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const agregarUnidad = async () => {
    if (!nuevaUnidad.nombre.trim() || !selectedCurso) {
      setMessage({ type: 'error', text: 'Ingresa nombre de unidad' });
      return;
    }
    try {
      await supabase.from('unidades').insert({ 
        curso_id: selectedCurso, 
        nombre: nuevaUnidad.nombre,
        periodo: nuevaUnidad.periodo 
      });
      setMessage({ type: 'success', text: 'Unidad agregada' });
      setShowAgregarUnidadModal(false);
      setNuevaUnidad({ nombre: '', periodo: '1' });
      await loadCursoData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al agregar unidad' });
    }
  };

  const agregarCriterio = async () => {
    if (!selectedCurso) return;
    if (usarPlantilla) {
      if (!selectedPlantilla) {
        setMessage({ type: 'error', text: 'Selecciona plantilla' });
        return;
      }
      try {
        const { data: detalles } = await supabase.from('plantillas_criterios_detalle').select('*').eq('plantilla_id', selectedPlantilla);
        const nuevosCriterios = detalles.map((det, idx) => ({
          curso_id: selectedCurso,
          nombre: det.nombre_criterio,
          valor_maximo: det.valor_maximo,
          orden: idx + 1,
          competencia_grupo: det.competencia_grupo,
          periodo: selectedPeriodo
        }));
        await supabase.from('criterios').insert(nuevosCriterios);
        setMessage({ type: 'success', text: 'Criterios aplicados' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Error al aplicar plantilla' });
      }
    } else {
      if (!nuevoCriterio.nombre.trim() || !nuevoCriterio.valor_maximo) {
        setMessage({ type: 'error', text: 'Completa nombre y valor' });
        return;
      }
      try {
        await supabase.from('criterios').insert({
          curso_id: selectedCurso,
          nombre: nuevoCriterio.nombre,
          valor_maximo: parseFloat(nuevoCriterio.valor_maximo),
          orden: criterios.length + 1,
          unidad_id: nuevoCriterio.unidad_id || null,
          competencia_grupo: nuevoCriterio.competencia_grupo || null,
          periodo: selectedPeriodo
        });
        setMessage({ type: 'success', text: 'Criterio agregado' });
        setNuevoCriterio({ nombre: '', valor_maximo: '', unidad_id: '', competencia_grupo: '', periodo: '1' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Error al agregar criterio' });
      }
    }
    setShowAgregarCriterioModal(false);
    await loadCursoData();
  };

  const handleCalificacionChange = async (estudianteId, unidadId, criterioId, valor) => {
    const key = `${estudianteId}-${unidadId}-${criterioId}`;
    const valorNumerico = valor === '' ? null : parseFloat(valor);
    try {
      if (calificaciones[key]?.id) {
        await supabase.from('calificaciones').update({ calificacion: valorNumerico, updated_at: new Date().toISOString() }).eq('id', calificaciones[key].id);
        setCalificaciones(prev => ({ ...prev, [key]: { ...prev[key], calificacion: valorNumerico } }));
      } else {
        const { data } = await supabase.from('calificaciones').insert({ curso_id: selectedCurso, estudiante_id: estudianteId, unidad_id: unidadId, criterio_id: criterioId, calificacion: valorNumerico }).select().single();
        setCalificaciones(prev => ({ ...prev, [key]: data }));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const calcularTotal = (estudianteId, unidadId) => {
    let total = 0, contador = 0;
    criterios.forEach(criterio => {
      const key = `${estudianteId}-${unidadId}-${criterio.id}`;
      const cal = calificaciones[key];
      if (cal?.calificacion != null) {
        total += parseFloat(cal.calificacion);
        contador++;
      }
    });
    if (tipoCalculo === 'promedio' && contador > 0) return (total / contador).toFixed(2);
    return total.toFixed(2);
  };

  const eliminarUnidad = async (unidadId) => {
    if (!window.confirm('¿Eliminar esta unidad?')) return;
    try {
      await supabase.from('unidades').delete().eq('id', unidadId);
      setMessage({ type: 'success', text: 'Unidad eliminada' });
      await loadCursoData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error' });
    }
  };

  const eliminarCriterio = async (criterioId) => {
    if (!window.confirm('¿Eliminar este criterio?')) return;
    try {
      await supabase.from('criterios').delete().eq('id', criterioId);
      setMessage({ type: 'success', text: 'Criterio eliminado' });
      await loadCursoData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar criterio' });
    }
  };

  const actualizarUnidad = async () => {
    if (!editingUnidad) return;
    try {
      await supabase.from('unidades').update({ nombre: editingUnidad.nombre, periodo: editingUnidad.periodo }).eq('id', editingUnidad.id);
      setMessage({ type: 'success', text: 'Unidad actualizada' });
      setShowEditUnidadModal(false);
      setEditingUnidad(null);
      await loadCursoData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error' });
    }
  };

  const actualizarCriterio = async () => {
    if (!editingCriterio) return;
    try {
      await supabase.from('criterios').update({
        nombre: editingCriterio.nombre,
        valor_maximo: parseFloat(editingCriterio.valor_maximo),
        competencia_grupo: editingCriterio.competencia_grupo,
        periodo: editingCriterio.periodo
      }).eq('id', editingCriterio.id);
      setMessage({ type: 'success', text: 'Criterio actualizado' });
      setShowEditCriterioModal(false);
      setEditingCriterio(null);
      await loadCursoData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error' });
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        accessorKey: 'estudiante',
        header: 'Estudiante',
        size: 220,
        cell: (info) => info.getValue(),
      },
    ];

    unidades.forEach(unidad => {
      const criteriosUnidad = criterios.filter(c => c.unidad_id === unidad.id);
      criteriosUnidad.forEach(criterio => {
        cols.push({
          accessorKey: `criterio-${criterio.id}`,
          header: () => (
            <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => { setEditingCriterio(criterio); setShowEditCriterioModal(true); }}>
              <strong>{criterio.nombre}</strong><br />
              <span style={{ fontSize: '0.7rem' }}>({criterio.valor_maximo})</span>
              {criterio.competencia_grupo && <><br /><span style={{ fontSize: '0.65rem', background: '#e3f2fd', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>📊 {criterio.competencia_grupo}</span></>}
              <button onClick={(e) => { e.stopPropagation(); eliminarCriterio(criterio.id); }} style={{ marginLeft: '0.25rem', background: '#dc3545', color: 'white', border: 'none', padding: '0.1rem 0.2rem', borderRadius: '2px', cursor: 'pointer', fontSize: '0.6rem' }}>🗑️</button>
            </div>
          ),
          size: 160,
          cell: (info) => {
            const estudiante = info.row.original;
            const valor = calificaciones[`${estudiante.id}-${unidad.id}-${criterio.id}`]?.calificacion ?? '';
            return (
              <input
                type="number"
                min="0"
                max={criterio.valor_maximo}
                step="0.01"
                value={valor}
                onChange={(e) => handleCalificacionChange(estudiante.id, unidad.id, criterio.id, e.target.value)}
                style={{ width: '90px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}
              />
            );
          },
        });
      });

      cols.push({
        accessorKey: `total-${unidad.id}`,
        header: `Total ${unidad.nombre}`,
        size: 120,
        cell: (info) => {
          const estudiante = info.row.original;
          return calcularTotal(estudiante.id, unidad.id);
        },
      });
    });

    return cols;
  }, [unidades, criterios, calificaciones, tipoCalculo]);

  const data = useMemo(() => {
    return estudiantes.map(est => ({
      id: est.id,
      estudiante: `${est.num_orden}. ${est.nombres} ${est.apellidos}`,
      ...est,
    }));
  }, [estudiantes]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading && !selectedCurso) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

  return (
    <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h1 style={{ color: '#667eea', marginBottom: '2rem' }}>Gestión de Calificaciones</h1>

      {message.text && <div style={{ padding: '1rem', borderRadius: '8px', marginBottom: '1rem', background: message.type === 'success' ? '#d4edda' : '#f8d7da', color: message.type === 'success' ? '#155724' : '#721c24' }}>{message.text}</div>}

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Curso</label>
          <select value={selectedCurso} onChange={(e) => setSelectedCurso(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px' }}>
            <option value="">-- Seleccione --</option>
            {cursos.map(curso => (<option key={curso.id} value={curso.id}>{curso.nombre_completo}</option>))}
          </select>
        </div>

        {selectedCurso && (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Período</label>
              <select value={selectedPeriodo} onChange={(e) => setSelectedPeriodo(e.target.value)} style={{ padding: '0.75rem', border: '2px solid #28a745', borderRadius: '8px', background: '#d4edda' }}>
                {periodos.map(p => (<option key={p} value={p}>Período {p}</option>))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Cálculo</label>
              <select value={tipoCalculo} onChange={(e) => setTipoCalculo(e.target.value)} style={{ padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px' }}>
                <option value="promedio">Promedio</option>
                <option value="suma">Suma</option>
              </select>
            </div>
          </>
        )}
      </div>

      {selectedCurso && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAgregarUnidadModal(true)} style={{ padding: '0.75rem 1.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Unidad</button>
          <button onClick={() => setShowAgregarCriterioModal(true)} style={{ padding: '0.75rem 1.5rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Criterios</button>
        </div>
      )}

      {selectedCurso && criterios.length > 0 && unidades.length > 0 && estudiantes.length > 0 && (
        <div style={{ border: '2px solid #dee2e6', borderRadius: '8px', overflowX: 'auto', maxHeight: '70vh', position: 'relative' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} style={{ background: '#667eea', color: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} style={{ padding: '0.75rem', border: '1px solid #5568d3', textAlign: 'center', minWidth: `${header.getSize()}px`, position: header.column.id === 'estudiante' ? 'sticky' : 'relative', left: header.column.id === 'estudiante' ? 0 : 'auto', background: '#667eea', zIndex: header.column.id === 'estudiante' ? 11 : 10 }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={{ padding: '0.75rem', border: '1px solid #dee2e6', textAlign: 'center', minWidth: `${cell.column.columnDef.size}px`, position: cell.column.id === 'estudiante' ? 'sticky' : 'relative', left: cell.column.id === 'estudiante' ? 0 : 'auto', background: cell.column.id === 'estudiante' ? 'white' : 'transparent', zIndex: cell.column.id === 'estudiante' ? 5 : 0, fontWeight: cell.column.id === 'estudiante' ? 600 : 400 }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAgregarUnidadModal && <Modal onClose={() => setShowAgregarUnidadModal(false)}>
        <h2 style={{ marginTop: 0, color: '#667eea' }}>Agregar Unidad</h2>
        <input type="text" value={nuevaUnidad.nombre} onChange={(e) => setNuevaUnidad({ ...nuevaUnidad, nombre: e.target.value })} placeholder="Nombre" style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '1rem' }} />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={agregarUnidad} style={{ flex: 1, padding: '0.75rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setShowAgregarUnidadModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </Modal>}

      {showAgregarCriterioModal && <Modal onClose={() => setShowAgregarCriterioModal(false)}>
        <h2 style={{ marginTop: 0, color: '#667eea' }}>Agregar Criterios</h2>
        <input type="text" placeholder="Nombre" value={nuevoCriterio.nombre} onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, nombre: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '0.5rem' }} />
        <input type="number" placeholder="Valor máximo" value={nuevoCriterio.valor_maximo} onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, valor_maximo: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '0.5rem' }} />
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Unidad:</label>
        <select value={nuevoCriterio.unidad_id} onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, unidad_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '0.5rem' }}>
          <option value="">-- Todas las unidades --</option>
          {unidades.map(unidad => (<option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>))}
        </select>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Competencia:</label>
        <select value={nuevoCriterio.competencia_grupo} onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, competencia_grupo: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '1rem' }}>
          <option value="">Sin competencia</option>
          {competencias.map((c, i) => (<option key={i} value={c}>{c}</option>))}
        </select>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={agregarCriterio} style={{ flex: 1, padding: '0.75rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setShowAgregarCriterioModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </Modal>}

      {showEditUnidadModal && editingUnidad && <Modal onClose={() => setShowEditUnidadModal(false)}>
        <h2 style={{ marginTop: 0, color: '#667eea' }}>Editar Unidad</h2>
        <input type="text" value={editingUnidad.nombre} onChange={(e) => setEditingUnidad({ ...editingUnidad, nombre: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '1rem' }} />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={actualizarUnidad} style={{ flex: 1, padding: '0.75rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setShowEditUnidadModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </Modal>}

      {showEditCriterioModal && editingCriterio && <Modal onClose={() => setShowEditCriterioModal(false)}>
        <h2 style={{ marginTop: 0, color: '#667eea' }}>Editar Criterio</h2>
        <input type="text" value={editingCriterio.nombre} onChange={(e) => setEditingCriterio({ ...editingCriterio, nombre: e.target.value })} placeholder="Nombre" style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '0.5rem' }} />
        <input type="number" value={editingCriterio.valor_maximo} onChange={(e) => setEditingCriterio({ ...editingCriterio, valor_maximo: e.target.value })} placeholder="Valor máximo" style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '0.5rem' }} />
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Competencia:</label>
        <select value={editingCriterio.competencia_grupo || ''} onChange={(e) => setEditingCriterio({ ...editingCriterio, competencia_grupo: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '1rem' }}>
          <option value="">Sin competencia</option>
          {competencias.map((c, i) => (<option key={i} value={c}>{c}</option>))}
        </select>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={actualizarCriterio} style={{ flex: 1, padding: '0.75rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setShowEditCriterioModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </Modal>}
    </div>
  );
}

export default Calificaciones;
