import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Ban, HelpCircle } from 'lucide-react';

interface Props {
  verdict: string;
  size?: 'sm' | 'md' | 'lg';
}

export const VerdictBadge: React.FC<Props> = ({ verdict, size = 'md' }) => {
  const norm = (verdict || '').toUpperCase();

  switch (norm) {
    case 'ACCEPTED':
      return (
        <span className="badge badge-accepted">
          <CheckCircle2 size={size === 'sm' ? 12 : 14} />
          <span>Accepted</span>
        </span>
      );
    case 'WRONG_ANSWER':
      return (
        <span className="badge badge-wrong_answer">
          <XCircle size={size === 'sm' ? 12 : 14} />
          <span>Wrong Answer</span>
        </span>
      );
    case 'COMPILATION_ERROR':
      return (
        <span className="badge badge-compilation_error">
          <AlertTriangle size={size === 'sm' ? 12 : 14} />
          <span>Compilation Error</span>
        </span>
      );
    case 'RUNTIME_ERROR':
      return (
        <span className="badge badge-runtime_error">
          <AlertTriangle size={size === 'sm' ? 12 : 14} />
          <span>Runtime Error</span>
        </span>
      );
    case 'TIME_LIMIT_EXCEEDED':
      return (
        <span className="badge badge-time_limit_exceeded">
          <Clock size={size === 'sm' ? 12 : 14} />
          <span>Time Limit Exceeded</span>
        </span>
      );
    case 'NOT_SUBMITTED':
      return (
        <span className="badge badge-not_submitted">
          <Ban size={size === 'sm' ? 12 : 14} />
          <span>Not Submitted</span>
        </span>
      );
    default:
      return (
        <span className="badge badge-not_submitted">
          <HelpCircle size={size === 'sm' ? 12 : 14} />
          <span>{verdict || 'Unknown'}</span>
        </span>
      );
  }
};
