import type { ActivityView } from '../../types/annual-party';
import { formatIota } from '../../utils/iotaUnits';

interface ActivityListProps {
  activities: ActivityView[];
  currentAddress: string;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenDetail: (activityId: string) => void;
}

export function ActivityList({
  activities,
  currentAddress,
  isLoading,
  onRefresh,
  onOpenDetail,
}: ActivityListProps) {
  if (isLoading) {
    return <p>活動載入中...</p>;
  }

  if (!activities.length) {
    return (
      <div>
        <p>目前沒有符合條件的活動。</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={onRefresh}
        >
          重新整理
        </button>
      </div>
    );
  }

  return (
    <div className="card-list">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          currentAddress={currentAddress}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
}

interface ActivityCardProps {
  activity: ActivityView;
  currentAddress: string;
  onOpenDetail: (activityId: string) => void;
}

function ActivityCard({
  activity,
  currentAddress,
  onOpenDetail,
}: ActivityCardProps) {
  const isOrganizer =
    activity.organizer.toLowerCase() === currentAddress.toLowerCase();

  const shortOrganizer =
    activity.organizer.length > 12
      ? `${activity.organizer.slice(0, 6)}...${activity.organizer.slice(-4)}`
      : activity.organizer;

  return (
    <button
      type="button"
      className="card card-clickable"
      onClick={() => onOpenDetail(activity.id)}
    >
      <div className="card-header-row">
        <h2 className="card-title">{activity.name || 'Unnamed Activity'}</h2>
        <span
          className={
            activity.status === 'OPEN'
              ? 'status-tag status-open'
              : 'status-tag status-closed'
          }
        >
          {activity.status}
        </span>
      </div>
      <div className="card-meta">
        <div className="meta-item">
          <span className="meta-label">Organizer</span>
          <span className="meta-value mono">
            {isOrganizer ? 'You (Organizer)' : shortOrganizer}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Participants</span>
          <span className="meta-value">{activity.participantCount}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Prize Pool</span>
          <span className="meta-value">
            {formatIota(activity.prizePoolAmount)} IOTA
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Bonus</span>
          <span className="meta-value">
            {activity.hasBonusEvent ? '已開啟' : '未開啟'}
          </span>
        </div>
      </div>
    </button>
  );
}
