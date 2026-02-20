import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Box,
  TextField,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { Add, Search, FolderOpen } from '@mui/icons-material';
import { dossiersApi } from '../api/dossiers';
import { StatusChip } from '../components/StatusChip';
import type { Dossier, DossierStatus, CreateDossierDto } from '../types';

const TAX_TYPES = [
  'Précompte Professionnel',
  'CIR/CII',
  'ISoc',
  'IPP',
  'TVA',
  'Autre',
];

const STATUS_FILTERS: Array<DossierStatus | 'all'> = [
  'all',
  'open',
  'in_progress',
  'completed',
  'closed',
];

const initialFormState: CreateDossierDto = {
  name: '',
  company_name: '',
  company_number: '',
  tax_type: '',
  tax_year: '',
  reference: '',
  controller_name: '',
  controller_email: '',
};

export const DossierListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateDossierDto>(initialFormState);
  const [creating, setCreating] = useState(false);

  const fetchDossiers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dossiersApi.findAll();
      setDossiers(data);
    } catch {
      enqueueSnackbar(t('dossiers.errors.fetchFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  useEffect(() => {
    fetchDossiers();
  }, [fetchDossiers]);

  const filteredDossiers = useMemo(() => {
    let result = dossiers;

    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.company_name.toLowerCase().includes(q) ||
          (d.reference && d.reference.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [dossiers, statusFilter, searchQuery]);

  const handleOpenDialog = useCallback(() => {
    setFormData(initialFormState);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleFormChange = useCallback(
    (field: keyof CreateDossierDto, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleCreate = useCallback(async () => {
    if (!formData.name || !formData.company_name || !formData.tax_year || !formData.tax_type) {
      enqueueSnackbar(t('dossiers.errors.requiredFields'), { variant: 'warning' });
      return;
    }

    try {
      setCreating(true);
      const created = await dossiersApi.create(formData);
      enqueueSnackbar(t('dossiers.created'), { variant: 'success' });
      setDialogOpen(false);
      navigate(`/dossiers/${created.id}`);
    } catch {
      enqueueSnackbar(t('dossiers.errors.createFailed'), { variant: 'error' });
    } finally {
      setCreating(false);
    }
  }, [formData, enqueueSnackbar, t, navigate]);

  const formatDate = useCallback(
    (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString(t('common.locale') || 'fr-BE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    },
    [t],
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" fontWeight={700}>
          {t('dossiers.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenDialog}
          size="large"
        >
          {t('dossiers.create')}
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={statusFilter}
          onChange={(_, val) => setStatusFilter(val)}
          sx={{ mb: 2 }}
        >
          {STATUS_FILTERS.map((status) => (
            <Tab
              key={status}
              value={status}
              label={t(`dossiers.statusFilter.${status}`)}
            />
          ))}
        </Tabs>

        <TextField
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          fullWidth
          sx={{ maxWidth: 400 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!loading && filteredDossiers.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 8,
            color: 'text.secondary',
          }}
        >
          <FolderOpen sx={{ fontSize: 64, mb: 2, opacity: 0.4 }} />
          <Typography variant="h6">{t('dossiers.empty.title')}</Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            {t('dossiers.empty.description')}
          </Typography>
          <Button variant="outlined" startIcon={<Add />} onClick={handleOpenDialog}>
            {t('dossiers.create')}
          </Button>
        </Box>
      )}

      {/* Dossier grid */}
      {!loading && filteredDossiers.length > 0 && (
        <Grid container spacing={3}>
          {filteredDossiers.map((dossier) => (
            <Grid key={dossier.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                elevation={1}
                sx={{
                  height: '100%',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(`/dossiers/${dossier.id}`)}
                  sx={{ height: '100%' }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="h6"
                        component="h2"
                        fontWeight={600}
                        noWrap
                        sx={{ flex: 1, mr: 1 }}
                      >
                        {dossier.name}
                      </Typography>
                      <StatusChip status={dossier.status} type="dossier" />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {dossier.company_name}
                    </Typography>

                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        flexWrap: 'wrap',
                        mt: 1.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.25,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        {dossier.tax_type}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.25,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        {dossier.tax_year}
                      </Typography>
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1.5 }}
                    >
                      {formatDate(dossier.created_at)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('dossiers.createDialog.title')}</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              pt: 1,
            }}
          >
            <TextField
              label={t('dossiers.fields.name')}
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={t('dossiers.fields.companyName')}
              value={formData.company_name}
              onChange={(e) => handleFormChange('company_name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={t('dossiers.fields.companyNumber')}
              value={formData.company_number ?? ''}
              onChange={(e) => handleFormChange('company_number', e.target.value)}
              fullWidth
            />
            <FormControl fullWidth required>
              <InputLabel>{t('dossiers.fields.taxType')}</InputLabel>
              <Select
                value={formData.tax_type}
                onChange={(e) => handleFormChange('tax_type', e.target.value)}
                label={t('dossiers.fields.taxType')}
              >
                {TAX_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('dossiers.fields.taxYear')}
              value={formData.tax_year}
              onChange={(e) => handleFormChange('tax_year', e.target.value)}
              required
              fullWidth
              placeholder="2024"
            />
            <TextField
              label={t('dossiers.fields.reference')}
              value={formData.reference ?? ''}
              onChange={(e) => handleFormChange('reference', e.target.value)}
              fullWidth
            />
            <TextField
              label={t('dossiers.fields.controllerName')}
              value={formData.controller_name ?? ''}
              onChange={(e) => handleFormChange('controller_name', e.target.value)}
              fullWidth
            />
            <TextField
              label={t('dossiers.fields.controllerEmail')}
              value={formData.controller_email ?? ''}
              onChange={(e) => handleFormChange('controller_email', e.target.value)}
              fullWidth
              type="email"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={creating}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <Add />}
          >
            {t('dossiers.createDialog.submit')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
