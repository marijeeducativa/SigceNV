import { useState, useEffect, useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const Modal = ({ onClose, children, zIndex = 1000 }) => (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIndex }}>
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
  const [showCalificacionesModal, setShowCalificacionesModal] = useState(false);
  const [showCopiarUnidadModal, setShowCopiarUnidadModal] = useState(false);
  const [showGestionUnidadesModal, setShowGestionUnidadesModal] = useState(false);
  const [selectedEstudianteUnidad, setSelectedEstudianteUnidad] = useState(null);
  const [selectedUnidadCopiar, setSelectedUnidadCopiar] = useState(null);
  const [nuevaUnidad, setNuevaUnidad] = useState({ nombre: '', periodo: '1' });
  const [nuevoCriterio, setNuevoCriterio] = useState({ nombre: '', valor_maximo: '', unidad_id: '', competencia_grupo: '', periodo: '1' });
  const [usarPlantilla, setUsarPlantilla] = useState(false);
  const [selectedPlantilla, setSelectedPlantilla] = useState('');
  const [editingUnidad, setEditingUnidad] = useState(null);
  const [editingCriterio, setEditingCriterio] = useState(null);
  const [cursoDestino, setCursoDestino] = useState('');
  const [cursosDestinoCopiar, setCursosDestinoCopiar] = useState([]);
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024);
  const [showGestionUnidadModal, setShowGestionUnidadModal] = useState(false);
  const [unidadGestion, setUnidadGestion] = useState(null);
  const [isPrimary, setIsPrimary] = useState(true);
  const [competenciasList, setCompetenciasList] = useState(['C1','C2','C3']);
  const [recuperaciones, setRecuperaciones] = useState({});

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

  useEffect(() => {
    if (unidadGestion) {
      // Load criteria for the unit being managed
      const loadCriteriosUnidad = async () => {
        try {
          const { data: criteriosData } = await supabase
            .from('criterios')
            .select('*')
            .eq('unidad_id', unidadGestion.id)
            .order('orden', { ascending: true });

          setUnidadGestion(prev => ({
            ...prev,
            criterios: criteriosData || []
          }));
        } catch (error) {
          console.error('Error loading unit criteria:', error);
        }
      };

      loadCriteriosUnidad();
    }
  }, [unidadGestion?.id]);

  const loadCursos = async () => {
    try {
      let query = supabase.from('cursos').select('*');

      // Filter courses for teachers based on assignments
      if (userProfile?.rol === 'Profesor') {
        const { data: asignaciones } = await supabase.from('asignaciones').select('curso_id').eq('user_id', userProfile.id);
        const cursosIds = asignaciones?.map(a => a.curso_id) || [];
        if (cursosIds.length > 0) {
          query = query.in('id', cursosIds);
        } else {
          setCursos([]);
          return;
        }
      }

      const { data: cursosData } = await query;
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
    // Hardcode competencies globally since they should be available for all courses
    setCompetencias(['C1','C2','C3','C4']);
  };

  const loadCursoData = async () => {
    try {
      setLoading(true);
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('*')
        .eq('curso_id', selectedCurso)
        .order('periodo', { ascending: true })
        .order('nombre', { ascending: true });

      const { data: criteriosData } = await supabase
        .from('criterios')
        .select('*')
        .eq('curso_id', selectedCurso)
        .order('periodo', { ascending: true })
        .order('competencia_grupo', { ascending: true })
        .order('orden', { ascending: true });

      const curso = cursos.find(c => c.id === selectedCurso);
      
      const { data: estudiantesData } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('grupo_id', curso?.grupo_id)
        .order('num_orden', { ascending: true });

      const { data: gruposData } = await supabase.from('grupos').select('*');

      const { data: calificacionesData } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('curso_id', selectedCurso);

      const calificacionesMap = {};
      (calificacionesData || []).forEach(cal => {
        const criterioObj = criteriosData.find(c => c.id === cal.criterio_id);
        const unidadIdFromCriterio = criterioObj?.unidad_id;
        const key = `${cal.estudiante_id}-${unidadIdFromCriterio}-${cal.criterio_id}`;
        calificacionesMap[key] = cal;
      });

      setUnidades(unidadesData || []);
      setCriterios(criteriosData || []);
      setEstudiantes(estudiantesData || []);
      setCalificaciones(calificacionesMap);

      const grupo = gruposData?.find(g => g.id === curso?.grupo_id);
      const primary = grupo?.nivel === 'Primario';
      setIsPrimary(primary);
      setCompetenciasList(primary ? ['C1','C2','C3'] : ['C1','C2','C3','C4']);

      const { data: recuperacionesData } = await supabase
        .from('recuperaciones_competencias')
        .select('*')
        .eq('curso_id', selectedCurso);

      const recuperacionesMap = {};
      (recuperacionesData || []).forEach(rec => {
        const key = `${rec.estudiante_id}-${rec.periodo}-${rec.competencia_grupo}-${rec.tipo}`;
        recuperacionesMap[key] = rec.calificacion;
      });
      setRecuperaciones(recuperacionesMap);
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
        await supabase.from('calificaciones').update({
          calificacion: valorNumerico,
          updated_at: new Date().toISOString()
        }).eq('id', calificaciones[key].id);
        setCalificaciones(prev => ({ ...prev, [key]: { ...prev[key], calificacion: valorNumerico } }));
      } else {
        const { data, error } = await supabase.from('calificaciones').insert({
          curso_id: selectedCurso,
          estudiante_id: estudianteId,
          criterio_id: criterioId,
          calificacion: valorNumerico,
          periodo: 'P' + selectedPeriodo
        }).select().single();

        if (error) {
          console.error('Insert error:', error);
          return;
        }

        setCalificaciones(prev => ({ ...prev, [key]: data }));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleRecoveryChange = async (estudianteId, periodo, competencia, tipo, valor) => {
    const key = `${estudianteId}-${periodo}-${competencia}-${tipo}`;
    const valorNumerico = valor === '' ? null : parseFloat(valor);

    try {
      if (recuperaciones[key]?.id) {
        // Update existing recovery
        await supabase.from('recuperaciones_competencias').update({
          calificacion: valorNumerico,
          updated_at: new Date().toISOString()
        }).eq('id', recuperaciones[key].id);

        setRecuperaciones(prev => ({
          ...prev,
          [key]: { ...prev[key], calificacion: valorNumerico }
        }));
      } else if (valorNumerico !== null) {
        // Insert new recovery
        const { data, error } = await supabase.from('recuperaciones_competencias').insert({
          curso_id: selectedCurso,
          estudiante_id: estudianteId,
          periodo: parseInt(periodo),
          competencia_grupo: competencia,
          tipo: tipo,
          calificacion: valorNumerico
        }).select().single();

        if (error) {
          console.error('Recovery insert error:', error);
          return;
        }

        setRecuperaciones(prev => ({
          ...prev,
          [key]: data
        }));
      } else {
        // Delete recovery if value is cleared
        if (recuperaciones[key]?.id) {
          await supabase.from('recuperaciones_competencias').delete().eq('id', recuperaciones[key].id);
          setRecuperaciones(prev => {
            const newRecuperaciones = { ...prev };
            delete newRecuperaciones[key];
            return newRecuperaciones;
          });
        }
      }
    } catch (error) {
      console.error('Recovery error:', error);
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
    if (tipoCalculo === 'promedio' && contador > 0) return Math.round(total / contador);
    return Math.round(total);
  };

  const calcularCompetenciasUnidad = (estudianteId, unidadId) => {
    const competencias = {};
    competenciasList.forEach(comp => competencias[comp] = 0);
    const criteriosUnidad = criterios.filter(c => c.unidad_id === unidadId);

    competenciasList.forEach(comp => {
      const criteriosComp = criteriosUnidad.filter(c => c.competencia_grupo === comp);
      let totalComp = 0, contadorComp = 0;

      criteriosComp.forEach(criterio => {
        const key = `${estudianteId}-${unidadId}-${criterio.id}`;
        const cal = calificaciones[key];
        if (cal?.calificacion != null) {
          totalComp += parseFloat(cal.calificacion);
          contadorComp++;
        }
      });

      if (contadorComp > 0) {
        competencias[comp] = tipoCalculo === 'promedio' ? Math.round(totalComp / contadorComp) : Math.round(totalComp);
      }
    });

    return competencias;
  };

  const calcularCompetenciasPeriodo = (estudianteId, periodo) => {
    const unidadesPeriodo = unidades.filter(u => u.periodo == periodo);
    const competencias = {};
    competenciasList.forEach(comp => competencias[comp] = []);
    unidadesPeriodo.forEach(unidad => {
      const compUnidad = calcularCompetenciasUnidad(estudianteId, unidad.id);
      competenciasList.forEach(comp => {
        if (compUnidad[comp] > 0) competencias[comp].push(compUnidad[comp]);
      });
    });
    const promedios = {};
    competenciasList.forEach(comp => {
      const vals = competencias[comp];
      promedios[comp] = vals.length > 0 ? Math.round(vals.reduce((a,b)=>a+b,0) / vals.length) : 0;
    });
    return promedios;
  };

  const calcularCompetenciaFinal = (estudianteId, comp) => {
    let sum = 0, count = 0;
    for(let p=1; p<=4; p++){
      const periodoComp = calcularCompetenciasPeriodo(estudianteId, p)[comp];
      const recoveryKey = `${estudianteId}-${p}-${comp}-periodo`;
      const recovery = recuperaciones[recoveryKey];
      const value = recovery !== undefined ? recovery : periodoComp;
      if (value > 0) {
        sum += value;
        count++;
      }
    }
    return count > 0 ? Math.round(sum / count) : 0;
  };

  const calcularCalificacionFinal = (estudianteId) => {
    const compFinals = competenciasList.map(comp => calcularCompetenciaFinal(estudianteId, comp)).filter(v => v > 0);
    return compFinals.length > 0 ? Math.round(compFinals.reduce((a,b)=>a+b,0) / compFinals.length) : 0;
  };

  const abrirModalCalificaciones = (estudiante, unidad) => {
    setSelectedEstudianteUnidad({ estudiante, unidad });
    setShowCalificacionesModal(true);
  };

  const guardarCalificacionesModal = async () => {
    // This will be handled by the individual input changes
    setShowCalificacionesModal(false);
    setSelectedEstudianteUnidad(null);
  };

  const copiarUnidad = async () => {
    if (!selectedUnidadCopiar || cursosDestinoCopiar.length === 0) {
      setMessage({ type: 'error', text: 'Selecciona al menos un curso destino' });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      // Get the unit's criteria
      const { data: criteriosUnidad } = await supabase
        .from('criterios')
        .select('*')
        .eq('unidad_id', selectedUnidadCopiar.id);

      for (const cursoId of cursosDestinoCopiar) {
        try {
          // Create the unit in the destination course
          const { data: nuevaUnidad, error: errorUnidad } = await supabase
            .from('unidades')
            .insert({
              curso_id: cursoId,
              nombre: selectedUnidadCopiar.nombre,
              periodo: selectedUnidadCopiar.periodo
            })
            .select()
            .single();

          if (errorUnidad) throw errorUnidad;

          // Copy all criteria to the new unit
          if (criteriosUnidad && criteriosUnidad.length > 0) {
            const nuevosCriterios = criteriosUnidad.map(criterio => ({
              curso_id: cursoId,
              unidad_id: nuevaUnidad.id,
              nombre: criterio.nombre,
              valor_maximo: criterio.valor_maximo,
              orden: criterio.orden,
              competencia_grupo: criterio.competencia_grupo,
              periodo: criterio.periodo
            }));

            const { error: errorCriterios } = await supabase
              .from('criterios')
              .insert(nuevosCriterios);

            if (errorCriterios) throw errorCriterios;
          }

          successCount++;
        } catch (error) {
          console.error(`Error copiando a curso ${cursoId}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        setMessage({ type: 'success', text: `Unidad copiada a ${successCount} curso(s) exitosamente${errorCount > 0 ? ` (${errorCount} errores)` : ''}` });
        // Refresh data after copying
        await loadCursoData();
      } else {
        setMessage({ type: 'error', text: 'Error al copiar unidad' });
      }

      setShowCopiarUnidadModal(false);
      setSelectedUnidadCopiar(null);
      setCursosDestinoCopiar([]);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al copiar unidad: ' + error.message });
    }
  };

  const abrirGestionUnidad = async (unidad) => {
    try {
      // Load criteria for the unit being managed
      const { data: criteriosData } = await supabase
        .from('criterios')
        .select('*')
        .eq('unidad_id', unidad.id)
        .order('orden', { ascending: true });

      setUnidadGestion({
        ...unidad,
        criterios: criteriosData || []
      });
      setShowGestionUnidadModal(true);
    } catch (error) {
      console.error('Error loading unit criteria:', error);
      setMessage({ type: 'error', text: 'Error al cargar criterios de la unidad' });
    }
  };

  const actualizarCriterioInline = async (criterioId, field, value) => {
    try {
      const updateData = {};
      updateData[field] = field === 'valor_maximo' ? parseFloat(value) : value;

      const { error } = await supabase
        .from('criterios')
        .update(updateData)
        .eq('id', criterioId);

      if (error) throw error;

      // Update local state
      setUnidadGestion(prev => ({
        ...prev,
        criterios: prev.criterios.map(c =>
          c.id === criterioId ? { ...c, [field]: updateData[field] } : c
        )
      }));

      await loadCursoData(); // Refresh the main table
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar criterio' });
    }
  };

  const eliminarCriterioGestion = async (criterioId) => {
    if (!window.confirm('¿Eliminar este criterio?')) return;

    try {
      const { error } = await supabase
        .from('criterios')
        .delete()
        .eq('id', criterioId);

      if (error) throw error;

      // Update local state
      setUnidadGestion(prev => ({
        ...prev,
        criterios: prev.criterios.filter(c => c.id !== criterioId)
      }));

      await loadCursoData(); // Refresh the main table
      setMessage({ type: 'success', text: 'Criterio eliminado' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar criterio' });
    }
  };

  const agregarCriterioGestion = async () => {
    if (!nuevoCriterio.nombre.trim() || !nuevoCriterio.valor_maximo) {
      setMessage({ type: 'error', text: 'Completa nombre y valor' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('criterios')
        .insert({
          curso_id: selectedCurso,
          unidad_id: unidadGestion.id,
          nombre: nuevoCriterio.nombre,
          valor_maximo: parseFloat(nuevoCriterio.valor_maximo),
          orden: (unidadGestion.criterios?.length || 0) + 1,
          competencia_grupo: nuevoCriterio.competencia_grupo || null,
          periodo: selectedPeriodo
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setUnidadGestion(prev => ({
        ...prev,
        criterios: [...(prev.criterios || []), data]
      }));

      setNuevoCriterio({ nombre: '', valor_maximo: '', unidad_id: '', competencia_grupo: '', periodo: '1' });
      await loadCursoData(); // Refresh the main table
      setMessage({ type: 'success', text: 'Criterio agregado' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al agregar criterio' });
    }
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
        cell: (info) => {
          const estudiante = info.row.original;
          return (
            <div style={{ fontWeight: 600 }}>
              {info.getValue()}
            </div>
          );
        },
      },
    ];

    unidades.forEach(unidad => {
      const criteriosUnidad = criterios.filter(c => c.unidad_id === unidad.id);

      // Clickable cell for the unit
      cols.push({
        accessorKey: `unidad-${unidad.id}`,
        header: () => (
          <div style={{ textAlign: 'center', fontSize: '0.9rem', lineHeight: '1.2' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <strong>{unidad.nombre}</strong>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingUnidad(unidad); setShowEditUnidadModal(true); }}
                  style={{ background: '#ffc107', color: 'black', border: 'none', padding: '0.1rem 0.3rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.6rem' }}
                  title="Editar unidad"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); abrirGestionUnidad(unidad); }}
                  style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '0.1rem 0.3rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.6rem' }}
                  title="Gestionar criterios"
                >
                  ⚙️
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); eliminarUnidad(unidad.id); }}
                  style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.1rem 0.3rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.6rem' }}
                  title="Eliminar unidad"
                >
                  🗑️
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedUnidadCopiar(unidad); setShowCopiarUnidadModal(true); }}
                  style={{ background: '#28a745', color: 'white', border: 'none', padding: '0.1rem 0.3rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.6rem' }}
                  title="Copiar unidad"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        ),
        size: isTablet ? 120 : 140,
        cell: (info) => {
          const estudiante = info.row.original;
          const total = calcularTotal(estudiante.id, unidad.id);
          const competenciasUnidad = calcularCompetenciasUnidad(estudiante.id, unidad.id);

          return (
            <div
              onClick={() => abrirModalCalificaciones(estudiante, unidad)}
              style={{
                padding: '0.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8f9fa',
                border: '2px solid #dee2e6',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: isTablet ? '0.8rem' : '0.9rem',
                minHeight: '50px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#e9ecef'}
              onMouseLeave={(e) => e.target.style.background = '#f8f9fa'}
            >
              <div style={{ marginBottom: '0.25rem' }}>{total}</div>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.entries(competenciasUnidad).map(([comp, value]) => (
                  <span key={comp} style={{
                    fontSize: '0.7rem',
                    background: '#e3f2fd',
                    padding: '0.1rem 0.2rem',
                    borderRadius: '2px',
                    fontWeight: 'normal'
                  }}>
                    {comp}: {Math.round(value)}
                  </span>
                ))}
              </div>
            </div>
          );
        },
      });
    });

    return cols;
  }, [unidades, criterios, calificaciones, tipoCalculo, competenciasList]);

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
          <button onClick={() => setShowGestionUnidadesModal(true)} style={{ padding: '0.75rem 1.5rem', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>⚙️ Gestionar Unidades</button>
          <button onClick={() => setShowCopiarUnidadesModal(true)} style={{ padding: '0.75rem 1.5rem', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>📋 Copiar Unidades</button>
        </div>
      )}

      {selectedCurso && criterios.length > 0 && unidades.length > 0 && estudiantes.length > 0 && (
        <div style={{ border: '2px solid #dee2e6', borderRadius: '8px', overflow: 'auto', maxHeight: '70vh', position: 'relative', width: '100%' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontSize: isTablet ? '0.85rem' : '1rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} style={{ background: '#667eea', color: 'white' }}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} style={{ padding: isTablet ? '0.5rem' : '0.75rem', border: '1px solid #5568d3', textAlign: 'center', width: `${header.getSize()}px`, position: header.column.id === 'estudiante' ? 'sticky' : 'relative', left: header.column.id === 'estudiante' ? 0 : 'auto', background: '#667eea', zIndex: header.column.id === 'estudiante' ? 11 : 10, fontSize: isTablet ? '0.8rem' : '0.9rem' }}>
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
                    <td key={cell.id} style={{ padding: '0', border: '1px solid #dee2e6', textAlign: 'center', width: `${cell.column.columnDef.size}px`, position: cell.column.id === 'estudiante' ? 'sticky' : 'relative', left: cell.column.id === 'estudiante' ? 0 : 'auto', background: cell.column.id === 'estudiante' ? 'white' : 'transparent', zIndex: cell.column.id === 'estudiante' ? 5 : 1, fontWeight: cell.column.id === 'estudiante' ? 600 : 400 }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* Sección de Recuperaciones */}
      {selectedCurso && estudiantes.length > 0 && (
        <div style={{ marginTop: '2rem', border: '1px solid #ffc107', borderRadius: '8px', padding: '1rem' }}>
          <h3 style={{ color: '#856404', marginBottom: '1rem' }}>🔄 Recuperaciones de Competencias</h3>
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
            Ingresa las notas de recuperación para reemplazar los valores originales de las competencias en los cálculos finales.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📅 Período de Recuperación</label>
            <select value={selectedPeriodo} onChange={(e) => setSelectedPeriodo(e.target.value)} style={{ padding: '0.75rem', border: '2px solid #ffc107', borderRadius: '8px', background: '#fff3cd' }}>
              {periodos.map(p => (<option key={p} value={p}>Período {p}</option>))}
            </select>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead style={{ background: '#fff3cd', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ padding: '0.75rem', border: '1px solid #dee2e6', textAlign: 'left', minWidth: '200px' }}>Estudiante</th>
                  {competenciasList.map(comp => (
                    <th key={comp} style={{ padding: '0.75rem', border: '1px solid #dee2e6', textAlign: 'center', minWidth: '100px' }}>
                      {comp} Recuperación
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(estudiante => (
                  <tr key={estudiante.id} style={{ background: estudiante.num_orden % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={{ padding: '0.75rem', border: '1px solid #dee2e6', fontWeight: '600' }}>
                      {estudiante.estudiante}
                    </td>
                    {competenciasList.map(comp => {
                      const recoveryKey = `${estudiante.id}-${selectedPeriodo}-${comp}-periodo`;
                      const currentValue = recuperaciones[recoveryKey] || '';
                      return (
                        <td key={comp} style={{ padding: '0.75rem', border: '1px solid #dee2e6', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={currentValue}
                            onChange={(e) => handleRecoveryChange(estudiante.id, selectedPeriodo, comp, 'periodo', e.target.value)}
                            placeholder="Nota RC"
                            style={{
                              width: '80px',
                              padding: '0.25rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              textAlign: 'center',
                              fontSize: '0.8rem'
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedCurso && estudiantes.length > 0 && (
        <div style={{ marginTop: '2rem', border: '1px solid #dee2e6', borderRadius: '8px', padding: '1rem' }}>
          <h3 style={{ color: '#667eea', marginBottom: '1rem' }}>Resumen de Calificaciones Finales (Año)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '0.5rem', border: '1px solid #dee2e6', textAlign: 'left' }}>Estudiante</th>
                {competenciasList.map(comp => (
                  <th key={comp} style={{ padding: '0.5rem', border: '1px solid #dee2e6', textAlign: 'center' }}>{comp} Final</th>
                ))}
                <th style={{ padding: '0.5rem', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', background: '#e9ecef' }}>Nota Final Asignatura</th>
              </tr>
            </thead>
            <tbody>
              {data.map(estudiante => (
                <tr key={estudiante.id}>
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>{estudiante.estudiante}</td>
                  {competenciasList.map(comp => (
                    <td key={comp} style={{ padding: '0.5rem', border: '1px solid #dee2e6', textAlign: 'center' }}>
                      {Math.round(calcularCompetenciaFinal(estudiante.id, comp))}
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', background: '#f0f4ff' }}>
                    {Math.round(calcularCalificacionFinal(estudiante.id))}
                  </td>
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

      {showEditUnidadModal && editingUnidad && <Modal onClose={() => setShowEditUnidadModal(false)} zIndex={1100}>
        <h2 style={{ marginTop: 0, color: '#667eea' }}>Editar Unidad</h2>
        <input type="text" value={editingUnidad.nombre} onChange={(e) => setEditingUnidad({ ...editingUnidad, nombre: e.target.value })} placeholder="Nombre de la unidad" style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '1rem' }} />
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Período:</label>
        <select value={editingUnidad.periodo || '1'} onChange={(e) => setEditingUnidad({ ...editingUnidad, periodo: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '1rem' }}>
          {periodos.map(p => (<option key={p} value={p}>Período {p}</option>))}
        </select>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={actualizarUnidad} style={{ flex: 1, padding: '0.75rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setShowEditUnidadModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      </Modal>}

      {showCopiarUnidadModal && selectedUnidadCopiar && (
        <Modal onClose={() => setShowCopiarUnidadModal(false)} zIndex={1100}>
          <h2 style={{ marginTop: 0, color: '#667eea' }}>Copiar Unidad</h2>
          <p style={{ marginBottom: '1rem', color: '#495057' }}>
            Copiar "<strong>{selectedUnidadCopiar.nombre}</strong>" con todos sus criterios
          </p>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Cursos destino (mantén Ctrl para seleccionar múltiples):</label>
          <select
            multiple
            value={cursosDestinoCopiar}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value);
              setCursosDestinoCopiar(values);
            }}
            style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', marginBottom: '1rem', minHeight: '120px' }}
          >
            {cursos.filter(c => c.id !== selectedCurso).map(curso => (
              <option key={curso.id} value={curso.id}>{curso.nombre_completo}</option>
            ))}
          </select>
          {cursosDestinoCopiar.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Cursos seleccionados ({cursosDestinoCopiar.length}):</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                {cursosDestinoCopiar.map(cursoId => {
                  const curso = cursos.find(c => c.id === cursoId);
                  return <li key={cursoId} style={{ margin: '0.25rem 0' }}>{curso?.nombre_completo}</li>;
                })}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={copiarUnidad} style={{ flex: 1, padding: '0.75rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Copiar a {cursosDestinoCopiar.length} curso(s)</button>
            <button onClick={() => { setShowCopiarUnidadModal(false); setSelectedUnidadCopiar(null); setCursosDestinoCopiar([]); }} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {showGestionUnidadModal && unidadGestion && (
        <Modal onClose={() => setShowGestionUnidadModal(false)} zIndex={1100}>
          <h2 style={{ marginTop: 0, color: '#667eea' }}>Gestionar Unidad: {unidadGestion.nombre}</h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#495057', marginBottom: '1rem' }}>Criterios de la Unidad</h3>

            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1rem' }}>
              {unidadGestion.criterios && unidadGestion.criterios.length > 0 ? (
                unidadGestion.criterios.map(criterio => (
                  <div key={criterio.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.75rem', border: '1px solid #dee2e6', borderRadius: '6px', background: '#f8f9fa' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={criterio.nombre}
                        onChange={(e) => actualizarCriterioInline(criterio.id, 'nombre', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem', border: '1px solid #ddd', borderRadius: '3px', marginBottom: '0.25rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.8rem' }}>Máx:</label>
                        <input
                          type="number"
                          value={criterio.valor_maximo}
                          onChange={(e) => actualizarCriterioInline(criterio.id, 'valor_maximo', e.target.value)}
                          style={{ width: '80px', padding: '0.25rem', border: '1px solid #ddd', borderRadius: '3px' }}
                          step="0.01"
                        />
                        {criterio.competencia_grupo && (
                          <span style={{ fontSize: '0.8rem', background: '#e3f2fd', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>
                            📊 {criterio.competencia_grupo}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => eliminarCriterioGestion(criterio.id)}
                      style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}
                      title="Eliminar criterio"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: '#6c757d', padding: '2rem' }}>No hay criterios en esta unidad</p>
              )}
            </div>

            <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '1rem' }}>
              <h4 style={{ color: '#495057', marginBottom: '0.5rem' }}>Agregar Nuevo Criterio</h4>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Nombre del criterio"
                  value={nuevoCriterio.nombre}
                  onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, nombre: e.target.value })}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '3px' }}
                />
                <input
                  type="number"
                  placeholder="Valor máximo"
                  value={nuevoCriterio.valor_maximo}
                  onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, valor_maximo: e.target.value })}
                  style={{ width: '100px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '3px' }}
                  step="0.01"
                />
                <select
                  value={nuevoCriterio.competencia_grupo}
                  onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, competencia_grupo: e.target.value })}
                  style={{ width: '120px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '3px' }}
                >
                  <option value="">Sin competencia</option>
                  {competencias.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={agregarCriterioGestion}
                  style={{ background: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '3px', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setShowGestionUnidadModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cerrar</button>
          </div>
        </Modal>
      )}

      {showEditCriterioModal && editingCriterio && <Modal onClose={() => setShowEditCriterioModal(false)} zIndex={1100}>
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

      {showGestionUnidadesModal && (
        <Modal onClose={() => setShowGestionUnidadesModal(false)}>
          <h2 style={{ marginTop: 0, color: '#667eea' }}>Gestionar Unidades del Curso</h2>
          <p style={{ marginBottom: '1rem', color: '#495057' }}>
            Administra todas las unidades y sus criterios para este curso
          </p>

          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {unidades.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6c757d', padding: '2rem' }}>No hay unidades en este curso</p>
            ) : (
              unidades.map(unidad => {
                const criteriosUnidad = criterios.filter(c => c.unidad_id === unidad.id);
                return (
                  <div key={unidad.id} style={{ marginBottom: '1.5rem', padding: '1rem', border: '2px solid #dee2e6', borderRadius: '8px', background: '#f8f9fa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, color: '#495057' }}>{unidad.nombre}</h3>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => { setEditingUnidad(unidad); setShowEditUnidadModal(true); }}
                          style={{ background: '#ffc107', color: 'black', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}
                          title="Editar unidad"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => abrirGestionUnidad(unidad)}
                          style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}
                          title="Gestionar criterios"
                        >
                          ⚙️
                        </button>
                        <button
                          onClick={() => eliminarUnidad(unidad.id)}
                          style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}
                          title="Eliminar unidad"
                        >
                          🗑️
                        </button>
                        <button
                          onClick={() => { setSelectedUnidadCopiar(unidad); setShowCopiarUnidadModal(true); }}
                          style={{ background: '#28a745', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}
                          title="Copiar unidad"
                        >
                          📋
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Criterios ({criteriosUnidad.length}):</strong>
                    </div>

                    {criteriosUnidad.length === 0 ? (
                      <p style={{ fontStyle: 'italic', color: '#6c757d', margin: '0.5rem 0' }}>Sin criterios asignados</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {criteriosUnidad.map(criterio => (
                          <div key={criterio.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '4px', border: '1px solid #dee2e6' }}>
                            <span style={{ flex: 1, fontSize: '0.9rem' }}>{criterio.nombre}</span>
                            <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>Máx: {criterio.valor_maximo}</span>
                            {criterio.competencia_grupo && (
                              <span style={{ fontSize: '0.8rem', background: '#e3f2fd', padding: '0.1rem 0.3rem', borderRadius: '2px' }}>
                                {criterio.competencia_grupo}
                              </span>
                            )}
                            <button
                              onClick={() => { setEditingCriterio(criterio); setShowEditCriterioModal(true); }}
                              style={{ background: '#ffc107', color: 'black', border: 'none', padding: '0.1rem 0.3rem', borderRadius: '2px', cursor: 'pointer', fontSize: '0.7rem' }}
                              title="Editar criterio"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => eliminarCriterio(criterio.id)}
                              style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.1rem 0.3rem', borderRadius: '2px', cursor: 'pointer', fontSize: '0.7rem' }}
                              title="Eliminar criterio"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => setShowGestionUnidadesModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cerrar</button>
          </div>
        </Modal>
      )}

      {showCalificacionesModal && selectedEstudianteUnidad && (
        <Modal onClose={() => setShowCalificacionesModal(false)}>
          <h2 style={{ marginTop: 0, color: '#667eea' }}>
            Calificaciones - {selectedEstudianteUnidad.estudiante.nombres} {selectedEstudianteUnidad.estudiante.apellidos}
          </h2>
          <h3 style={{ marginBottom: '1rem', color: '#495057' }}>
            Unidad: {selectedEstudianteUnidad.unidad.nombre}
          </h3>

          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {criterios.filter(c => c.unidad_id === selectedEstudianteUnidad.unidad.id).map(criterio => {
              const valor = calificaciones[`${selectedEstudianteUnidad.estudiante.id}-${selectedEstudianteUnidad.unidad.id}-${criterio.id}`]?.calificacion || '';
              return (
                <div key={criterio.id} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #dee2e6', borderRadius: '8px', background: '#f8f9fa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#495057' }}>{criterio.nombre}</strong>
                    <span style={{ fontSize: '0.9rem', color: '#6c757d' }}>Máx: {criterio.valor_maximo}</span>
                  </div>
                  {criterio.competencia_grupo && (
                    <div style={{ fontSize: '0.8rem', background: '#e3f2fd', padding: '0.2rem 0.4rem', borderRadius: '3px', display: 'inline-block', marginBottom: '0.5rem' }}>
                      📊 {criterio.competencia_grupo}
                    </div>
                  )}
                  <input
                    type="number"
                    min="0"
                    max={criterio.valor_maximo}
                    step="0.01"
                    value={valor}
                    onChange={(e) => handleCalificacionChange(selectedEstudianteUnidad.estudiante.id, selectedEstudianteUnidad.unidad.id, criterio.id, e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}
                    placeholder="Ingrese calificación"
                    readOnly={false}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#e9ecef', borderRadius: '8px' }}>
            <strong>Total: {calcularTotal(selectedEstudianteUnidad.estudiante.id, selectedEstudianteUnidad.unidad.id)}</strong>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={guardarCalificacionesModal} style={{ flex: 1, padding: '0.75rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Guardar</button>
            <button onClick={() => setShowCalificacionesModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Calificaciones;
