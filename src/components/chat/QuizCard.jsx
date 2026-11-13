import React, { useState } from 'react';
import { Check, X, Award } from 'lucide-react';

export default function QuizCard({ quizData }) {
  if (!quizData || !quizData.questions || quizData.questions.length === 0) return null;

  const { title, subtitle, questions } = quizData;

  return (
    <div className="chatgpt-quiz-card-container">
      {title && (
        <div className="chatgpt-quiz-card-header">
          <div className="quiz-header-left">
            <h3 className="quiz-main-title">{title}</h3>
            {subtitle && <p className="quiz-subtitle">{subtitle}</p>}
          </div>
          <div className="quiz-header-badges">
            <span className="quiz-count-badge">
              <Award size={13} />
              {questions.length} {questions.length === 1 ? 'प्रश्न' : 'प्रश्न'}
            </span>
          </div>
        </div>
      )}

      <div className="quiz-questions-list">
        {questions.map((q, idx) => (
          <SingleQuestionItem key={idx} q={q} index={idx} totalCount={questions.length} />
        ))}
      </div>
    </div>
  );
}

function SingleQuestionItem({ q, index, totalCount }) {
  const [selectedOption, setSelectedOption] = useState(null);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const handleSelect = (optIdx) => {
    if (selectedOption !== null) return; // allow first selection
    setSelectedOption(optIdx);
  };

  const isAnswered = selectedOption !== null;
  const isCorrect = isAnswered && selectedOption === q.correctIndex;
  const correctLetter = optionLetters[q.correctIndex] || 'A';

  return (
    <div className="quiz-question-card">
      <div className="quiz-question-meta">
        <span className="quiz-question-num">प्रश्न {index + 1}</span>
        {q.category && <span className="quiz-question-category">{q.category}</span>}
      </div>

      <h4 className="quiz-question-text">{q.question}</h4>

      <div className="quiz-options-grid">
        {q.options.map((opt, oIdx) => {
          const letter = optionLetters[oIdx] || String(oIdx + 1);
          const isThisSelected = selectedOption === oIdx;
          const isThisCorrectOption = isAnswered && oIdx === q.correctIndex;

          let btnClass = 'quiz-option-button';
          if (isThisSelected) {
            btnClass += isCorrect ? ' option-correct' : ' option-wrong';
          } else if (isAnswered && isThisCorrectOption) {
            btnClass += ' option-highlight-correct';
          }

          return (
            <button
              key={oIdx}
              type="button"
              className={btnClass}
              onClick={() => handleSelect(oIdx)}
              disabled={isAnswered}
            >
              <span className="quiz-option-letter">{letter}</span>
              <span className="quiz-option-text">{opt}</span>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className={`quiz-feedback-box ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
          <div className="quiz-feedback-header">
            {isCorrect ? (
              <>
                <Check size={16} className="feedback-icon correct" />
                <span className="feedback-title correct">✓ सही उत्तर</span>
              </>
            ) : (
              <>
                <X size={16} className="feedback-icon wrong" />
                <span className="feedback-title wrong">✗ सही उत्तर: {correctLetter}</span>
              </>
            )}
          </div>
          {q.explanation && (
            <p className="quiz-explanation-text">{q.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
