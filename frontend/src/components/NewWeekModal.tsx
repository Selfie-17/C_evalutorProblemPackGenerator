import React, { useState } from 'react';
import { X, Plus, Calendar } from 'lucide-react';
import { createWeek } from '../services/api';
import { Week } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (week: Week) => void;
  nextWeekNumber: number;
}

export const NewWeekModal: React.FC<Props> = ({ isOpen, onClose, onCreated, nextWeekNumber }) => {
  const [weekNumber, setWeekNumber] = useState(nextWeekNumber);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the week.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const newWeek = await createWeek(weekNumber, title.trim(), description.trim());
      onCreated(newWeek);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create week.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Create New Week</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ border: 'none', padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.86rem' }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Week Number
              </label>
              <input
                type="number"
                min="1"
                max="52"
                value={weekNumber}
                onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Week Title
              </label>
              <input
                type="text"
                placeholder="e.g. Basic C Programming, Arrays & Pointers"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Description (Optional)
              </label>
              <textarea
                placeholder="Brief summary of lab learning outcomes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              <Plus size={16} />
              <span>{loading ? 'Creating...' : 'Create Week'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
