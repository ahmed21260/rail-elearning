import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  LightBulbIcon,
  ChartBarIcon
} from '@heroicons/react/outline';

interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
  timeLimit?: number; // en secondes
}

interface QuizComponentProps {
  questions: Question[];
  onComplete: (results: QuizResult) => void;
  allowRetry?: boolean;
  showExplanation?: boolean;
}

interface QuizResult {
  score: number;
  totalPoints: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  answers: Answer[];
}

interface Answer {
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  timeSpent: number;
}

const QuizComponent: React.FC<QuizComponentProps> = ({
  questions,
  onComplete,
  allowRetry = true,
  showExplanation = true
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  const currentQuestion = questions[currentQuestionIndex];

  // Timer pour la question
  useEffect(() => {
    if (currentQuestion.timeLimit) {
      setRemainingTime(currentQuestion.timeLimit);
      
      const timer = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev !== null && prev <= 1) {
            handleAnswer();
            return null;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentQuestionIndex]);

  // Timer global
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;

    if (currentQuestion.type === 'multiple-choice') {
      setSelectedAnswers([answer]);
    } else if (currentQuestion.type === 'true-false') {
      setSelectedAnswers([answer]);
    } else if (currentQuestion.type === 'fill-blank') {
      setSelectedAnswers([answer]);
    } else if (currentQuestion.type === 'matching') {
      if (selectedAnswers.includes(answer)) {
        setSelectedAnswers(selectedAnswers.filter(a => a !== answer));
      } else {
        setSelectedAnswers([...selectedAnswers, answer]);
      }
    }
  };

  const isAnswerCorrect = (userAnswer: string | string[], correctAnswer: string | string[]): boolean => {
    if (Array.isArray(correctAnswer)) {
      if (Array.isArray(userAnswer)) {
        return userAnswer.length === correctAnswer.length &&
               userAnswer.every(answer => correctAnswer.includes(answer));
      }
      return false;
    }
    return userAnswer === correctAnswer;
  };

  const handleAnswer = () => {
    if (isAnswered || selectedAnswers.length === 0) return;

    const timeSpentOnQuestion = Math.floor((Date.now() - questionStartTime) / 1000);
    const userAnswer = currentQuestion.type === 'matching' ? selectedAnswers : selectedAnswers[0];
    const isCorrect = isAnswerCorrect(userAnswer, currentQuestion.correctAnswer);

    const answer: Answer = {
      questionId: currentQuestion.id,
      userAnswer,
      isCorrect,
      timeSpent: timeSpentOnQuestion
    };

    setAnswers([...answers, answer]);
    setIsAnswered(true);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setIsAnswered(false);
      setSelectedAnswers([]);
      setQuestionStartTime(Date.now());
      setRemainingTime(currentQuestion.timeLimit || null);
    } else {
      // Quiz terminé
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      const correctAnswers = answers.filter(a => a.isCorrect).length;
      const score = answers.reduce((sum, a) => sum + (a.isCorrect ? questions.find(q => q.id === a.questionId)?.points || 0 : 0), 0);

      const result: QuizResult = {
        score,
        totalPoints,
        correctAnswers,
        totalQuestions: questions.length,
        timeSpent,
        answers
      };

      setShowResult(true);
      onComplete(result);
    }
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setTimeSpent(0);
    setQuestionStartTime(Date.now());
    setSelectedAnswers([]);
    setIsAnswered(false);
    setShowResult(false);
    setRemainingTime(currentQuestion.timeLimit || null);
  };

  const renderQuestion = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {/* En-tête de la question */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Question {currentQuestionIndex + 1} sur {questions.length}
            </span>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {currentQuestion.points} points
            </span>
          </div>
          
          {remainingTime !== null && (
            <div className="flex items-center space-x-2">
              <ClockIcon className="w-5 h-5 text-red-500" />
              <span className={`text-lg font-bold ${
                remainingTime <= 10 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Question */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {currentQuestion.question}
          </h3>
          
          {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isAnswered}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    selectedAnswers.includes(option)
                      ? isAnswered
                        ? isAnswerCorrect([option], currentQuestion.correctAnswer)
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="text-gray-900 dark:text-white">{option}</span>
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'true-false' && (
            <div className="space-y-3">
              {['Vrai', 'Faux'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isAnswered}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    selectedAnswers.includes(option)
                      ? isAnswered
                        ? isAnswerCorrect([option], currentQuestion.correctAnswer)
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="text-gray-900 dark:text-white">{option}</span>
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'fill-blank' && (
            <div className="space-y-3">
              <input
                type="text"
                value={selectedAnswers[0] || ''}
                onChange={(e) => setSelectedAnswers([e.target.value])}
                disabled={isAnswered}
                placeholder="Tapez votre réponse..."
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {currentQuestion.type === 'matching' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isAnswered}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    selectedAnswers.includes(option)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="text-gray-900 dark:text-white">{option}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feedback */}
        {isAnswered && showExplanation && currentQuestion.explanation && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-2">
              <LightBulbIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">
                  Explication
                </h4>
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <div className="flex items-center space-x-2">
            {isAnswered && (
              <>
                {isAnswerCorrect(selectedAnswers, currentQuestion.correctAnswer) ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircleIcon className="w-6 h-6 text-red-500" />
                )}
                <span className={`font-medium ${
                  isAnswerCorrect(selectedAnswers, currentQuestion.correctAnswer)
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {isAnswerCorrect(selectedAnswers, currentQuestion.correctAnswer) ? 'Correct !' : 'Incorrect'}
                </span>
              </>
            )}
          </div>

          <div className="flex space-x-3">
            {!isAnswered && selectedAnswers.length > 0 && (
              <button
                onClick={handleAnswer}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Valider
              </button>
            )}
            
            {isAnswered && (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Suivant' : 'Terminer'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const score = answers.reduce((sum, a) => sum + (a.isCorrect ? questions.find(q => q.id === a.questionId)?.points || 0 : 0), 0);
    const percentage = Math.round((score / totalPoints) * 100);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Quiz terminé !
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Voici vos résultats
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {percentage}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Score</div>
          </div>
          
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {correctAnswers}/{questions.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Réponses correctes</div>
          </div>
          
          <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {score}/{totalPoints}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Points</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Temps</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center space-x-4">
          {allowRetry && (
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Recommencer
            </button>
          )}
          
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {showResult ? renderResults() : renderQuestion()}
    </div>
  );
};

export default QuizComponent; 