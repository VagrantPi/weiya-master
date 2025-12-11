import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActivityList } from '../components/activity/ActivityList';
import { CreateActivityPanel } from '../components/activity/CreateActivityPanel';
import { useActivityOperations } from '../hooks/use-activity-operations';
import { useActivitiesQuery } from '../hooks/use-activities';
import { useWallet } from '../hooks/useWallet';

export function ActivityHomePage() {
  const navigate = useNavigate();
  const { data: activities = [], isLoading, refetch } = useActivitiesQuery();
  const { currentAddress, isConnected, network, snapStatus } = useWallet();
  const { createActivity, isPending: isCreating } = useActivityOperations();

  const [activeTab, setActiveTab] = useState<'all' | 'organized' | 'joined'>(
    'all',
  );

  const shortAddress =
    currentAddress && currentAddress.length > 12
      ? `${currentAddress.slice(0, 6)}...${currentAddress.slice(-4)}`
      : currentAddress;

  const { allActivities, organizedActivities } = useMemo(() => {
    const lower = currentAddress.toLowerCase();
    const organized = activities.filter(
      (a) => a.organizer.toLowerCase() === lower,
    );
    return {
      allActivities: activities,
      organizedActivities: organized,
    };
  }, [activities, currentAddress]);

  const displayedActivities =
    activeTab === 'organized' ? organizedActivities : allActivities;

  const handleOpenDetail = (id: string) => {
    navigate(`/organizer/activities/${id}`);
  };

  const handleCreate = async (name: string, initialAmount: bigint | number) => {
    const amountBigInt =
      typeof initialAmount === 'bigint'
        ? initialAmount
        : BigInt(initialAmount);
    await createActivity({ name, initialAmount: amountBigInt });
    await refetch();
  };

  return (
    <div className="page-container">
      <section className="card section">
        <h1 className="page-title">Activities</h1>
        <p className="page-subtitle">
          使用 IOTA Snap 連線，建立或參與公司尾牙活動。
        </p>
        <div className="section-grid">
          <div className="section-item">
            <span className="meta-label">Wallet</span>
            <span className="meta-value mono">
              {isConnected ? shortAddress || '已連線' : '尚未連線 IOTA Snap'}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Network</span>
            <span className="meta-value">{network}</span>
          </div>
          <div className="section-item">
            <span className="meta-label">Snap</span>
            <span className="meta-value">
              {snapStatus === 'CONNECTED'
                ? 'IOTA Snap Connected'
                : snapStatus}
            </span>
          </div>
        </div>
      </section>

      <div className="activity-layout">
        <section className="card section">
          <div className="activity-tabs">
            <button
              type="button"
              className={
                activeTab === 'all'
                  ? 'activity-tab activity-tab-active'
                  : 'activity-tab'
              }
              onClick={() => setActiveTab('all')}
            >
              全部活動
            </button>
            <button
              type="button"
              className={
                activeTab === 'organized'
                  ? 'activity-tab activity-tab-active'
                  : 'activity-tab'
              }
              onClick={() => setActiveTab('organized')}
            >
              我建立的
            </button>
            <button
              type="button"
              className={
                activeTab === 'joined'
                  ? 'activity-tab activity-tab-active'
                  : 'activity-tab'
              }
              onClick={() => setActiveTab('joined')}
              disabled
            >
              我參加的（之後支援）
            </button>
          </div>
          <ActivityList
            activities={displayedActivities}
            currentAddress={currentAddress}
            isLoading={isLoading}
            onRefresh={() => {
              void refetch();
            }}
            onOpenDetail={handleOpenDetail}
          />
        </section>

        <section className="card section activity-create-panel">
          <CreateActivityPanel
            disabled={!isConnected}
            isCreating={isCreating}
            onCreate={handleCreate}
          />
        </section>
      </div>
    </div>
  );
}

