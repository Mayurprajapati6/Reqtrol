import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { queryClient } from '@/lib/queryClient';
import AppRoutes from './routes';

export default function Providers() {
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
      </MotionConfig>
  );
}
