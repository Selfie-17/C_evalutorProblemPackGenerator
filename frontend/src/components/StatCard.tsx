import React, { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
}

export const StatCard: React.FC<Props> = ({ label, value, description, icon }) => {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span>{label}</span>
        {icon && <span style={{ opacity: 0.8 }}>{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {description && <div className="stat-desc">{description}</div>}
    </div>
  );
};
