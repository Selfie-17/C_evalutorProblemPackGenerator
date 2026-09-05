import React, { useState, useEffect } from 'react';
import { X, Check, Tag, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { ProblemModel } from '../types';

interface ProblemDivisionModalProps {
  isOpen: boolean;
  problem: ProblemModel | null;
  onClose: () => void;
  onSave: (updatedProblem: ProblemModel) => void;
}

export function ProblemDivisionModal({
  isOpen,
  problem,
  onClose,
  onSave,
}: ProblemDivisionModalProps) {
  const [formData, setFormData] = useState<ProblemModel | null>(null);
  const [newConcept, setNewConcept] = useState('');
  const [newConstraint, setNewConstraint] = useState('');

  useEffect(() => {
    if (problem) {
      setFormData(JSON.parse(JSON.stringify(problem)));
    } else {
      setFormData(null);
    }
  }, [problem]);

  if (!isOpen || !formData) return null;

  const handleAddConcept = () => {
    if (!newConcept.trim()) return;
    setFormData({
      ...formData,
      concepts: [...formData.concepts, newConcept.trim()],
    });
    setNewConcept('');
  };

  const handleRemoveConcept = (idx: number) => {
    setFormData({
      ...formData,
      concepts: formData.concepts.filter((_, i) => i !== idx),
    });
  };

  const handleAddConstraint = () => {
    if (!newConstraint.trim()) return;
    setFormData({
      ...formData,
      constraints: [...formData.constraints, newConstraint.trim()],
    });
    setNewConstraint('');
  };

  const handleRemoveConstraint = (idx: number) => {
    setFormData({
      ...formData,
      constraints: formData.constraints.filter((_, i) => i !== idx),
    });
  };

  const handleSave = () => {
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '750px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              {formData.problem_id}
            </span>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Edit Problem Definition
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Refine title, statement, category, and parameters before generating test cases.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            flex: 1,
          }}
        >
          {/* Title and Category Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Problem Title
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Check Even or Odd Number"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Category
              </label>
              <select
                className="input"
                style={{ width: '100%' }}
                value={formData.classification.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    classification: { ...formData.classification, category: e.target.value },
                  })
                }
              >
                <option value="conditional">Conditional</option>
                <option value="loop">Loop</option>
                <option value="menu-driven">Menu Driven</option>
                <option value="number-property">Number Property</option>
                <option value="arithmetic">Arithmetic</option>
                <option value="character-io">Character I/O</option>
                <option value="data-types">Data Types</option>
                <option value="grade-conversion">Grade Conversion</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Difficulty
              </label>
              <select
                className="input"
                style={{ width: '100%' }}
                value={formData.classification.difficulty}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    classification: { ...formData.classification, difficulty: e.target.value },
                  })
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Statement */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Problem Statement
            </label>
            <textarea
              className="input"
              rows={4}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              value={formData.statement}
              onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
              placeholder="Write problem statement..."
            />
          </div>

          {/* Original Statement (Read-only Reference) */}
          {formData.original_statement && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed var(--border)',
                borderRadius: '8px',
                padding: '10px 14px',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                PRESERVED ORIGINAL TEXT:
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {formData.original_statement}
              </div>
            </div>
          )}

          {/* Concepts Tags */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Key Concepts & Tags
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {formData.concepts.map((concept, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Tag size={12} />
                  <span>{concept}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveConcept(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: 'var(--text-muted)' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input"
                style={{ flex: 1 }}
                value={newConcept}
                onChange={(e) => setNewConcept(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddConcept())}
                placeholder="Add concept (e.g. modulo arithmetic, ternary) and press Enter"
              />
              <button type="button" onClick={handleAddConcept} className="btn btn-secondary btn-sm">
                + Add
              </button>
            </div>
          </div>

          {/* Constraints */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Technical Constraints
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {formData.constraints.map((constraint, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    background: 'rgba(234, 179, 8, 0.1)',
                    color: '#eab308',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                  }}
                >
                  <span>{constraint}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveConstraint(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#eab308' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input"
                style={{ flex: 1 }}
                value={newConstraint}
                onChange={(e) => setNewConstraint(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddConstraint())}
                placeholder="Add constraint (e.g. -10^9 <= n <= 10^9) and press Enter"
              />
              <button type="button" onClick={handleAddConstraint} className="btn btn-secondary btn-sm">
                + Add
              </button>
            </div>
          </div>

          {/* Reference Solution C Code (Optional) */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Reference C Solution (Optional)
            </label>
            <textarea
              className="input"
              rows={5}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
              value={formData.reference_solution_c || ''}
              onChange={(e) => setFormData({ ...formData, reference_solution_c: e.target.value })}
              placeholder="#include <stdio.h>&#10;&#10;int main() {&#10;    // Reference code&#10;    return 0;&#10;}"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'var(--bg-secondary)',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary">
            <Check size={16} />
            <span>Save Problem Edits</span>
          </button>
        </div>
      </div>
    </div>
  );
}
