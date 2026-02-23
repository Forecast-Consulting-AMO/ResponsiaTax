import { useCallback, useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  Container,
  Typography,
  Button,
  Grid,
  Box,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
} from '@mui/material';
import {
  Add,
  Edit,
  Description,
  Download,
  FolderOpen,
  CheckCircle,
} from '@mui/icons-material';
import { dossiersApi } from '../api/dossiers';
import { roundsApi } from '../api/rounds';
import { documentsApi } from '../api/documents';
import { StatusChip } from '../components/StatusChip';
import { FileUpload } from '../components/FileUpload';
import { BatchUploadDialog } from '../components/BatchUploadDialog';
import type { BatchUploadItem } from '../components/BatchUploadDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type {
  Dossier,
  DossierStatus,
  UpdateDossierDto,
  Round,
  Document,
  DocType,
} from '../types';

const TAX_TYPES = [
  'Précompte Professionnel',
  'CIR/CII',
  'ISoc',
  'IPP',
  'TVA',
  'Autre',
];

const DOSSIER_STATUSES: DossierStatus[] = [
  'open',
  'in_progress',
  'completed',
  'closed',
];

export const DossierDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<UpdateDossierDto>({});
  const [addingRound, setAddingRound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const fetchDossier = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await dossiersApi.findOne(id);
      setDossier(data);
      setEditData({
        name: data.name,
        company_name: data.company_name,
        company_number: data.company_number ?? '',
        tax_type: data.tax_type,
        tax_year: data.tax_year,
        reference: data.reference ?? '',
        controller_name: data.controller_name ?? '',
        controller_email: data.controller_email ?? '',
        status: data.status,
        notes: data.notes ?? '',
        system_prompt: data.system_prompt ?? '',
      });
    } catch {
      enqueueSnackbar(t('dossierDetail.errors.fetchFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar, t]);

  const fetchRounds = useCallback(async () => {
    if (!id) return;
    try {
      const data = await roundsApi.findAll(id);
      setRounds(data);
    } catch {
      enqueueSnackbar(t('dossierDetail.errors.roundsFetchFailed'), {
        variant: 'error',
      });
    }
  }, [id, enqueueSnackbar, t]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    try {
      const data = await documentsApi.findAll(id);
      setDocuments(data);
    } catch {
      enqueueSnackbar(t('dossierDetail.errors.documentsFetchFailed'), {
        variant: 'error',
      });
    }
  }, [id, enqueueSnackbar, t]);

  useEffect(() => {
    fetchDossier();
    fetchRounds();
    fetchDocuments();
  }, [fetchDossier, fetchRounds, fetchDocuments]);

  const handleSave = useCallback(async () => {
    if (!id) return;
    try {
      setSaving(true);
      const updated = await dossiersApi.update(id, editData);
      setDossier(updated);
      setEditing(false);
      enqueueSnackbar(t('dossierDetail.saved'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('dossierDetail.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [id, editData, enqueueSnackbar, t]);

  const handleEditChange = useCallback(
    (field: keyof UpdateDossierDto, value: string) => {
      setEditData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleAddRound = useCallback(async () => {
    if (!id) return;
    try {
      setAddingRound(true);
      const nextNumber =
        rounds.length > 0
          ? Math.max(...rounds.map((r) => r.round_number)) + 1
          : 1;
      await roundsApi.create(id, {
        round_number: nextNumber,
        received_date: new Date().toISOString().split('T')[0],
      });
      enqueueSnackbar(t('dossierDetail.roundCreated'), { variant: 'success' });
      fetchRounds();
    } catch {
      enqueueSnackbar(t('dossierDetail.errors.roundCreateFailed'), {
        variant: 'error',
      });
    } finally {
      setAddingRound(false);
    }
  }, [id, rounds, enqueueSnackbar, t, fetchRounds]);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      setPendingFiles(files);
    },
    [],
  );

  const handleBatchUploadConfirm = useCallback(
    async (items: BatchUploadItem[]) => {
      if (!id) return;
      try {
        setUploading(true);
        await documentsApi.uploadBatch(
          id,
          items.map((i) => ({ file: i.file, docType: i.docType })),
        );
        enqueueSnackbar(t('dossierDetail.documentsUploaded'), {
          variant: 'success',
        });
        setPendingFiles([]);
        fetchDocuments();
      } catch {
        enqueueSnackbar(t('dossierDetail.errors.uploadFailed'), {
          variant: 'error',
        });
      } finally {
        setUploading(false);
      }
    },
    [id, enqueueSnackbar, t, fetchDocuments],
  );

  const handleDeleteDocument = useCallback(async () => {
    if (!deleteDocId) return;
    try {
      await documentsApi.remove(deleteDocId);
      enqueueSnackbar(t('dossierDetail.documentDeleted'), { variant: 'success' });
      setDeleteDocId(null);
      fetchDocuments();
    } catch {
      enqueueSnackbar(t('dossierDetail.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  }, [deleteDocId, enqueueSnackbar, t, fetchDocuments]);

  const handleDownload = useCallback(
    async (docId: string) => {
      try {
        const blob = await documentsApi.download(docId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } catch {
        enqueueSnackbar(t('dossierDetail.errors.downloadFailed'), {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar, t],
  );

  const formatDate = useCallback(
    (dateStr: string | null) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString(t('common.locale') || 'fr-BE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    },
    [t],
  );

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!dossier) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>{t('dossierDetail.notFound')}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component={RouterLink}
          to="/dossiers"
          underline="hover"
          color="inherit"
        >
          {t('dossiers.title')}
        </Link>
        <Typography color="text.primary">{dossier.name}</Typography>
      </Breadcrumbs>

      <Grid container spacing={3}>
        {/* Left column - Dossier info + Rounds */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Dossier info */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5" fontWeight={700}>
                  {dossier.name}
                </Typography>
                <StatusChip status={dossier.status} type="dossier" />
              </Box>
              {!editing ? (
                <Tooltip title={t('common.edit')}>
                  <IconButton onClick={() => setEditing(true)}>
                    <Edit />
                  </IconButton>
                </Tooltip>
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setEditing(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={
                      saving ? <CircularProgress size={16} /> : <CheckCircle />
                    }
                  >
                    {t('common.save')}
                  </Button>
                </Box>
              )}
            </Box>

            {!editing ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('dossiers.fields.companyName')}
                  </Typography>
                  <Typography>{dossier.company_name}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('dossiers.fields.companyNumber')}
                  </Typography>
                  <Typography>{dossier.company_number || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('dossiers.fields.taxType')}
                  </Typography>
                  <Typography>{dossier.tax_type}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('dossiers.fields.taxYear')}
                  </Typography>
                  <Typography>{dossier.tax_year}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('dossiers.fields.reference')}
                  </Typography>
                  <Typography>{dossier.reference || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('dossiers.fields.controllerName')}
                  </Typography>
                  <Typography>{dossier.controller_name || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('dossiers.fields.controllerEmail')}
                  </Typography>
                  <Typography>{dossier.controller_email || '-'}</Typography>
                </Grid>
                {dossier.notes && (
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      {t('dossiers.fields.notes')}
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {dossier.notes}
                    </Typography>
                  </Grid>
                )}
                {dossier.system_prompt && (
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary">
                      {t('dossiers.fields.systemPrompt')}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        bgcolor: 'action.hover',
                        p: 1.5,
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                      }}
                    >
                      {dossier.system_prompt}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label={t('dossiers.fields.name')}
                  value={editData.name ?? ''}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  required
                  fullWidth
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('dossiers.fields.companyName')}
                      value={editData.company_name ?? ''}
                      onChange={(e) =>
                        handleEditChange('company_name', e.target.value)
                      }
                      required
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('dossiers.fields.companyNumber')}
                      value={editData.company_number ?? ''}
                      onChange={(e) =>
                        handleEditChange('company_number', e.target.value)
                      }
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>{t('dossiers.fields.taxType')}</InputLabel>
                      <Select
                        value={editData.tax_type ?? ''}
                        onChange={(e) =>
                          handleEditChange('tax_type', e.target.value)
                        }
                        label={t('dossiers.fields.taxType')}
                      >
                        {TAX_TYPES.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('dossiers.fields.taxYear')}
                      value={editData.tax_year ?? ''}
                      onChange={(e) =>
                        handleEditChange('tax_year', e.target.value)
                      }
                      required
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <TextField
                  label={t('dossiers.fields.reference')}
                  value={editData.reference ?? ''}
                  onChange={(e) => handleEditChange('reference', e.target.value)}
                  fullWidth
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('dossiers.fields.controllerName')}
                      value={editData.controller_name ?? ''}
                      onChange={(e) =>
                        handleEditChange('controller_name', e.target.value)
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('dossiers.fields.controllerEmail')}
                      value={editData.controller_email ?? ''}
                      onChange={(e) =>
                        handleEditChange('controller_email', e.target.value)
                      }
                      fullWidth
                      type="email"
                    />
                  </Grid>
                </Grid>
                <FormControl fullWidth>
                  <InputLabel>{t('dossiers.fields.status')}</InputLabel>
                  <Select
                    value={editData.status ?? dossier.status}
                    onChange={(e) => handleEditChange('status', e.target.value)}
                    label={t('dossiers.fields.status')}
                  >
                    {DOSSIER_STATUSES.map((s) => (
                      <MenuItem key={s} value={s}>
                        {t(`dossiers.status.${s}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label={t('dossiers.fields.notes')}
                  value={editData.notes ?? ''}
                  onChange={(e) => handleEditChange('notes', e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                />
                <TextField
                  label={t('dossiers.fields.systemPrompt')}
                  value={editData.system_prompt ?? ''}
                  onChange={(e) =>
                    handleEditChange('system_prompt', e.target.value)
                  }
                  fullWidth
                  multiline
                  rows={6}
                  helperText={t('dossiers.fields.systemPromptHelp')}
                />
              </Box>
            )}
          </Paper>

          {/* Rounds */}
          <Paper sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                {t('dossierDetail.rounds.title')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={
                  addingRound ? <CircularProgress size={16} /> : <Add />
                }
                onClick={handleAddRound}
                disabled={addingRound}
                size="small"
              >
                {t('dossierDetail.rounds.add')}
              </Button>
            </Box>

            {rounds.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  textAlign: 'center',
                  color: 'text.secondary',
                }}
              >
                <Typography variant="body2">
                  {t('dossierDetail.rounds.empty')}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {rounds
                  .sort((a, b) => a.round_number - b.round_number)
                  .map((round, idx) => (
                    <Box key={round.id}>
                      {idx > 0 && <Divider />}
                      <ListItem
                        component={RouterLink}
                        to={`/rounds/${round.id}`}
                        sx={{
                          textDecoration: 'none',
                          color: 'inherit',
                          '&:hover': { bgcolor: 'action.hover' },
                          borderRadius: 1,
                          py: 1.5,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <Typography fontWeight={600}>
                                {t('dossierDetail.rounds.tourN', {
                                  n: round.round_number,
                                })}
                              </Typography>
                              <StatusChip
                                status={round.status}
                                type="round"
                              />
                            </Box>
                          }
                          secondary={
                            <Box
                              component="span"
                              sx={{
                                display: 'flex',
                                gap: 2,
                                mt: 0.5,
                              }}
                            >
                              <Typography variant="caption" component="span">
                                {t('dossierDetail.rounds.received')}:{' '}
                                {formatDate(round.received_date)}
                              </Typography>
                              <Typography variant="caption" component="span">
                                {t('dossierDetail.rounds.deadline')}:{' '}
                                {formatDate(round.deadline)}
                              </Typography>
                              {round.questions && (
                                <Typography variant="caption" component="span">
                                  {round.questions.length}{' '}
                                  {t('dossierDetail.rounds.questions')}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    </Box>
                  ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Right column - Documents */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              {t('dossierDetail.documents.title')}
            </Typography>

            <Box sx={{ mb: 2 }}>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.png"
                multiple
                label={t('dossierDetail.documents.upload')}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {documents.length === 0 ? (
              <Box
                sx={{
                  py: 3,
                  textAlign: 'center',
                  color: 'text.secondary',
                }}
              >
                <FolderOpen sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                <Typography variant="body2">
                  {t('dossierDetail.documents.empty')}
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {documents.map((doc) => (
                  <ListItem key={doc.id} sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Description fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap>
                          {doc.filename}
                        </Typography>
                      }
                      secondary={
                        <Box
                          component="span"
                          sx={{
                            display: 'flex',
                            gap: 1,
                            alignItems: 'center',
                          }}
                        >
                          <Chip
                            label={doc.doc_type}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                          <Typography variant="caption" component="span">
                            {formatFileSize(doc.file_size)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title={t('common.download')}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleDownload(doc.id)}
                        >
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Delete document confirmation */}
      <ConfirmDialog
        open={!!deleteDocId}
        title={t('dossierDetail.documents.deleteTitle')}
        message={t('dossierDetail.documents.deleteMessage')}
        onConfirm={handleDeleteDocument}
        onCancel={() => setDeleteDocId(null)}
      />

      {/* Batch upload dialog with auto-labeling */}
      <BatchUploadDialog
        open={pendingFiles.length > 0}
        files={pendingFiles}
        onClose={() => setPendingFiles([])}
        onConfirm={handleBatchUploadConfirm}
        uploading={uploading}
      />
    </Container>
  );
};
