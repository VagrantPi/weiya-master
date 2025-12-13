import { useNavigate } from 'react-router-dom';

import { useActivityList } from '../../hooks/use-activities';
import { formatIota } from '../../utils/iotaUnits';

export function OrganizerActivitiesPage() {
  const navigate = useNavigate();
  const { activities, isLoading, error } = useActivityList();

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h1 className="page-title">Activities</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            // 之後 step 可改為真正開啟建立表單
            // 目前先預留入口
            // eslint-disable-next-line no-alert
            alert('Create Activity 表單將在之後步驟實作');
          }}
        >
          Create Activity
        </button>
      </div>

      {isLoading ? <p>載入中...</p> : null}
      {error ? <p>載入活動失敗：{error.message}</p> : null}

      <div className="card-list">
        {(activities ?? []).map((activity) => (
          <button
            key={activity.id}
            type="button"
            className="card card-clickable"
            onClick={() =>
              navigate(`/organizer/activities/${encodeURIComponent(activity.id)}`)
            }
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
                  {activity.organizer.slice(0, 10)}...
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Participants</span>
                <span className="meta-value">{activity.participantCount}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Prize Pool</span>
                <span className="meta-value">
                  {formatIota(activity.prizePool)} IOTA
                </span>
              </div>
            </div>
          </button>
        ))}

        {!isLoading && !error && activities.length === 0 ? (
          <p>目前尚未有任何活動，可以從右上角建立第一場尾牙活動。</p>
        ) : null}
      </div>
    </div>
  );
}
