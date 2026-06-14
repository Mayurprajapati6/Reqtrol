import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import Dashboard        from '@/components/pages/Dashboard';
import LiveFeed         from '@/components/pages/LiveFeed';
import RateLimiters     from '@/components/pages/RateLimiters';
import EndpointAnalytics from '@/components/pages/EndpointAnalytics';
import UserActivity     from '@/components/pages/UserActivity';
import RedisMonitor     from '@/components/pages/RedisMonitor';
import Simulator        from '@/components/pages/Simulator';
import IntegrationFlow  from '@/components/pages/IntegrationFlow';
import ScrollToTop from '@/components/routing/ScrollToTop';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppShell>
        <Routes>
          <Route path="/"                element={<Dashboard />} />
          <Route path="/live"            element={<LiveFeed />} />
          <Route path="/rate-limiters"   element={<RateLimiters />} />
          <Route path="/endpoints"       element={<EndpointAnalytics />} />
          <Route path="/users"           element={<UserActivity />} />
          <Route path="/simulator"       element={<Simulator />} />
          <Route path="/integration"     element={<IntegrationFlow />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
