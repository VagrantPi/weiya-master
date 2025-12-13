import type { FC, ReactNode } from 'react';
import './ControlPanel.css';

interface ControlPanelProps {
  title: string;
  status?: string;
  statusClassName?: string;
  children: ReactNode;
  className?: string;
}

export const ControlPanel: FC<ControlPanelProps> = ({
  title,
  status,
  statusClassName,
  children,
  className = '',
}) => {
  return (
    <div className={`control-panel ${className}`}>
      <div className="control-panel-header">
        <h3 className="control-panel-title">{title}</h3>
        {status && (
          <span className={`control-panel-status ${statusClassName}`}>
            {status}
          </span>
        )}
      </div>
      <div className="control-panel-body">{children}</div>
    </div>
  );
};
