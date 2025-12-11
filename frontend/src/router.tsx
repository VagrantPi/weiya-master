import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layouts/AppLayout';
import { OrganizerLayout } from './components/layouts/OrganizerLayout';
import { LandingPage } from './pages/LandingPage';
import { OrganizerActivitiesPage } from './pages/organizer/OrganizerActivitiesPage';
import { OrganizerActivityDetailPage } from './pages/organizer/OrganizerActivityDetailPage';
import { ParticipantActivityPage } from './pages/participant/ParticipantActivityPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<LandingPage />} />

          <Route path="/organizer" element={<OrganizerLayout />}>
            <Route index element={<OrganizerActivitiesPage />} />
            <Route
              path="activities/:activityId"
              element={<OrganizerActivityDetailPage />}
            />
          </Route>

          <Route path="/party/:activityId" element={<ParticipantActivityPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

