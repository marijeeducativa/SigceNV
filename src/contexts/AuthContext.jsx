import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión al cargar
    checkSession();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.id);
      
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
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
  try {
    console.log('🔍 Cargando perfil para userId:', userId);
    
    // Timeout de 5 segundos
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    const queryPromise = supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    console.log('📊 Resultado de perfil:', { data, error });

    if (error) {
      console.error('❌ Error en loadProfile:', error);
      setUserProfile(null);
      setLoading(false);
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
    console.error('❌ Error/Timeout en loadProfile:', error.message);
    setUserProfile(null);
  } finally {
    console.log('🏁 Finalizando loadProfile');
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