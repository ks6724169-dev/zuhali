import React, { useState } from 'react';
import { X, Heart, ThumbsDown, Check } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function FeedbackModal() {
  const { activeFeedbackModal, setActiveFeedbackModal, submitFeedback } = useChat();

  const [type, setType] = useState(activeFeedbackModal?.type || 'like');
  const [choice, setChoice] = useState('');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!activeFeedbackModal) return null;

  const likeOptions = [
    'Helpful and accurate',
    'Clear and easy to understand',
    'Well structured response',
    'Detailed and informative',
    'Exactly what I needed'
  ];

  const dislikeOptions = [
    'Incorrect or inaccurate',
    'Not relevant to my question',
    'Too short or incomplete',
    'Too long or confusing',
    'Missing important information'
  ];

  const currentOptions = type === 'like' ? likeOptions : dislikeOptions;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!choice) return;
    submitFeedback(activeFeedbackModal.messageId, type, choice, comment);
    setSubmitted(true);
  };

  const handleClose = () => {
    setActiveFeedbackModal(null);
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        {!submitted ? (
          <>
            <div className="feedback-heading">
              <div>
                <h2>Share your feedback</h2>
                <p>What did you think about this response?</p>
              </div>
              <button className="feedback-close" onClick={handleClose} aria-label="Close feedback">
                <X size={18} />
              </button>
            </div>

            <div className="feedback-type-row">
              <button
                className={type === 'like' ? 'selected-like' : ''}
                onClick={() => { setType('like'); setChoice(''); }}
                type="button"
              >
                <Heart size={16} /> Like
              </button>
              <button
                className={type === 'dislike' ? 'selected-dislike' : ''}
                onClick={() => { setType('dislike'); setChoice(''); }}
                type="button"
              >
                <ThumbsDown size={16} /> Dislike
              </button>
            </div>

            <h3>{type === 'like' ? 'What did you like about this response?' : 'What could be improved?'}</h3>

            <div className="feedback-options">
              {currentOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={choice === option ? 'chosen' : ''}
                  onClick={() => setChoice(option)}
                >
                  <span className="feedback-radio">
                    {choice === option ? <Check size={13} strokeWidth={3} /> : null}
                  </span>
                  {option}
                </button>
              ))}
            </div>

            <label className="feedback-comment-label" htmlFor="feedback-comment">
              Additional comments <span>(optional)</span>
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={3}
            />

            <button
              className="feedback-submit"
              disabled={!choice}
              onClick={handleSubmit}
              type="button"
            >
              Submit feedback
            </button>
            <p className="feedback-note">Your feedback helps improve Zuhali AI models.</p>
          </>
        ) : (
          <div className="feedback-success">
            <div className="feedback-success-icon"><Check size={28} strokeWidth={3} /></div>
            <h2>Thank you for your feedback!</h2>
            <p>Your input helps us make Zuhali smarter and more reliable.</p>
            <button className="feedback-submit" onClick={handleClose} type="button">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
