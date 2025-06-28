import React, { useState, useEffect } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  XIcon,
  RefreshIcon
} from '@heroicons/react/outline';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
  lastReviewed?: Date;
  reviewCount: number;
  masteryLevel: number; // 0-5
}

interface FlashcardComponentProps {
  flashcards: Flashcard[];
  onReviewComplete: (results: ReviewResult) => void;
  mode?: 'study' | 'review' | 'test';
}

interface ReviewResult {
  totalCards: number;
  masteredCards: number;
  needsReview: number;
  timeSpent: number;
  accuracy: number;
}

const FlashcardComponent: React.FC<FlashcardComponentProps> = ({
  flashcards,
  onReviewComplete,
  mode = 'study'
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewResults, setReviewResults] = useState<{ [key: string]: boolean }>({});
  const [timeSpent, setTimeSpent] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [shuffledCards, setShuffledCards] = useState<Flashcard[]>([]);

  const currentCard = shuffledCards[currentIndex];

  // Mélanger les cartes au début
  useEffect(() => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
  }, [flashcards]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (!showAnswer) {
      setShowAnswer(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < shuffledCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      setShowAnswer(false);
    } else {
      // Session terminée
      const masteredCards = Object.values(reviewResults).filter(result => result).length;
      const accuracy = (masteredCards / shuffledCards.length) * 100;

      const result: ReviewResult = {
        totalCards: shuffledCards.length,
        masteredCards,
        needsReview: shuffledCards.length - masteredCards,
        timeSpent,
        accuracy
      };

      setIsCompleted(true);
      onReviewComplete(result);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      setShowAnswer(false);
    }
  };

  const handleMastery = (mastered: boolean) => {
    if (currentCard) {
      setReviewResults({
        ...reviewResults,
        [currentCard.id]: mastered
      });
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowAnswer(false);
    setReviewResults({});
    setTimeSpent(0);
    setIsCompleted(false);
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'facile':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'moyen':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'difficile':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const renderFlashcard = () => {
    if (!currentCard) return null;

    return (
      <div className="max-w-2xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Carte {currentIndex + 1} sur {shuffledCards.length}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentCard.difficulty)}`}>
              {currentCard.difficulty}
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              Niveau: {currentCard.masteryLevel}/5
            </span>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
          </div>
        </div>

        {/* Carte */}
        <div className="relative">
          <div
            className={`w-full h-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-500 transform ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            onClick={handleFlip}
          >
            <div className={`absolute inset-0 flex items-center justify-center p-8 ${
              isFlipped ? 'opacity-0' : 'opacity-100'
            } transition-opacity duration-500`}>
              <div className="text-center">
                <div className="mb-4">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    {currentCard.category}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {currentCard.front}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Cliquez pour voir la réponse
                </p>
              </div>
            </div>

            <div className={`absolute inset-0 flex items-center justify-center p-8 ${
              isFlipped ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-500`}>
              <div className="text-center">
                <div className="mb-4">
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                    Réponse
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {currentCard.back}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Cliquez pour revenir à la question
                </p>
              </div>
            </div>
          </div>

          {/* Indicateur de progression */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span>Progression</span>
              <span>{Math.round(((currentIndex + 1) / shuffledCards.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / shuffledCards.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 mr-1" />
            Précédent
          </button>

          <div className="flex items-center space-x-4">
            {showAnswer && mode === 'review' && (
              <>
                <button
                  onClick={() => handleMastery(false)}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    reviewResults[currentCard.id] === false
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-800 dark:hover:bg-red-900 dark:hover:text-red-300'
                  }`}
                >
                  <XIcon className="w-4 h-4 mr-1" />
                  À revoir
                </button>
                <button
                  onClick={() => handleMastery(true)}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    reviewResults[currentCard.id] === true
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-green-100 hover:text-green-800 dark:hover:bg-green-900 dark:hover:text-green-300'
                  }`}
                >
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Maîtrisé
                </button>
              </>
            )}

            <button
              onClick={handleNext}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentIndex === shuffledCards.length - 1 ? 'Terminer' : 'Suivant'}
              <ChevronRightIcon className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>

        {/* Statistiques de la carte */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {currentCard.reviewCount}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Révisions
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {currentCard.masteryLevel}/5
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Niveau
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {currentCard.lastReviewed 
                  ? new Date(currentCard.lastReviewed).toLocaleDateString('fr-FR')
                  : 'Jamais'
                }
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Dernière révision
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const masteredCards = Object.values(reviewResults).filter(result => result).length;
    const accuracy = (masteredCards / shuffledCards.length) * 100;

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Session terminée !
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Voici vos résultats de révision
            </p>
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {masteredCards}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Cartes maîtrisées
              </div>
            </div>
            
            <div className="text-center p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {shuffledCards.length - masteredCards}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                À revoir
              </div>
            </div>
            
            <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {Math.round(accuracy)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Précision
              </div>
            </div>
            
            <div className="text-center p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Temps passé
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleRestart}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshIcon className="w-4 h-4 mr-2" />
              Recommencer
            </button>
            
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (shuffledCards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Aucune carte disponible
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      {isCompleted ? renderResults() : renderFlashcard()}
    </div>
  );
};

export default FlashcardComponent; 