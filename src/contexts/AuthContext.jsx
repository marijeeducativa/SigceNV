import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  let mounted = true;

  const initSession = async () => {
    try {
      console.log('🔑 Iniciando sesión...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('📊 Sesión obtenida:', { session: !!session, error });

      if (!mounted) return;

      if (error) throw error;

      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        console.log('⚠️ No hay sesión activa');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error en initSession:', error);
      if (mounted) {
        setLoading(false);
      }
    }
  };

  initSession();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state change:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
        // NO recargar perfil, solo actualizar token
      }
    }
  );

  return () => {
    mounted = false;
    subscription?.unsubscribe();
  };
}, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setLoading(false);
    }
  };

 const loadProfile = async (userId) => {
  if (!userId) {
    console.error('❌ userId es undefined');
    setLoading(false);
    return;
  }

  try {
    console.log('🔍 Cargando perfil para userId:', userId);
    
    // Crear timeout de 10 segundos
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout después de 10 segundos')), 10000);
    });

    // Crear la consulta
    const queryPromise = supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // Ejecutar con timeout
    const { data, error } = await Promise.race([
      queryPromise,
      timeoutPromise.then(() => ({ data: null, error: new Error('Timeout') }))
    ]);

    console.log('📊 Resultado:', { data, error });

    if (error) {
      console.error('❌ Error en loadProfile:', error.message);
      setUserProfile(null);
      return;
    }

    if (data) {
      console.log('✅ Perfil cargado:', data);
      setUserProfile(data);
    } else {
      console.warn('⚠️ No se encontró perfil');
      setUserProfile(null);
    }
  } catch (error) {
    console.error('❌ Catch error:', error.message);
    setUserProfile(null);
  } finally {
    console.log('🏁 Finalizando loadProfile - setLoading(false)');
    setLoading(false);
  }
};

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};