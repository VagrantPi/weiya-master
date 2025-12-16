import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layouts/AppLayout';
import { ActivityHomePage } from './pages/ActivityHomePage';
import { ActivityDetailPage } from './pages/ActivityDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/activities" replace />} />
          <Route path="/activities" element={<ActivityHomePage />} />
          <Route path="/activities/:id" element={<ActivityDetailPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
