// Configuration de l'API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Types TypeScript
export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  level: 'débutant' | 'intermédiaire' | 'avancé';
  duration: number;
  thumbnail: string;
  is_required: boolean;
  rating: number;
  enrolled_count: number;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  course_id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'matching';
  options: string[];
  correct_answer: string;
  explanation?: string;
  points: number;
  time_limit?: number;
  created_at: string;
}

export interface Flashcard {
  id: string;
  course_id: string;
  front: string;
  back: string;
  category: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
  review_count: number;
  mastery_level: number;
  last_reviewed?: string;
  created_at: string;
}

export interface UserAnalytics {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, string>;
  timestamp: string;
}

export interface UserProgress {
  user_id: string;
  course_id: string;
  progress_percentage: number;
  completed_modules: string[];
  quiz_scores: Record<string, number>;
  time_spent: number;
  last_accessed: string;
  created_at: string;
  updated_at: string;
}

// Classe API client
class AstraApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // ===== COURS =====

  async getCourses(): Promise<{ success: boolean; data: Course[]; count: number }> {
    return this.request('/api/courses');
  }

  async getCourse(id: string): Promise<{ success: boolean; data: Course }> {
    return this.request(`/api/courses/${id}`);
  }

  async createCourse(courseData: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data: Course; message: string }> {
    return this.request('/api/courses', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  }

  async updateCourse(id: string, courseData: Partial<Course>): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(courseData),
    });
  }

  async deleteCourse(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/courses/${id}`, {
      method: 'DELETE',
    });
  }

  // ===== QUIZ =====

  async getQuiz(): Promise<{ success: boolean; data: Quiz[]; count: number }> {
    return this.request('/api/quiz');
  }

  async getCourseQuiz(courseId: string): Promise<{ success: boolean; data: Quiz[]; count: number }> {
    return this.request(`/api/courses/${courseId}/quiz`);
  }

  async createQuiz(quizData: Omit<Quiz, 'id' | 'created_at'>): Promise<{ success: boolean; data: Quiz; message: string }> {
    return this.request('/api/quiz', {
      method: 'POST',
      body: JSON.stringify(quizData),
    });
  }

  // ===== FLASHCARDS =====

  async getFlashcards(): Promise<{ success: boolean; data: Flashcard[]; count: number }> {
    return this.request('/api/flashcards');
  }

  async getCourseFlashcards(courseId: string): Promise<{ success: boolean; data: Flashcard[]; count: number }> {
    return this.request(`/api/courses/${courseId}/flashcards`);
  }

  async createFlashcard(flashcardData: Omit<Flashcard, 'id' | 'review_count' | 'mastery_level' | 'created_at'>): Promise<{ success: boolean; data: Flashcard; message: string }> {
    return this.request('/api/flashcards', {
      method: 'POST',
      body: JSON.stringify(flashcardData),
    });
  }

  async updateFlashcard(id: string, flashcardData: Partial<Flashcard>): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/flashcards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(flashcardData),
    });
  }

  // ===== ANALYTICS =====

  async logActivity(analyticsData: Omit<UserAnalytics, 'id' | 'timestamp'>): Promise<{ success: boolean; message: string }> {
    return this.request('/api/analytics', {
      method: 'POST',
      body: JSON.stringify(analyticsData),
    });
  }

  async getUserAnalytics(userId: string): Promise<{ success: boolean; data: UserAnalytics[]; count: number }> {
    return this.request(`/api/analytics/user/${userId}`);
  }

  // ===== UTILITAIRES =====

  async healthCheck(): Promise<{ status: string; timestamp: string; astra: { connected: boolean; keyspace: string } }> {
    return this.request('/health');
  }
}

// Instance singleton
export const astraApi = new AstraApiClient();

// Hooks React personnalisés (optionnels, pour une meilleure intégration)
export const useAstraApi = () => {
  return {
    // Cours
    getCourses: () => astraApi.getCourses(),
    getCourse: (id: string) => astraApi.getCourse(id),
    createCourse: (data: Omit<Course, 'id' | 'created_at' | 'updated_at'>) => astraApi.createCourse(data),
    updateCourse: (id: string, data: Partial<Course>) => astraApi.updateCourse(id, data),
    deleteCourse: (id: string) => astraApi.deleteCourse(id),

    // Quiz
    getQuiz: () => astraApi.getQuiz(),
    getCourseQuiz: (courseId: string) => astraApi.getCourseQuiz(courseId),
    createQuiz: (data: Omit<Quiz, 'id' | 'created_at'>) => astraApi.createQuiz(data),

    // Flashcards
    getFlashcards: () => astraApi.getFlashcards(),
    getCourseFlashcards: (courseId: string) => astraApi.getCourseFlashcards(courseId),
    createFlashcard: (data: Omit<Flashcard, 'id' | 'review_count' | 'mastery_level' | 'created_at'>) => astraApi.createFlashcard(data),
    updateFlashcard: (id: string, data: Partial<Flashcard>) => astraApi.updateFlashcard(id, data),

    // Analytics
    logActivity: (data: Omit<UserAnalytics, 'id' | 'timestamp'>) => astraApi.logActivity(data),
    getUserAnalytics: (userId: string) => astraApi.getUserAnalytics(userId),

    // Santé
    healthCheck: () => astraApi.healthCheck(),
  };
};

// Exemple d'utilisation avec React Query
export const createAstraQueries = () => ({
  courses: {
    queryKey: ['courses'],
    queryFn: () => astraApi.getCourses(),
  },
  course: (id: string) => ({
    queryKey: ['course', id],
    queryFn: () => astraApi.getCourse(id),
  }),
  courseQuiz: (courseId: string) => ({
    queryKey: ['course-quiz', courseId],
    queryFn: () => astraApi.getCourseQuiz(courseId),
  }),
  courseFlashcards: (courseId: string) => ({
    queryKey: ['course-flashcards', courseId],
    queryFn: () => astraApi.getCourseFlashcards(courseId),
  }),
  userAnalytics: (userId: string) => ({
    queryKey: ['user-analytics', userId],
    queryFn: () => astraApi.getUserAnalytics(userId),
  }),
});

export default astraApi; 