import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  AcademicCapIcon, 
  ClockIcon, 
  TrophyIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon,
  BookOpenIcon,
  PlayIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Course {
  id: string;
  title: string;
  description: string;
  progress: number;
  duration: number;
  lessons: number;
  completedLessons: number;
  lastAccessed: Date;
  thumbnail?: string;
}

interface Alert {
  id: string;
  type: 'emergency' | 'maintenance' | 'info' | 'warning';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
}

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    totalTimeSpent: 0,
    averageScore: 0,
    currentStreak: 0,
  });

  // Données d'exemple pour les graphiques
  const progressData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'Temps d\'apprentissage (min)',
        data: [45, 60, 30, 75, 90, 45, 60],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const categoryData = {
    labels: ['Sécurité', 'Technique', 'Réglementation', 'Maintenance'],
    datasets: [
      {
        data: [30, 25, 20, 25],
        backgroundColor: [
          '#ef4444',
          '#3b82f6',
          '#10b981',
          '#f59e0b',
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  useEffect(() => {
    // Simuler le chargement des données
    setTimeout(() => {
      setCourses([
        {
          id: '1',
          title: 'Sécurité ferroviaire avancée',
          description: 'Formation complète sur les procédures de sécurité',
          progress: 75,
          duration: 120,
          lessons: 8,
          completedLessons: 6,
          lastAccessed: new Date(),
          thumbnail: '/images/course-1.jpg',
        },
        {
          id: '2',
          title: 'Maintenance préventive',
          description: 'Techniques de maintenance et diagnostic',
          progress: 45,
          duration: 90,
          lessons: 6,
          completedLessons: 3,
          lastAccessed: new Date(Date.now() - 86400000),
          thumbnail: '/images/course-2.jpg',
        },
        {
          id: '3',
          title: 'Réglementation européenne',
          description: 'Nouvelles normes européennes',
          progress: 20,
          duration: 60,
          lessons: 4,
          completedLessons: 1,
          lastAccessed: new Date(Date.now() - 172800000),
          thumbnail: '/images/course-3.jpg',
        },
      ]);

      setAlerts([
        {
          id: '1',
          type: 'maintenance',
          title: 'Maintenance préventive',
          message: 'Maintenance programmée sur la ligne A demain',
          priority: 'medium',
          createdAt: new Date(),
        },
        {
          id: '2',
          type: 'info',
          title: 'Nouveau cours disponible',
          message: 'Le cours "Sécurité avancée" est maintenant disponible',
          priority: 'low',
          createdAt: new Date(Date.now() - 3600000),
        },
      ]);

      setStats({
        totalCourses: 12,
        completedCourses: 8,
        totalTimeSpent: 45,
        averageScore: 87,
        currentStreak: 5,
      });

      setLoading(false);
    }, 1000);
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'maintenance':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <BookOpenIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
    }
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-rail-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête du dashboard */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Bonjour, {currentUser?.profile.firstName || 'Opérateur'} !
          </h1>
          <p className="text-gray-600 mt-2">
            Voici un aperçu de votre progression et des dernières activités
          </p>
        </div>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AcademicCapIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cours totaux</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cours terminés</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedCourses}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ClockIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Temps total (h)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTimeSpent}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrophyIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Score moyen</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageScore}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Série actuelle</p>
                <p className="text-2xl font-bold text-gray-900">{stats.currentStreak} jours</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cours en cours */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Mes cours en cours</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {courses.map((course) => (
                    <div key={course.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 bg-gradient-to-br from-rail-blue to-blue-600 rounded-lg flex items-center justify-center">
                          <BookOpenIcon className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {course.title}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {course.description}
                        </p>
                        <div className="mt-2 flex items-center text-xs text-gray-500">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {course.duration} min • {course.completedLessons}/{course.lessons} leçons
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {course.progress}%
                          </div>
                          <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                            <div
                              className="h-2 bg-rail-blue rounded-full"
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <button className="flex-shrink-0 p-2 text-rail-blue hover:bg-blue-50 rounded-lg">
                        <PlayIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Alertes et notifications */}
          <div className="space-y-6">
            {/* Alertes */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Alertes</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border-l-4 rounded-r-lg ${getAlertColor(alert.priority)}`}
                    >
                      <div className="flex items-start">
                        {getAlertIcon(alert.type)}
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-gray-900">
                            {alert.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {alert.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {alert.createdAt.toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Graphiques */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Progression hebdomadaire</h2>
              </div>
              <div className="p-6">
                <Line data={progressData} options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Répartition par catégorie</h2>
              </div>
              <div className="p-6">
                <Doughnut data={categoryData} options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 