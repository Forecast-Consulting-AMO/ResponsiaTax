import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Button,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  FolderOpen,
  QuestionAnswer,
  Description,
  Warning,
  Add,
  ArrowForward,
} from '@mui/icons-material';
import { dossiersApi } from '../api/dossiers';
import type { Dossier } from '../types';
import { StatusChip } from '../components/StatusChip';

interface DossierWithCounts extends Dossier {
  rounds_count?: number;
  documents_count?: number;
}

export const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState<DossierWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDossiers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await dossiersApi.findAll(undefined, undefined, 100);
      setDossiers(result.data as DossierWithCounts[]);
    } catch {
      // Silent fail for dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDossiers();
  }, [fetchDossiers]);

  // Compute stats
  const totalDossiers = dossiers.length;
  const openDossiers = dossiers.filter(
    (d) => d.status === 'open' || d.status === 'in_progress',
  ).length;
  const completedDossiers = dossiers.filter(
    (d) => d.status === 'completed' || d.status === 'closed',
  ).length;
  const totalRounds = dossiers.reduce(
    (sum, d) => sum + (d.rounds_count ?? d.rounds?.length ?? 0),
    0,
  );
  const totalDocuments = dossiers.reduce(
    (sum, d) => sum + (d.documents_count ?? d.documents?.length ?? 0),
    0,
  );

  // Recent dossiers (last 5, sorted by updated_at)
  const recentDossiers = [...dossiers]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5);

  // Active dossiers (open or in_progress)
  const activeDossiers = dossiers.filter(
    (d) => d.status === 'open' || d.status === 'in_progress',
  );

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {t('home.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('home.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/dossiers')}
        >
          {t('dossiers.create')}
        </Button>
      </Box>

      {/* Stat cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 2,
          mb: 4,
        }}
      >
        <StatCard
          icon={<FolderOpen />}
          label={t('home.stats.totalDossiers')}
          value={totalDossiers}
          color="primary.main"
        />
        <StatCard
          icon={<Warning />}
          label={t('home.stats.activeDossiers')}
          value={openDossiers}
          color="warning.main"
        />
        <StatCard
          icon={<QuestionAnswer />}
          label={t('home.stats.totalRounds')}
          value={totalRounds}
          color="info.main"
        />
        <StatCard
          icon={<Description />}
          label={t('home.stats.totalDocuments')}
          value={totalDocuments}
          color="success.main"
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Active dossiers */}
        <Paper sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography variant="h6" fontWeight={600}>
              {t('home.activeDossiers')}
            </Typography>
            <Chip
              label={activeDossiers.length}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Box>
          {activeDossiers.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              <FolderOpen sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
              <Typography variant="body2">{t('home.noActiveDossiers')}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {activeDossiers.slice(0, 5).map((d) => (
                <Box
                  key={d.id}
                  onClick={() => navigate(`/dossiers/${d.id}`)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                    },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                    >
                      {d.company_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {d.tax_type} - {d.tax_year}
                      {d.rounds_count
                        ? ` | ${d.rounds_count} ${t('home.rounds')}`
                        : ''}
                    </Typography>
                  </Box>
                  <StatusChip status={d.status} type="dossier" />
                  <ArrowForward sx={{ color: 'text.disabled', fontSize: 18 }} />
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        {/* Recent activity */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {t('home.recentActivity')}
          </Typography>
          {recentDossiers.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              <FolderOpen sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
              <Typography variant="body2">{t('home.noDossiers')}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {recentDossiers.map((d) => {
                const progress = d.status === 'completed' || d.status === 'closed' ? 100
                  : d.status === 'in_progress' ? 50 : 10;
                return (
                  <Box
                    key={d.id}
                    onClick={() => navigate(`/dossiers/${d.id}`)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'primary.50',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
                        {d.name || d.company_name}
                      </Typography>
                      <StatusChip status={d.status} type="dossier" />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {d.company_name} | {d.tax_type} {d.tax_year}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        mt: 1,
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'grey.100',
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Box>

      {/* Completion overview */}
      {totalDossiers > 0 && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {t('home.completionOverview')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={
                  totalDossiers > 0
                    ? (completedDossiers / totalDossiers) * 100
                    : 0
                }
                sx={{
                  height: 12,
                  borderRadius: 6,
                  bgcolor: 'grey.100',
                  '& .MuiLinearProgress-bar': { borderRadius: 6 },
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {completedDossiers}/{totalDossiers} {t('home.completed')}
            </Typography>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

// Stat card component
const StatCard = ({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) => (
  <Paper
    sx={{
      p: 2.5,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
    }}
  >
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: `${color}15`,
        color,
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="h5" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  </Paper>
);
