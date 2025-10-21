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

    const queryPromise = supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ data: null, error: new Error('Timeout: La consulta para cargar el perfil tardó demasiado.') }), 30000);
    });

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    console.log('📊 Resultado:', { data, error });

    if (error) {
      console.error('❌ Error en loadProfile:', error.message);
      setUserProfile(null);
      // Aquí podrías establecer un estado de error para mostrar en la UI si quieres
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
    console.error('❌ Catch error en loadProfile:', error.message);
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