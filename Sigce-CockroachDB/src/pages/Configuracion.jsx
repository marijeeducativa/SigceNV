import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function Configuracion() {
  const [config, setConfig] = useState({
    nombre_centro: '',
    codigo_sigerd: '',
    anio_lectivo: '',
    redondeo_decimales: 0,
    logo_url: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      setMessage({
        type: 'error',
        text: 'Error al cargar la configuración: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const { error } = await supabase
        .from('config')
        .update({
          nombre_centro: config.nombre_centro,
          codigo_sigerd: config.codigo_sigerd,
          anio_lectivo: config.anio_lectivo,
          redondeo_decimales: parseInt(config.redondeo_decimales),
          logo_url: config.logo_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: '✅ Configuración guardada exitosamente'
      });

      await loadConfig();
    } catch (error) {
      console.error('Error guardando configuración:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al guardar: ' + error.message
      });
    } finally {
      setSaving(false);
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
        <p>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      padding: '2rem',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
          ⚙️ Configuración del Centro Educativo
        </h1>
        <p style={{ color: '#666' }}>
          Gestiona la información general del centro educativo
        </p>
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

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
            Nombre del Centro Educativo *
          </label>
          <input
            type="text"
            name="nombre_centro"
            value={config.nombre_centro}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '1rem'
            }}
            placeholder="Ej: Centro Educativo Santa María"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
            Código SIGERD
          </label>
          <input
            type="text"
            name="codigo_sigerd"
            value={config.codigo_sigerd || ''}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '1rem'
            }}
            placeholder="Ej: 12345"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
            Año Lectivo *
          </label>
          <input
            type="text"
            name="anio_lectivo"
            value={config.anio_lectivo}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '1rem'
            }}
            placeholder="Ej: 2024-2025"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
            Política de Redondeo
          </label>
          <select
            name="redondeo_decimales"
            value={config.redondeo_decimales}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            <option value="0">Sin decimales</option>
            <option value="1">1 decimal</option>
            <option value="2">2 decimales</option>
          </select>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
            URL del Logo Institucional
          </label>
          <input
            type="url"
            name="logo_url"
            value={config.logo_url || ''}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '1rem'
            }}
            placeholder="https://ejemplo.com/logo.png"
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', borderTop: '2px solid #f0f0f0', paddingTop: '1.5rem' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1,
              padding: '0.75rem 2rem',
              background: saving ? '#999' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '💾 Guardando...' : '💾 Guardar Cambios'}
          </button>

          <button
            type="button"
            onClick={loadConfig}
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            🔄 Recargar
          </button>
        </div>
      </form>
    </div>
  );
}

export default Configuracion;