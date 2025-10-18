import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    nombre_completo: '',
    email: '',
    password: '',
    rol: 'Profesor'
  });

  // Cargar usuarios al montar
  useEffect(() => {
    loadUsuarios();
  }, []);

  // Función para cargar usuarios
  const loadUsuarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setMessage({ type: 'error', text: 'Error al cargar usuarios' });
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal para crear
  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      nombre_completo: '',
      email: '',
      password: '',
      rol: 'Profesor'
    });
    setShowModal(true);
    setMessage({ type: '', text: '' });
  };

  // Abrir modal para editar
  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      nombre_completo: user.nombre_completo,
      email: user.email,
      password: '', // No mostramos la contraseña
      rol: user.rol
    });
    setShowModal(true);
    setMessage({ type: '', text: '' });
  };

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Guardar usuario (crear o editar)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      if (editingUser) {
        // EDITAR usuario existente
        const { error } = await supabase
          .from('usuarios')
          .update({
            nombre_completo: formData.nombre_completo,
            email: formData.email,
            rol: formData.rol,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id);

        if (error) throw error;

        // Si cambió la contraseña, actualizarla en Auth
        if (formData.password) {
          // Nota: Esto requeriría una función de servidor
          // Por ahora, solo actualizamos la tabla
          console.log('Actualización de contraseña requiere función de servidor');
        }

        setMessage({ type: 'success', text: '✅ Usuario actualizado correctamente' });
      } else {
        // CREAR nuevo usuario
        
        // 1. Crear en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true
        });

        if (authError) throw authError;

        // 2. Crear en la tabla usuarios
        const { error: dbError } = await supabase
          .from('usuarios')
          .insert({
            id: authData.user.id,
            nombre_completo: formData.nombre_completo,
            email: formData.email,
            rol: formData.rol
          });

        if (dbError) throw dbError;

        setMessage({ type: 'success', text: '✅ Usuario creado correctamente' });
      }

      // Recargar lista y cerrar modal
      await loadUsuarios();
      setShowModal(false);
      
    } catch (error) {
      console.error('Error guardando usuario:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error: ' + error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  // Eliminar usuario
  const handleDelete = async (user) => {
    if (!confirm(`¿Estás seguro de eliminar a ${user.nombre_completo}?`)) {
      return;
    }

    try {
      setLoading(true);

      // Eliminar de la tabla usuarios (Auth se elimina automáticamente por CASCADE)
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: '✅ Usuario eliminado' });
      await loadUsuarios();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      setMessage({ type: 'error', text: '❌ Error al eliminar usuario' });
    } finally {
      setLoading(false);
    }
  };

  // RENDER
  if (loading && usuarios.length === 0) {
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
        <p>Cargando usuarios...</p>
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
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        borderBottom: '2px solid #667eea',
        paddingBottom: '1rem'
      }}>
        <div>
          <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
            👥 Gestión de Usuarios
          </h1>
          <p style={{ color: '#666', margin: 0 }}>
            Administra profesores y administradores del sistema
          </p>
        </div>
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
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>➕</span>
          Nuevo Usuario
        </button>
      </div>

      {/* Mensajes */}
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

      {/* Tabla de usuarios */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '0.95rem'
        }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>
                Nombre Completo
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>
                Email
              </th>
              <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>
                Rol
              </th>
              <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', width: '200px' }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: '#999' 
                }}>
                  No hay usuarios registrados
                </td>
              </tr>
            ) : (
              usuarios.map((user) => (
                <tr 
                  key={user.id} 
                  style={{ 
                    borderBottom: '1px solid #dee2e6',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                >
                  <td style={{ padding: '1rem' }}>
                    <strong>{user.nombre_completo}</strong>
                  </td>
                  <td style={{ padding: '1rem', color: '#666' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      background: user.rol === 'Administrador' ? '#e3f2fd' : '#f3e5f5',
                      color: user.rol === 'Administrador' ? '#1976d2' : '#7b1fa2'
                    }}>
                      {user.rol}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleEdit(user)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#ffc107',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Crear/Editar */}
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
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>
              {editingUser ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  name="nombre_completo"
                  value={formData.nombre_completo}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={editingUser} // No se puede cambiar el email al editar
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    background: editingUser ? '#f5f5f5' : 'white'
                  }}
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Contraseña {editingUser ? '(dejar vacío para no cambiar)' : '*'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!editingUser}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                  placeholder="••••••••"
                  minLength="6"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Rol *
                </label>
                <select
                  name="rol"
                  value={formData.rol}
                  onChange={handleChange}
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
                  <option value="Profesor">Profesor</option>
                  <option value="Administrador">Administrador</option>
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
                    fontSize: '1rem',
                    fontWeight: '600',
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
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;