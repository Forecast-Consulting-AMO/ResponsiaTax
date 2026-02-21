import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

const DossierListPage = lazy(() =>
  import('../pages/DossierListPage').then((m) => ({ default: m.DossierListPage })),
);
const DossierDetailPage = lazy(() =>
  import('../pages/DossierDetailPage').then((m) => ({ default: m.DossierDetailPage })),
);
const RoundDetailPage = lazy(() =>
  import('../pages/RoundDetailPage').then((m) => ({ default: m.RoundDetailPage })),
);
const QuestionDetailPage = lazy(() =>
  import('../pages/QuestionDetailPage').then((m) => ({ default: m.QuestionDetailPage })),
);
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const HomePage = lazy(() =>
  import('../pages/HomePage').then((m) => ({ default: m.HomePage })),
);

const PageLoader = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
    }}
  >
    <CircularProgress />
  </Box>
);

export const AppRouter = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dossiers" element={<DossierListPage />} />
        <Route path="/dossiers/:id" element={<DossierDetailPage />} />
        <Route path="/rounds/:id" element={<RoundDetailPage />} />
        <Route path="/questions/:id" element={<QuestionDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  );
};
