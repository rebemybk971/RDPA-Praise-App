import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

// Timeout de sécurité : si Supabase ne répond pas en 5 secondes, on arrête d'attendre
const TIMEOUT_MS = 5000

function withTimeout(promise, ms, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // Filet de sécurité ultime : au bout de 8 secondes, on force loading à false
    const safetyNet = setTimeout(() => {
      if (isMounted) {
        console.warn('Filet de sécurité activé : loading forcé à false')
        setLoading(false)
      }
    }, 8000)

    // Récupération de la session initiale avec timeout
    withTimeout(
      supabase.auth.getSession(),
      TIMEOUT_MS,
      'Timeout getSession'
    )
      .then(({ data: { session } }) => {
        if (!isMounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Erreur getSession :', err.message)
        if (isMounted) {
          setUser(null)
          setLoading(false)
        }
      })

    // Écoute des changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(safetyNet)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    console.log('fetchProfile appelé avec userId:', userId)
    try {
      const { data, error } = await withTimeout(
        supabase.from('membres').select('*').eq('id', userId).single(),
        TIMEOUT_MS,
        'Timeout fetchProfile'
      )
      console.log('Résultat Supabase — data:', data)
      console.log('Résultat Supabase — error:', error)
      if (error) {
        console.error('Erreur fetchProfile :', error)
        setProfile(null)
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('Erreur fetchProfile (timeout ou réseau) :', err.message)
      setProfile(null)
    } finally {
      // On garantit que loading passe à false dans TOUS les cas
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
