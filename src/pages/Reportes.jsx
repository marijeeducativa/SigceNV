import { useState, useEffect } from 'react';
import React from 'react';
import { supabase, cockroachClient } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function Reportes() {
  const { userProfile } = useAuth();
  
  // Estados principales
  const [config, setConfig] = useState(null);
  const [cursos, setCursos] = useState([]);
  const [selectedCurso, setSelectedCurso] = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [criterios, setCriterios] = useState([]);
  const [calificaciones, setCalificaciones] = useState({});
  const [selectedEstudiante, setSelectedEstudiante] = useState('');
  const [selectedPeriodo, setSelectedPeriodo] = useState('1er Trimestre');
  const [selectedUnidad, setSelectedUnidad] = useState('');
  const [reporteData, setReporteData] = useState(null);
  const [reporteUnidadData, setReporteUnidadData] = useState(null);
  const [reporteOficialData, setReporteOficialData] = useState(null);
  const [decimales, setDecimales] = useState('1');
  const [tipoCalculo, setTipoCalculo] = useState('promedio');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [recuperaciones, setRecuperaciones] = useState({});
  const [competencias, setCompetencias] = useState(['C1', 'C2', 'C3', 'C4']);

  const periodos = ['1er Período', '2do Período', '3er Período', 'Anual'];

  // Cargar configuración y cursos al montar
  useEffect(() => {
    loadConfig();
    loadCursos();
  }, [userProfile]);

  // Cargar estudiantes cuando cambia el curso
  useEffect(() => {
    if (selectedCurso) {
      loadEstudiantes();
      loadUnidades();
      loadCriterios();
      loadCalificaciones();
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

      // Use CockroachDB for students
      const estudiantesQuery = 'SELECT * FROM estudiantes WHERE grupo_id = $1 ORDER BY num_orden';
      const estudiantesResult = await cockroachClient.query(estudiantesQuery, [curso.grupo_id]);
      setEstudiantes(estudiantesResult.rows || []);
    } catch (error) {
      console.error('Error:', error);
      setEstudiantes([]);
    }
  };

  const loadUnidades = async () => {
    try {
      const { data, error } = await supabase.from('unidades').select('*').eq('curso_id', selectedCurso).order('created_at');
      if (error) throw error;
      setUnidades(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCriterios = async () => {
    try {
      const { data, error } = await supabase.from('criterios').select('*').eq('curso_id', selectedCurso).order('orden');
      if (error) throw error;
      setCriterios(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadCalificaciones = async () => {
    try {
      const { data, error } = await supabase.from('calificaciones').select('*').eq('curso_id', selectedCurso);
      if (error) throw error;
      const calificacionesMap = {};
      (data || []).forEach(cal => {
        const criterioObj = criterios.find(c => c.id === cal.criterio_id);
        const unidadIdFromCriterio = criterioObj?.unidad_id;
        const key = `${cal.estudiante_id}-${unidadIdFromCriterio}-${cal.criterio_id}`;
        calificacionesMap[key] = cal;
      });
      setCalificaciones(calificacionesMap);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Recargar calificaciones cuando cambien los criterios
  useEffect(() => {
    if (selectedCurso && criterios.length > 0) {
      loadCalificaciones();
    }
  }, [criterios]);

  const handleGenerarReporteOficial = async () => {
    if (!selectedCurso) {
      setMessage({ type: 'error', text: '❌ Selecciona un curso' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      // 1. Obtener datos del curso
      const curso = cursos.find(c => c.id === selectedCurso);

      // 2. Obtener estudiantes del curso using CockroachDB
      const estudiantesQuery = 'SELECT * FROM estudiantes WHERE grupo_id = $1 ORDER BY num_orden';
      const estudiantesResult = await cockroachClient.query(estudiantesQuery, [curso.grupo_id]);
      const estudiantesCurso = estudiantesResult.rows;

      // 3. Determinar si es primaria o secundaria
      const isPrimary = curso.grupos.nivel === 'Primario';
      const competencias = isPrimary ? ['C1', 'C2', 'C3'] : ['C1', 'C2', 'C3', 'C4'];
      console.log('Competencias:', competencias);

      // 4. Obtener calificaciones de recuperación
      const { data: recuperaciones } = await supabase
        .from('recuperaciones_competencias')
        .select('*')
        .eq('curso_id', selectedCurso);

      const recuperacionesMap = {};
      (recuperaciones || []).forEach(rec => {
        const key = `${rec.estudiante_id}-${rec.periodo}-${rec.competencia_grupo}-${rec.tipo}`;
        recuperacionesMap[key] = rec.calificacion;
      });

      // 5. Obtener todas las calificaciones del curso para cálculos eficientes
      const { data: allCalificaciones } = await supabase
        .from('calificaciones')
        .select('*, criterios(unidad_id, competencia_grupo, periodo)')
        .eq('curso_id', selectedCurso);

      // Crear mapa de calificaciones por estudiante, unidad y criterio
      const calificacionesMap = {};
      (allCalificaciones || []).forEach(cal => {
        const key = `${cal.estudiante_id}-${cal.criterios.unidad_id}-${cal.criterio_id}`;
        if (!calificacionesMap[key]) {
          calificacionesMap[key] = [];
        }
        calificacionesMap[key].push(cal);
      });

      // 6. Calcular promedios por período para cada estudiante
      const estudiantesConDatos = estudiantesCurso.map(estudiante => {
        const periodosData = {};

        for (let periodo = 1; periodo <= 3; periodo++) {
          const periodoKey = `P${periodo}`;
          const competenciasPeriodo = {};

          competencias.forEach(comp => {
            // Calcular promedio de la competencia en este período
            const compValue = calcularCompetenciasPeriodoOficial(estudiante.id, periodo, comp, calificacionesMap, unidades, criterios);
            competenciasPeriodo[comp] = compValue;
          });

          periodosData[periodoKey] = competenciasPeriodo;
        }

        // Calcular finales con recuperaciones
        const finales = {};
        competencias.forEach(comp => {
          let sum = 0;
          let count = 0;

          for (let periodo = 1; periodo <= 3; periodo++) {
            const periodoKey = `P${periodo}`;
            const recoveryKey = `${estudiante.id}-${periodo}-${comp}-periodo`;
            const recovery = recuperacionesMap[recoveryKey];

            const value = recovery !== undefined ? recovery : periodosData[periodoKey][comp];
            if (value > 0) {
              sum += value;
              count++;
            }
          }

          finales[comp] = count > 0 ? sum / count : 0;
        });

        // Calificación final (promedio de competencias finales)
        const calificacionFinal = competencias.reduce((sum, comp) => sum + finales[comp], 0) / competencias.length;

        return {
          ...estudiante,
          periodos: periodosData,
          finales,
          calificacionFinal,
          recuperaciones: recuperacionesMap
        };
      });

      setReporteOficialData({
        curso,
        estudiantes: estudiantesConDatos,
        competencias,
        isPrimary
      });

      setMessage({ type: 'success', text: '✅ Reporte oficial generado' });
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ Error al generar reporte oficial' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarReporteUnidad = async () => {
    if (!selectedCurso || !selectedUnidad) {
      setMessage({ type: 'error', text: '❌ Selecciona curso y unidad' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      // 1. Obtener datos del curso y unidad
      const curso = cursos.find(c => c.id === selectedCurso);
      const unidad = unidades.find(u => u.id === selectedUnidad);

      // 2. Obtener criterios de la unidad
      const { data: criterios } = await supabase
        .from('criterios')
        .select('*')
        .eq('unidad_id', selectedUnidad)
        .order('orden');

      // 3. Obtener estudiantes del curso using CockroachDB
      const estudiantesQuery = 'SELECT * FROM estudiantes WHERE grupo_id = $1 ORDER BY num_orden';
      const estudiantesResult = await cockroachClient.query(estudiantesQuery, [curso.grupo_id]);
      const estudiantesCurso = estudiantesResult.rows;

      // 4. Obtener calificaciones de todos los estudiantes para esta unidad
      const { data: calificaciones } = await supabase
        .from('calificaciones')
        .select('*')
        .in('estudiante_id', estudiantesCurso.map(e => e.id))
        .in('criterio_id', criterios.map(c => c.id));

      // 5. Construir objeto de reporte por unidad
      setReporteUnidadData({
        curso,
        unidad,
        criterios: criterios || [],
        estudiantes: estudiantesCurso || [],
        calificaciones: calificaciones || []
      });

      setMessage({ type: 'success', text: '✅ Reporte de unidad generado' });
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: '❌ Error al generar reporte de unidad' });
    } finally {
      setLoading(false);
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

          // Obtener calificaciones del estudiante en esta unidad con filtro de período
          let queryCalificaciones = supabase
            .from('calificaciones')
            .select('*')
            .eq('estudiante_id', selectedEstudiante);
          if (selectedPeriodo !== 'Anual') {
            const periodoMap = { '1er Período': 'P1', '2do Período': 'P2', '3er Período': 'P3' };
            queryCalificaciones = queryCalificaciones.eq('periodo', periodoMap[selectedPeriodo]);
          } else {
            // Para "Anual", incluir todos los períodos
            queryCalificaciones = queryCalificaciones.in('periodo', ['P1', 'P2', 'P3']);
          }
          const { data: calificaciones } = await queryCalificaciones;

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
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing');
    }, 1000);
  };

  const exportToPDFOficial = async () => {
    try {
      const element = document.querySelector('.reporte-oficial');
      if (!element) {
        alert('No hay reporte oficial para exportar');
        return;
      }

      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      // Temporarily adjust styles for PDF generation
      const originalStyle = element.style.cssText;
      element.style.width = '100%';
      element.style.maxWidth = 'none';
      element.style.transform = 'scale(0.8)';
      element.style.transformOrigin = 'top left';

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight
      });

      // Restore original styles
      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'letter');

      const imgWidth = 279.4;
      const pageHeight = 215.9;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, Math.min(imgHeight, pageHeight));
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, Math.min(pageHeight, heightLeft));
        heightLeft -= pageHeight;
      }

      pdf.save(`reporte_oficial_${reporteOficialData.curso.asignaturas.nombre}.pdf`);
    } catch (error) {
      console.error('Error generando PDF oficial:', error);
      alert('Error al generar PDF oficial');
    }
  };

  const exportToPDF = async () => {
    try {
      // Usar html2canvas y jsPDF para generar PDF
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const element = document.querySelector('.reporte-unidad');
      if (!element) {
        alert('No hay reporte para exportar');
        return;
      }

      // Crear un contenedor temporal solo con el contenido del reporte
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = element.innerHTML;
      tempContainer.style.width = element.scrollWidth + 'px';
      tempContainer.style.height = 'auto'; // Permitir altura automática
      tempContainer.style.background = 'white';
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.padding = '0.5rem';
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Remover el contenedor temporal
      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'letter'); // landscape, millimeters, letter size

      const imgWidth = 279.4; // letter width in mm (11 inches)
      const pageHeight = 215.9; // letter height in mm (8.5 inches)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Primera página
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, Math.min(imgHeight, pageHeight));
      heightLeft -= pageHeight;

      // Páginas adicionales si es necesario
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, Math.min(pageHeight, heightLeft));
        heightLeft -= pageHeight;
      }

      pdf.save(`reporte_unidad_${reporteUnidadData.unidad.nombre}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar PDF');
    }
  };

  const calcularTotalCompetencia = (unidad, competencia) => {
    const criteriosComp = unidad.criterios.filter(c => c.competencia_grupo === competencia);
    let total = 0;
    let count = 0;

    criteriosComp.forEach(criterio => {
      const cal = unidad.calificaciones.find(c => c.criterio_id === criterio.id);
      if (cal && cal.calificacion != null) {
        total += parseFloat(cal.calificacion);
        count++;
      }
    });

    // Retornar promedio si hay calificaciones, sino 0
    return count > 0 ? total / count : 0;
  };

  const calcularCompetenciasPeriodo = (estudianteId, periodo) => {
    const unidadesPeriodo = unidades.filter(u => u.periodo == periodo);
    const competencias = {};
    ['C1','C2','C3','C4'].forEach(comp => competencias[comp] = []);
    unidadesPeriodo.forEach(unidad => {
      const compUnidad = calcularCompetenciasUnidad(estudianteId, unidad.id);
      ['C1','C2','C3','C4'].forEach(comp => {
        if (compUnidad[comp] > 0) competencias[comp].push(compUnidad[comp]);
      });
    });
    const promedios = {};
    ['C1','C2','C3','C4'].forEach(comp => {
      const vals = competencias[comp];
      promedios[comp] = vals.length > 0 ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
    });
    return promedios;
  };

  const calcularCompetenciasPeriodoOficial = (estudianteId, periodo, competencia, calificacionesMap, unidades, criterios) => {
    const unidadesPeriodo = unidades.filter(u => u.periodo == periodo);
    const valoresCompetencia = [];

    unidadesPeriodo.forEach(unidad => {
      const criteriosCompetencia = criterios.filter(c => c.unidad_id === unidad.id && c.competencia_grupo === competencia);
      let totalCompetencia = 0;
      let countCompetencia = 0;

      criteriosCompetencia.forEach(criterio => {
        const key = `${estudianteId}-${unidad.id}-${criterio.id}`;
        const calificacionesCriterio = calificacionesMap[key] || [];
        calificacionesCriterio.forEach(cal => {
          if (cal.calificacion != null) {
            totalCompetencia += parseFloat(cal.calificacion);
            countCompetencia++;
          }
        });
      });

      if (countCompetencia > 0) {
        valoresCompetencia.push(totalCompetencia / countCompetencia);
      }
    });

    return valoresCompetencia.length > 0 ? valoresCompetencia.reduce((a,b)=>a+b,0) / valoresCompetencia.length : 0;
  };

  const calcularCompetenciasUnidad = (estudianteId, unidadId) => {
    const competencias = {};
    ['C1','C2','C3','C4'].forEach(comp => competencias[comp] = 0);
    const criteriosUnidad = criterios.filter(c => c.unidad_id === unidadId);

    ['C1','C2','C3','C4'].forEach(comp => {
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
        competencias[comp] = tipoCalculo === 'promedio' ? (totalComp / contadorComp) : totalComp;
      }
    });

    return competencias;
  };

  const calcularTotalGeneral = (competencia) => {
    if (!reporteData) return 0;
    let total = 0;
    let count = 0;
    reporteData.unidades.forEach(unidad => {
      const compValue = calcularTotalCompetencia(unidad, competencia);
      if (compValue > 0) {
        total += compValue;
        count++;
      }
    });
    // Retornar promedio de las competencias por unidad en el período
    return count > 0 ? total / count : 0;
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

        {/* Sección de Reporte Individual */}
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #e1e8ed', borderRadius: '8px' }}>
          <h3 style={{ color: '#667eea', marginBottom: '1rem' }}>📊 Reporte Individual por Estudiante</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📚 Curso</label>
              <select value={selectedCurso} onChange={(e) => { setSelectedCurso(e.target.value); setSelectedEstudiante(''); setSelectedUnidad(''); setReporteData(null); setReporteUnidadData(null); }} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
                <option value="">Seleccione...</option>
                {cursos.map(curso => <option key={curso.id} value={curso.id}>{curso.asignaturas.nombre} - {curso.grupos.grado}° {curso.grupos.seccion}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>🎓 Estudiante</label>
              <select value={selectedEstudiante} onChange={(e) => { setSelectedEstudiante(e.target.value); setReporteData(null); }} disabled={!selectedCurso} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
                <option value="">Seleccione...</option>
                {estudiantes.map(est => <option key={est.id} value={est.id}>{est.num_orden}. {est.nombre_completo}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📅 Período</label>
              <select value={selectedPeriodo} onChange={(e) => { setSelectedPeriodo(e.target.value); setReporteData(null); }} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
                {periodos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>🔢 Decimales</label>
              <select value={decimales} onChange={(e) => setDecimales(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
                <option value="0">0 decimales</option>
                <option value="1">1 decimal</option>
                <option value="2">2 decimales</option>
              </select>
            </div>
          </div>

          <button onClick={handleGenerarReporte} disabled={loading || !selectedCurso || !selectedEstudiante} style={{ padding: '0.75rem 2rem', background: loading || !selectedCurso || !selectedEstudiante ? '#999' : '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: loading || !selectedCurso || !selectedEstudiante ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '1rem' }}>
            {loading ? 'Generando...' : '📊 Generar Reporte Individual'}
          </button>
        </div>


        {/* Sección de Reporte Oficial */}
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #17a2b8', borderRadius: '8px' }}>
          <h3 style={{ color: '#17a2b8', marginBottom: '1rem' }}>📊 Reporte Oficial de Evaluación</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📚 Curso</label>
              <select value={selectedCurso} onChange={(e) => { setSelectedCurso(e.target.value); setSelectedEstudiante(''); setSelectedUnidad(''); setReporteData(null); setReporteUnidadData(null); setReporteOficialData(null); }} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
                <option value="">Seleccione...</option>
                {cursos.map(curso => <option key={curso.id} value={curso.id}>{curso.asignaturas.nombre} - {curso.grupos.grado}° {curso.grupos.seccion}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #17a2b8' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#17a2b8' }}>💡 Información sobre Recuperaciones</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
              Las recuperaciones se aplican automáticamente cuando existen notas guardadas en la tabla <code>recuperaciones_competencias</code>.
              Los tipos de recuperación son: <strong>RC1, RC2, RC3</strong> (para primaria) y <strong>RC1, RC2, RC3, RCa</strong> (para secundaria).
              Estas notas reemplazan los valores originales de las competencias en los cálculos finales.
            </p>
          </div>

          <button onClick={handleGenerarReporteOficial} disabled={loading || !selectedCurso} style={{ padding: '0.75rem 2rem', background: loading || !selectedCurso ? '#999' : '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: loading || !selectedCurso ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '1rem' }}>
            {loading ? 'Generando...' : '📊 Generar Reporte Oficial'}
          </button>
        </div>

        {/* Sección de Reporte por Unidad */}
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #28a745', borderRadius: '8px' }}>
          <h3 style={{ color: '#28a745', marginBottom: '1rem' }}>📋 Reporte por Unidad (Todos los Estudiantes)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📚 Curso</label>
              <select value={selectedCurso} onChange={(e) => { setSelectedCurso(e.target.value); setSelectedEstudiante(''); setSelectedUnidad(''); setReporteData(null); setReporteUnidadData(null); setReporteOficialData(null); }} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
                <option value="">Seleccione...</option>
                {cursos.map(curso => <option key={curso.id} value={curso.id}>{curso.asignaturas.nombre} - {curso.grupos.grado}° {curso.grupos.seccion}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>📖 Unidad</label>
              <select value={selectedUnidad} onChange={(e) => { setSelectedUnidad(e.target.value); setReporteUnidadData(null); }} disabled={!selectedCurso} style={{ width: '100%', padding: '0.75rem', border: '2px solid #e1e8ed', borderRadius: '8px', fontSize: '1rem' }}>
                <option value="">Seleccione...</option>
                {unidades.map(unidad => <option key={unidad.id} value={unidad.id}>{unidad.nombre}</option>)}
              </select>
            </div>
          </div>

          <button onClick={handleGenerarReporteUnidad} disabled={loading || !selectedCurso || !selectedUnidad} style={{ padding: '0.75rem 2rem', background: loading || !selectedCurso || !selectedUnidad ? '#999' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: loading || !selectedCurso || !selectedUnidad ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '1rem' }}>
            {loading ? 'Generando...' : '📋 Generar Reporte por Unidad'}
          </button>
        </div>

        {reporteData && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={handleImprimir} style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
              🖨️ Imprimir
            </button>
            <button onClick={exportToPDF} style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
              📄 Exportar PDF
            </button>
          </div>
        )}

        {reporteOficialData && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => window.print()} style={{ padding: '0.5rem 1rem', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
              🖨️ Imprimir Reporte Oficial
            </button>
            <button onClick={() => exportToPDFOficial()} style={{ padding: '0.5rem 1rem', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
              📄 Exportar PDF Oficial
            </button>
          </div>
        )}

        {/* Botones para Reporte por Unidad */}
        {reporteUnidadData && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => window.print()} style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
              🖨️ Imprimir Reporte por Unidad
            </button>
            <button onClick={exportToPDF} style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
              📄 Exportar PDF
            </button>
          </div>
        )}
      </div>

      {/* Reporte por Unidad (se imprime) */}
      {reporteUnidadData && (
        <div className="reporte-unidad print-only" style={{ background: 'white', padding: '0.5rem', width: 'fit-content', margin: '0 auto 2rem', pageBreakInside: 'avoid' }}>
          {/* Header compacto del reporte por unidad */}
          <div style={{ textAlign: 'center', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '2px solid #28a745' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#28a745', marginBottom: '0.25rem' }}>
              REPORTE DE CALIFICACIONES POR UNIDAD
            </div>
            <div style={{ fontSize: '12px', color: '#333' }}>
              {reporteUnidadData.curso.asignaturas.nombre} - {reporteUnidadData.curso.grupos.grado}° {reporteUnidadData.curso.grupos.seccion} | Unidad: {reporteUnidadData.unidad.nombre}
            </div>
          </div>

          {/* Tabla de calificaciones por unidad */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #28a745', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#28a745', color: 'white' }}>
                <th style={{ padding: '0.75rem', border: '1px solid #fff', textAlign: 'left', minWidth: '200px' }}>Estudiante</th>
                {reporteUnidadData.criterios.map(criterio => (
                  <th key={criterio.id} style={{ padding: '0.75rem', border: '1px solid #fff', textAlign: 'center', minWidth: '80px', fontSize: '0.8rem' }}>
                    {criterio.nombre}
                    <br />
                    <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>({criterio.valor_maximo}pts)</span>
                  </th>
                ))}
                <th style={{ padding: '0.75rem', border: '1px solid #fff', textAlign: 'center', minWidth: '80px', background: '#1976d2', fontWeight: 'bold' }}>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {reporteUnidadData.estudiantes.map(estudiante => {
                const calificacionesEstudiante = reporteUnidadData.calificaciones.filter(cal => cal.estudiante_id === estudiante.id);
                const calificacionesValidas = calificacionesEstudiante.filter(cal => cal.calificacion != null);
                const total = calificacionesValidas.length > 0
                  ? calificacionesValidas.reduce((sum, cal) => sum + cal.calificacion, 0) / calificacionesValidas.length
                  : 0;

                return (
                  <tr key={estudiante.id} style={{ background: estudiante.num_orden % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={{ padding: '0.75rem', border: '1px solid #dee2e6', fontWeight: '600' }}>
                      {estudiante.num_orden}. {estudiante.nombre_completo}
                    </td>
                    {reporteUnidadData.criterios.map(criterio => {
                      const cal = calificacionesEstudiante.find(c => c.criterio_id === criterio.id);
                      return (
                        <td key={criterio.id} style={{ padding: '0.75rem', border: '1px solid #dee2e6', textAlign: 'center' }}>
                          {cal ? cal.calificacion?.toFixed(parseInt(decimales)) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ padding: '0.75rem', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd' }}>
                      {total.toFixed(parseInt(decimales))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer compacto */}
          <div style={{ marginTop: '0.5rem', textAlign: 'center', color: '#666', fontSize: '8px', borderTop: '1px solid #28a745', paddingTop: '0.25rem' }}>
            Generado el {new Date().toLocaleDateString('es-DO')} | SIGCE
          </div>
        </div>
      )}

      {/* Reporte Oficial (se imprime) */}
      {reporteOficialData && (
        <div className="reporte-oficial print-only" style={{ background: 'white', padding: '0.2rem', width: 'fit-content', margin: '0 auto 1rem', pageBreakInside: 'avoid', maxWidth: '100%', overflow: 'hidden' }}>
          {/* Header del reporte oficial */}
          <div style={{ textAlign: 'center', marginBottom: '0.3rem', paddingBottom: '0.3rem', borderBottom: '2px solid #17a2b8' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#17a2b8', marginBottom: '0.15rem' }}>
              REPORTE OFICIAL DE EVALUACIÓN
            </div>
            <div style={{ fontSize: '10px', color: '#333' }}>
              {reporteOficialData.curso.asignaturas.nombre} - {reporteOficialData.curso.grupos.grado}° {reporteOficialData.curso.grupos.seccion}
            </div>
          </div>

          {/* Tabla del reporte oficial */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #17a2b8', fontSize: '0.65rem', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#17a2b8', color: 'white' }}>
                <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'left', width: '140px', fontSize: '0.6rem' }}>Estudiante</th>
                {reporteOficialData.competencias.map(comp => (
                  <React.Fragment key={comp}>
                    <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '45px', fontSize: '0.55rem' }}>
                      {comp} P1
                    </th>
                    <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '45px', background: '#ffc107', color: '#333', fontSize: '0.55rem' }}>
                      RC{comp} P1
                    </th>
                  </React.Fragment>
                ))}
                {reporteOficialData.competencias.map(comp => (
                  <React.Fragment key={`${comp}-p2`}>
                    <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '45px', fontSize: '0.55rem' }}>
                      {comp} P2
                    </th>
                    <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '45px', background: '#ffc107', color: '#333', fontSize: '0.55rem' }}>
                      RC{comp} P2
                    </th>
                  </React.Fragment>
                ))}
                {reporteOficialData.competencias.map(comp => (
                  <React.Fragment key={`${comp}-p3`}>
                    <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '45px', fontSize: '0.55rem' }}>
                      {comp} P3
                    </th>
                    <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '45px', background: '#ffc107', color: '#333', fontSize: '0.55rem' }}>
                      RC{comp} P3
                    </th>
                  </React.Fragment>
                ))}
                {reporteOficialData.competencias.map(comp => (
                  <th key={`${comp}-final`} style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '50px', background: '#0066cc', fontSize: '0.55rem' }}>
                    {comp} Final
                  </th>
                ))}
                <th style={{ padding: '0.3rem', border: '1px solid #fff', textAlign: 'center', width: '55px', background: '#28a745', fontWeight: 'bold', fontSize: '0.55rem' }}>
                  Nota Final
                </th>
              </tr>
            </thead>
            <tbody>
              {reporteOficialData.estudiantes.map(estudiante => (
                <tr key={estudiante.id} style={{ background: estudiante.num_orden % 2 === 0 ? '#f8f9fa' : 'white' }}>
                  <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', fontWeight: '600', fontSize: '0.55rem', lineHeight: '1.1' }}>
                    {estudiante.num_orden}. {estudiante.nombre_completo}
                  </td>

                  {/* Período 1 con recuperaciones */}
                  {reporteOficialData.competencias.map(comp => {
                    const recoveryKey = `${estudiante.id}-1-${comp}-periodo`;
                    const recoveryValue = estudiante.recuperaciones[recoveryKey];
                    return (
                      <React.Fragment key={`${comp}-p1-group`}>
                        <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', fontSize: '0.5rem' }}>
                          {estudiante.periodos.P1[comp]?.toFixed(1) || '-'}
                        </td>
                        <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', background: recoveryValue !== undefined ? '#fff3cd' : 'transparent', fontWeight: recoveryValue !== undefined ? 'bold' : 'normal', fontSize: '0.5rem' }}>
                          {recoveryValue !== undefined ? recoveryValue.toFixed(1) : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Período 2 con recuperaciones */}
                  {reporteOficialData.competencias.map(comp => {
                    const recoveryKey = `${estudiante.id}-2-${comp}-periodo`;
                    const recoveryValue = estudiante.recuperaciones[recoveryKey];
                    return (
                      <React.Fragment key={`${comp}-p2-group`}>
                        <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', fontSize: '0.5rem' }}>
                          {estudiante.periodos.P2[comp]?.toFixed(1) || '-'}
                        </td>
                        <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', background: recoveryValue !== undefined ? '#fff3cd' : 'transparent', fontWeight: recoveryValue !== undefined ? 'bold' : 'normal', fontSize: '0.5rem' }}>
                          {recoveryValue !== undefined ? recoveryValue.toFixed(1) : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Período 3 con recuperaciones */}
                  {reporteOficialData.competencias.map(comp => {
                    const recoveryKey = `${estudiante.id}-3-${comp}-periodo`;
                    const recoveryValue = estudiante.recuperaciones[recoveryKey];
                    return (
                      <React.Fragment key={`${comp}-p3-group`}>
                        <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', fontSize: '0.5rem' }}>
                          {estudiante.periodos.P3[comp]?.toFixed(1) || '-'}
                        </td>
                        <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', background: recoveryValue !== undefined ? '#fff3cd' : 'transparent', fontWeight: recoveryValue !== undefined ? 'bold' : 'normal', fontSize: '0.5rem' }}>
                          {recoveryValue !== undefined ? recoveryValue.toFixed(1) : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Finales */}
                  {reporteOficialData.competencias.map(comp => (
                    <td key={`${comp}-final`} style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '0.5rem' }}>
                      {estudiante.finales[comp]?.toFixed(1) || '-'}
                    </td>
                  ))}

                  {/* Nota Final */}
                  <td style={{ padding: '0.2rem', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', background: '#d4edda', fontSize: '0.6rem' }}>
                    {estudiante.calificacionFinal?.toFixed(1) || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer del reporte oficial */}
          <div style={{ marginTop: '0.3rem', textAlign: 'center', color: '#666', fontSize: '6px', borderTop: '1px solid #17a2b8', paddingTop: '0.15rem' }}>
            Generado el {new Date().toLocaleDateString('es-DO')} | Sistema SIGCE - Reporte Oficial
          </div>
        </div>
      )}

      {/* Boletín Individual (se imprime) */}
      {reporteData && (
        <div className="boletin print-only" style={{ background: 'white', padding: '1rem', maxWidth: '100%', margin: '0 auto' }}>
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
                <p style={{ margin: '0.25rem 0 0 0' }}>{reporteData.estudiante.nombre_completo}</p>
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

          {/* Calificaciones por período con recuperaciones */}
          <div style={{ marginBottom: '2rem', pageBreakInside: 'avoid' }}>
            <h3 style={{ background: '#28a745', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px 8px 0 0', margin: 0 }}>
              Calificaciones por Período
            </h3>
            <div style={{ border: '1px solid #dee2e6', borderTop: 'none', padding: '1rem' }}>
              {['P1', 'P2', 'P3'].map(periodo => {
                const periodoNombre = periodo === 'P1' ? '1er Período' : periodo === 'P2' ? '2do Período' : '3er Período';
                const competenciasPeriodo = calcularCompetenciasPeriodo(reporteData.estudiante.id, periodo.replace('P', ''));

                return (
                  <div key={periodo} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#28a745', borderBottom: '2px solid #28a745', paddingBottom: '0.5rem' }}>
                      {periodoNombre}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      {['C1', 'C2', 'C3', 'C4'].map(comp => {
                        const valorOriginal = competenciasPeriodo[comp] || 0;
                        const recoveryKey = `${reporteData.estudiante.id}-${periodo.replace('P', '')}-${comp}-periodo`;
                        const valorRecuperacion = recuperaciones[recoveryKey];
                        const valorFinal = valorRecuperacion !== undefined ? valorRecuperacion : valorOriginal;

                        return (
                          <div key={comp} style={{ background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>{comp}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', color: '#666' }}>Original:</span>
                              <span style={{ fontWeight: '600' }}>{valorOriginal.toFixed(1)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', color: '#856404' }}>Recuperación:</span>
                              <span style={{ fontWeight: '600', color: valorRecuperacion !== undefined ? '#856404' : '#999' }}>
                                {valorRecuperacion !== undefined ? valorRecuperacion.toFixed(1) : '-'}
                              </span>
                            </div>
                            <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '0.5rem', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.8rem', color: '#28a745', marginBottom: '0.25rem' }}>Final</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#28a745' }}>{valorFinal.toFixed(1)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
                                    {criterio.competencia_grupo === comp ? (cal ? cal.calificacion.toFixed(parseInt(decimales)) : '-') : ''}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                          <tr style={{ background: '#e3f2fd', fontWeight: '600' }}>
                            <td style={{ padding: '0.75rem', borderRight: '1px solid #dee2e6' }}>Total por Competencia</td>
                            {competencias.map(comp => (
                              <td key={comp} style={{ padding: '0.75rem', textAlign: 'center', borderRight: '1px solid #dee2e6', color: '#1976d2', fontSize: '1.1rem' }}>
                                {calcularTotalCompetencia(unidad, comp).toFixed(parseInt(decimales))}
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
                          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#28a745' }}>{total.toFixed(parseInt(decimales))}</div>
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
          body {
            margin: 0;
            padding: 0;
            font-size: 12px;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 9999;
            background: white;
            page-break-inside: avoid;
          }
          .print-only button {
            display: none !important;
          }
          body.printing .no-print {
            display: none !important;
          }
          body.printing .print-only {
            position: static !important;
            width: auto !important;
            height: auto !important;
          }
          .boletin, .reporte-unidad {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0.5cm !important;
            width: 100% !important;
            max-width: none !important;
          }
          .reporte-unidad table {
            font-size: 8px !important;
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            margin: 0 auto !important;
          }
          .reporte-unidad th, .reporte-unidad td {
            padding: 1px 2px !important;
            border: 1px solid #000 !important;
            text-align: center !important;
          }
          .reporte-unidad th {
            font-size: 7px !important;
            font-weight: bold !important;
            background: #f0f0f0 !important;
            color: #000 !important;
            padding: 3px 2px !important;
          }
          .reporte-oficial th {
            font-size: 5px !important;
            font-weight: bold !important;
            background: #f0f0f0 !important;
            color: #000 !important;
            padding: 2px 1px !important;
            line-height: 1.1 !important;
          }
          .reporte-oficial td {
            font-size: 4px !important;
            padding: 1px !important;
            line-height: 1.1 !important;
          }
          .reporte-unidad td:first-child {
            text-align: left !important;
            font-weight: bold !important;
          }
          .boletin {
            font-size: 11px !important;
          }
          .boletin h1 { font-size: 18px !important; }
          .boletin h2 { font-size: 16px !important; }
          .boletin h3 { font-size: 14px !important; }
          @page {
            size: letter landscape;
            margin: 0.3cm;
          }
        }
        @media screen {
          .print-only {
            display: block !important;
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