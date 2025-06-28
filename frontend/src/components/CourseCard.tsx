import React from 'react';
import { Link } from 'react-router-dom';
import { 
  PlayIcon, 
  ClockIcon, 
  AcademicCapIcon,
  CheckCircleIcon,
  ExclamationIcon
} from '@heroicons/react/outline';

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    duration: number; // en minutes
    level: 'débutant' | 'intermédiaire' | 'avancé';
    category: string;
    thumbnail: string;
    progress: number; // 0-100
    isCompleted: boolean;
    isRequired: boolean;
    instructor: string;
    rating: number;
    enrolledCount: number;
  };
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'débutant':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermédiaire':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'avancé':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Image du cours */}
      <div className="relative">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-48 object-cover"
        />
        
        {/* Badge requis */}
        {course.isRequired && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              <ExclamationIcon className="w-3 h-3 mr-1" />
              Requis
            </span>
          </div>
        )}

        {/* Badge niveau */}
        <div className="absolute top-2 right-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(course.level)}`}>
            {course.level}
          </span>
        </div>

        {/* Badge complété */}
        {course.isCompleted && (
          <div className="absolute bottom-2 right-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircleIcon className="w-3 h-3 mr-1" />
              Terminé
            </span>
          </div>
        )}

        {/* Bouton play */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black bg-opacity-50">
          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center px-4 py-2 bg-white text-gray-900 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
          >
            <PlayIcon className="w-5 h-5 mr-2" />
            Continuer
          </Link>
        </div>
      </div>

      {/* Contenu du cours */}
      <div className="p-4">
        {/* Catégorie */}
        <div className="mb-2">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            {course.category}
          </span>
        </div>

        {/* Titre */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {course.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {course.description}
        </p>

        {/* Métadonnées */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <ClockIcon className="w-4 h-4 mr-1" />
            {course.duration} min
          </div>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <AcademicCapIcon className="w-4 h-4 mr-1" />
            {course.instructor}
          </div>
        </div>

        {/* Progression */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Progression</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {course.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(course.progress)}`}
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>

        {/* Statistiques */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.floor(course.rating)
                      ? 'text-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="ml-1">({course.rating})</span>
          </div>
          <span>{course.enrolledCount} inscrits</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex space-x-2">
          <Link
            to={`/courses/${course.id}`}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg font-medium transition-colors"
          >
            {course.progress > 0 ? 'Continuer' : 'Commencer'}
          </Link>
          <button className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseCard; 