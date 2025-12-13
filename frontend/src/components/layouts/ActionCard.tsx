import type { FC, ReactNode } from 'react';
import './ActionCard.css';

interface ActionCardProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const ActionCard: FC<ActionCardProps> = ({
  title,
  description,
  children,
  className = '',
  disabled = false,
}) => {
  const finalClassName = `action-card ${className} ${
    disabled ? 'action-card-disabled' : ''
  }`;

  return (
    <div className={finalClassName}>
      <div className="action-card-content">
        <h3 className="action-card-title">{title}</h3>
        <p className="action-card-description">{description}</p>
      </div>
      <div className="action-card-actions">{children}</div>
    </div>
  );
};
