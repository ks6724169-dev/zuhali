import React from 'react';

export default function AiSparkIcon({ size = 18, className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M11 2.5C11 7.2 7.2 11 2.5 11C7.2 11 11 14.8 11 19.5C11 14.8 14.8 11 19.5 11C14.8 11 11 7.2 11 2.5Z" />
      <circle cx="19.5" cy="4.5" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
