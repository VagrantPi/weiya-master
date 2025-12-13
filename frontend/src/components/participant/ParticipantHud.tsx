// frontend/src/components/participant/ParticipantHud.tsx
import type { FC } from 'react';
import './ParticipantHud.css';

interface ParticipantHudProps {
    activityName: string;
    status: 'OPEN' | 'CLOSED';
    prizePool: string;
    participantCount: number;
    userAddress: string | null;
    isConnected: boolean;
}

export const ParticipantHud: FC<ParticipantHudProps> = ({
    activityName, status, prizePool, participantCount, userAddress, isConnected
}) => {
    return (
        <div className="participant-hud">
            <div className="hud-left">
                <span className="hud-activity-name">{activityName}</span>
                <span className={`hud-status ${status === 'OPEN' ? 'status-open' : 'status-closed'}`}>{status}</span>
            </div>
            <div className="hud-right">
                <div className="hud-item">
                    <span className="hud-label">Prize Pool</span>
                    <span className="hud-value">{prizePool} IOTA</span>
                </div>
                <div className="hud-item">
                    <span className="hud-label">Participants</span>
                    <span className="hud-value">{participantCount}</span>
                </div>
                <div className="hud-item">
                    <span className="hud-label">Your Address</span>
                    <span className="hud-value mono">{isConnected ? userAddress ?? 'Not connected' : 'Not connected'}</span>
                </div>
            </div>
        </div>
    )
}