import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Services Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Provider Google
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Connexion aux émulateurs en développement
if (process.env.NODE_ENV === 'development') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    console.log('Émulateurs déjà connectés ou non disponibles');
  }
}

// Configuration des notifications push
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la demande de permission:', error);
    return null;
  }
};

// Écouter les messages en arrière-plan
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

// Collections Firestore
export const COLLECTIONS = {
  USERS: 'users',
  COURSES: 'courses',
  LESSONS: 'lessons',
  QUIZZES: 'quizzes',
  FLASHCARDS: 'flashcards',
  PROGRESS: 'progress',
  ALERTS: 'alerts',
  ANALYTICS: 'analytics',
  UPLOADS: 'uploads',
  NOTIFICATIONS: 'notifications',
} as const;

// Types pour les données Firestore
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'user' | 'instructor' | 'admin';
  createdAt: Date;
  lastLogin: Date;
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

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // en minutes
  lessons: string[]; // IDs des leçons
  instructor: string; // UID de l'instructeur
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  thumbnail?: string;
  tags: string[];
  requirements: string[];
  objectives: string[];
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  type: 'video' | 'text' | 'interactive' | 'quiz';
  duration: number;
  order: number;
  mediaUrl?: string;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Quiz {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  questions: QuizQuestion[];
  timeLimit?: number; // en minutes
  passingScore: number;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'matching';
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
}

export interface Flashcard {
  id: string;
  courseId: string;
  front: string;
  back: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: Date;
  updatedAt: Date;
}

export interface Progress {
  userId: string;
  courseId: string;
  lessonId?: string;
  completed: boolean;
  score?: number;
  timeSpent: number; // en secondes
  lastAccessed: Date;
  completedAt?: Date;
}

export interface Alert {
  id: string;
  type: 'emergency' | 'maintenance' | 'info' | 'warning';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // en mètres
  };
  recipients: string[]; // UIDs des utilisateurs
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface Analytics {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  userAgent: string;
  ipAddress?: string;
}

export default app; 