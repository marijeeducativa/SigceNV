import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function Usuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre_completo: '',
    email: '',
    password: '',
    rol: 'Profesor'
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setMessage({ type: 'error', text: 'Error al cargar usuarios: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('🔄 Iniciando handleSubmit...');
    console.log('📝 FormData:', formData);
    
    if (editingUser) {
      // EDITAR USUARIO EXISTENTE
      try {
        setSaving(true);
        setError('');
        console.log('✏️ Editando usuario:', editingUser.id);

        const { error: updateError } = await supabase
          .from('usuarios')
          .update({
            nombre_completo: formData.nombre_completo,
            email: formData.email,
            rol: formData.rol
          })
          .eq('id', editingUser.id);

        if (updateError) {
          console.error('❌ Error en update:', updateError);
          throw updateError;
        }

        console.log('✅ Usuario actualizado');
        setMessage({ type: 'success', text: '✅ Usuario actualizado exitosamente' });
        setShowModal(false);
        await loadUsers();
        resetForm();
      } catch (error) {
        console.error('❌ Error actualizando usuario:', error);
        setError('Error al actualizar: ' + error.message);
      } finally {
        setSaving(false);
      }
    } else {
      // CREAR NUEVO USUARIO
      try {
        setSaving(true);
        setError('');
        console.log('➕ Creando nuevo usuario...');

        // 1. Crear usuario en auth
        console.log('1️⃣ Llamando a signUp...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              nombre_completo: formData.nombre_completo,
              rol: formData.rol
            }
          }
        });

        console.log('📊 Resultado signUp:', { authData, authError });

        if (authError) {
          console.error('❌ Error en signUp:', authError);
          throw authError;
        }

        if (!authData.user) {
          console.error('❌ No se obtuvo el usuario');
          throw new Error('No se pudo crear el usuario en auth');
        }

        console.log('✅ Usuario creado en auth:', authData.user.id);

        // 2. Insertar en tabla usuarios
        console.log('2️⃣ Insertando en tabla usuarios...');
        const { data: dbData, error: dbError } = await supabase
          .from('usuarios')
          .insert([{
            id: authData.user.id,
            nombre_completo: formData.nombre_completo,
            email: formData.email,
            rol: formData.rol
          }])
          .select();

        console.log('📊 Resultado insert:', { dbData, dbError });

        if (dbError) {
          console.error('❌ Error en insert:', dbError);
          throw dbError;
        }

        console.log('✅ Usuario creado exitosamente');
        setMessage({ 
          type: 'success', 
          text: '✅ Usuario creado exitosamente' 
        });
        setShowModal(false);
        await loadUsers();
        resetForm();
      } catch (error) {
        console.error('❌ Error completo:', error);
        setError('Error al crear usuario: ' + error.message);
      } finally {
        console.log('🏁 Finalizando handleSubmit');
        setSaving(false);
      }
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      nombre_completo: user.nombre_completo,
      email: user.email,
      password: '',
      rol: user.rol
    });
    setShowModal(true);
    setError('');
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setMessage({ type: 'success', text: '✅ Usuario eliminado exitosamente' });
      await loadUsers();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      setMessage({ type: 'error', text: 'Error al eliminar: ' + error.message });
    }
  };

  const resetForm = () => {
    setFormData({
      nombre_completo: '',
      email: '',
      password: '',
      rol: 'Profesor'
    });
    setEditingUser(null);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #667eea', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ color: '#667eea', marginBottom: '0.5rem' }}>👥 Gestión de Usuarios</h1>
          <p style={{ color: '#666', margin: 0 }}>Administra profesores y administradores del sistema</p>
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
          ➕ Nuevo Usuario
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

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa' }}>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Nombre Completo</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Email</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Rol</th>
            <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={{ padding: '1rem' }}>{user.nombre_completo}</td>
              <td style={{ padding: '1rem' }}>{user.email}</td>
              <td style={{ padding: '1rem' }}>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  background: user.rol === 'Administrador' ? '#e3f2fd' : user.rol === 'Coordinador' ? '#fff3e0' : '#f3e5f5',
                  color: user.rol === 'Administrador' ? '#1976d2' : user.rol === 'Coordinador' ? '#f57c00' : '#7b1fa2'
                }}>
                  {user.rol}
                </span>
              </td>
              <td style={{ padding: '1rem', textAlign: 'center' }}>
                <button
                  onClick={() => handleEdit(user)}
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
                  onClick={() => handleDelete(user.id)}
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
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#667eea' }}>
              {editingUser ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
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
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e1e8ed',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              {!editingUser && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required={!editingUser}
                    minLength="6"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e1e8ed',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

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
                  <option value="Coordinador">Coordinador</option>
                  <option value="Administrador">Administrador</option>
                </select>
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
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}
                >
                  {saving ? '💾 Guardando...' : '💾 Guardar'}
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
                    fontWeight: '600',
                    fontSize: '1rem'
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

export default Usuarios;