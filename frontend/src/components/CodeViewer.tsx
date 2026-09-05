import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  code: string;
  errorLines?: number[];
  theme?: 'dark' | 'light';
  title?: string;
}

export const CodeViewer: React.FC<Props> = ({
  code,
  errorLines = [],
  theme = 'light',
  title,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = (code || '').split('\n');
  const isDark = theme === 'dark';

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: isDark ? '#1e293b' : 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: isDark ? '#e2e8f0' : 'var(--text-secondary)',
        }}
      >
        <span>{title || 'C Source Code'}</span>
        <button
          onClick={handleCopy}
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 8px', fontSize: '0.75rem', height: '26px' }}
        >
          {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className={isDark ? 'code-box' : 'code-box-light'} style={{ maxHeight: '420px', overflowY: 'auto' }}>
        {lines.map((line, idx) => {
          const lineNum = idx + 1;
          const isError = errorLines.includes(lineNum);
          return (
            <div key={lineNum} className={`code-line ${isError ? 'error-highlight' : ''}`}>
              <div className="line-number">{lineNum}</div>
              <div className="line-content">{line || ' '}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
