import { useState, useEffect, createContext, useContext } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, COLLECTIONS } from '../../firebase';

// Types pour l'authentification
interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'user' | 'instructor' | 'admin';
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    department?: string;
    position?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  preferences: {
    language: 'fr' | 'en';
    notifications: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (updates: Partial<AuthUser['profile']>) => Promise<void>;
  updateUserPreferences: (updates: Partial<AuthUser['preferences']>) => Promise<void>;
}

// Contexte d'authentification
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook personnalisé pour utiliser l'authentification
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}

// Provider d'authentification
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour créer un utilisateur dans Firestore
  async function createUserDocument(user: User, additionalData?: any) {
    if (!user.email) return;

    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const { displayName, email, photoURL } = user;
      const createdAt = new Date();

      try {
        await setDoc(userRef, {
          uid: user.uid,
          email,
          displayName,
          photoURL,
          role: 'user', // Rôle par défaut
          createdAt,
          lastLogin: createdAt,
          profile: {
            firstName: additionalData?.firstName || displayName?.split(' ')[0] || '',
            lastName: additionalData?.lastName || displayName?.split(' ').slice(1).join(' ') || '',
            phone: '',
            department: '',
            position: '',
          },
          preferences: {
            language: 'fr',
            notifications: true,
            theme: 'auto',
          },
          ...additionalData,
        });
      } catch (error) {
        console.error('Erreur lors de la création du document utilisateur:', error);
      }
    }
  }

  // Fonction pour récupérer les données utilisateur depuis Firestore
  async function fetchUserData(uid: string): Promise<AuthUser | null> {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data() as AuthUser;
      }
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération des données utilisateur:', error);
      return null;
    }
  }

  // Connexion avec email/mot de passe
  async function signIn(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await updateDoc(doc(db, COLLECTIONS.USERS, result.user.uid), {
        lastLogin: new Date(),
      });
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Connexion avec Google
  async function signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserDocument(result.user);
      await updateDoc(doc(db, COLLECTIONS.USERS, result.user.uid), {
        lastLogin: new Date(),
      });
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Inscription
  async function signUp(email: string, password: string, firstName: string, lastName: string) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Mettre à jour le profil Firebase
      await updateProfile(result.user, {
        displayName: `${firstName} ${lastName}`,
      });

      // Créer le document utilisateur dans Firestore
      await createUserDocument(result.user, {
        firstName,
        lastName,
      });
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Déconnexion
  async function logout() {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Réinitialisation du mot de passe
  async function resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(getErrorMessage(error.code));
    }
  }

  // Mise à jour du profil utilisateur
  async function updateUserProfile(updates: Partial<AuthUser['profile']>) {
    if (!currentUser) throw new Error('Utilisateur non connecté');

    try {
      const userRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
      await updateDoc(userRef, {
        profile: { ...currentUser.profile, ...updates },
      });

      // Mettre à jour l'état local
      setCurrentUser(prev => prev ? {
        ...prev,
        profile: { ...prev.profile, ...updates },
      } : null);
    } catch (error: any) {
      throw new Error('Erreur lors de la mise à jour du profil');
    }
  }

  // Mise à jour des préférences utilisateur
  async function updateUserPreferences(updates: Partial<AuthUser['preferences']>) {
    if (!currentUser) throw new Error('Utilisateur non connecté');

    try {
      const userRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
      await updateDoc(userRef, {
        preferences: { ...currentUser.preferences, ...updates },
      });

      // Mettre à jour l'état local
      setCurrentUser(prev => prev ? {
        ...prev,
        preferences: { ...prev.preferences, ...updates },
      } : null);
    } catch (error: any) {
      throw new Error('Erreur lors de la mise à jour des préférences');
    }
  }

  // Écouter les changements d'état d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Récupérer les données utilisateur depuis Firestore
        const userData = await fetchUserData(user.uid);
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Fonction pour traduire les codes d'erreur Firebase
  function getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Aucun utilisateur trouvé avec cet email';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/email-already-in-use':
        return 'Cet email est déjà utilisé';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères';
      case 'auth/invalid-email':
        return 'Adresse email invalide';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Veuillez réessayer plus tard';
      case 'auth/popup-closed-by-user':
        return 'Connexion annulée';
      case 'auth/popup-blocked':
        return 'Popup bloqué par le navigateur';
      default:
        return 'Une erreur est survenue. Veuillez réessayer';
    }
  }

  const value: AuthContextType = {
    currentUser,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    logout,
    resetPassword,
    updateUserProfile,
    updateUserPreferences,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 