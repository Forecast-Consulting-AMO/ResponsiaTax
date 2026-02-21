import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Delete,
  Description,
  Download,
  ExpandMore,
  AutoAwesome,
  Refresh,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { roundsApi } from '../api/rounds';
import { questionsApi } from '../api/questions';
import { documentsApi } from '../api/documents';
import { exportsApi } from '../api/exports';
import { StatusChip } from '../components/StatusChip';
import { FileUpload } from '../components/FileUpload';
import type {
  Round,
  RoundStatus,
  UpdateRoundDto,
  Question,
  Document,
} from '../types';

const ROUND_STATUSES: RoundStatus[] = [
  'pending',
  'in_progress',
  'responded',
  'closed',
];

export const RoundDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [round, setRound] = useState<Round | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>('question_dr');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const [editReceivedDate, setEditReceivedDate] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState<RoundStatus>('pending');

  const fetchRound = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await roundsApi.findOne(id);
      setRound(data);
      setEditReceivedDate(data.received_date ?? '');
      setEditDeadline(data.deadline ?? '');
      setEditStatus(data.status);
    } catch {
      enqueueSnackbar(t('roundDetail.errors.fetchFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar, t]);

  const fetchQuestions = useCallback(async () => {
    if (!id) return;
    try {
      const data = await questionsApi.findAll(id);
      setQuestions(data);
    } catch {
      enqueueSnackbar(t('roundDetail.errors.questionsFetchFailed'), {
        variant: 'error',
      });
    }
  }, [id, enqueueSnackbar, t]);

  const fetchDocuments = useCallback(async () => {
    if (!round?.dossier_id) return;
    try {
      const allDocs = await documentsApi.findAll(round.dossier_id);
      // Filter documents for this round or with no round (dossier-level)
      const roundDocs = allDocs.filter(
        (d: Document) => d.round_id === id || d.round_id === null,
      );
      setDocuments(roundDocs);
    } catch {
      enqueueSnackbar(t('roundDetail.errors.documentsFetchFailed'), {
        variant: 'error',
      });
    }
  }, [round?.dossier_id, id, enqueueSnackbar, t]);

  useEffect(() => {
    fetchRound();
    fetchQuestions();
  }, [fetchRound, fetchQuestions]);

  useEffect(() => {
    if (round) {
      fetchDocuments();
    }
  }, [round, fetchDocuments]);

  const handleSaveRound = useCallback(async () => {
    if (!id) return;
    try {
      setSaving(true);
      const updateDto: UpdateRoundDto = {
        received_date: editReceivedDate || undefined,
        deadline: editDeadline || undefined,
        status: editStatus,
      };
      const updated = await roundsApi.update(id, updateDto);
      setRound(updated);
      enqueueSnackbar(t('roundDetail.saved'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('roundDetail.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [id, editReceivedDate, editDeadline, editStatus, enqueueSnackbar, t]);

  const handleExtractQuestions = useCallback(async () => {
    if (!round) return;
    // Find a question_dr document
    const questionDoc = documents.find((d) => d.doc_type === 'question_dr');
    if (!questionDoc) {
      enqueueSnackbar(t('roundDetail.errors.noQuestionDocument'), {
        variant: 'warning',
      });
      return;
    }

    try {
      setExtracting(true);

      // Trigger OCR first if not done
      if (!questionDoc.ocr_text) {
        enqueueSnackbar(t('roundDetail.ocrInProgress'), { variant: 'info' });
        await documentsApi.triggerOcr(questionDoc.id);
      }

      // Extract questions from the document (documentId first, then roundId)
      const extracted = await questionsApi.extractQuestions(
        questionDoc.id,
        round.id,
      );
      enqueueSnackbar(
        t('roundDetail.questionsExtracted', { count: extracted.length }),
        { variant: 'success' },
      );
      fetchQuestions();
    } catch {
      enqueueSnackbar(t('roundDetail.errors.extractFailed'), {
        variant: 'error',
      });
    } finally {
      setExtracting(false);
    }
  }, [round, documents, enqueueSnackbar, t, fetchQuestions]);

  const handleExport = useCallback(async () => {
    if (!id) return;
    try {
      setExporting(true);
      const blob = await exportsApi.exportDocx(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `round-${id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar(t('roundDetail.exported'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('roundDetail.errors.exportFailed'), {
        variant: 'error',
      });
    } finally {
      setExporting(false);
    }
  }, [id, enqueueSnackbar, t]);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!round?.dossier_id) return;
      try {
        setUploading(true);
        await documentsApi.upload(round.dossier_id, files, uploadDocType as any, id);
        enqueueSnackbar(t('roundDetail.documentsUploaded'), {
          variant: 'success',
        });
        fetchDocuments();
      } catch {
        enqueueSnackbar(t('roundDetail.errors.uploadFailed'), {
          variant: 'error',
        });
      } finally {
        setUploading(false);
      }
    },
    [round?.dossier_id, id, enqueueSnackbar, t, fetchDocuments],
  );

  const handleTriggerOcr = useCallback(
    async (docId: string) => {
      try {
        setOcrLoading(docId);
        await documentsApi.triggerOcr(docId);
        enqueueSnackbar(t('roundDetail.ocrComplete'), { variant: 'success' });
        fetchDocuments();
      } catch {
        enqueueSnackbar(t('roundDetail.errors.ocrFailed'), {
          variant: 'error',
        });
      } finally {
        setOcrLoading(null);
      }
    },
    [enqueueSnackbar, t, fetchDocuments],
  );

  const handleDownload = useCallback(
    async (docId: string) => {
      try {
        const blob = await documentsApi.download(docId);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } catch {
        enqueueSnackbar(t('roundDetail.errors.downloadFailed'), {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar, t],
  );

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      try {
        await documentsApi.remove(docId);
        enqueueSnackbar(t('dossierDetail.documentDeleted'), {
          variant: 'success',
        });
        setDeleteDocId(null);
        fetchDocuments();
      } catch {
        enqueueSnackbar(t('roundDetail.errors.deleteFailed'), {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar, t, fetchDocuments],
  );

  const isDeadlineApproaching = useCallback((deadline: string | null) => {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysUntil =
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= 7;
  }, []);

  const isDeadlinePassed = useCallback((deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }, []);

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

  if (!round) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>{t('roundDetail.notFound')}</Typography>
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
        {round.dossier && (
          <Link
            component={RouterLink}
            to={`/dossiers/${round.dossier_id}`}
            underline="hover"
            color="inherit"
          >
            {round.dossier.name}
          </Link>
        )}
        <Typography color="text.primary">
          {t('roundDetail.tourN', { n: round.round_number })}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h5" fontWeight={700}>
                {t('roundDetail.tourN', { n: round.round_number })}
              </Typography>
              <StatusChip status={round.status} type="round" />
            </Box>

            {round.deadline && isDeadlinePassed(round.deadline) && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {t('roundDetail.deadlinePassed')}
              </Alert>
            )}
            {round.deadline &&
              isDeadlineApproaching(round.deadline) &&
              !isDeadlinePassed(round.deadline) && (
                <Alert severity="warning" icon={<Warning />} sx={{ mt: 1 }}>
                  {t('roundDetail.deadlineApproaching')}
                </Alert>
              )}
          </Box>

          <Button
            variant="contained"
            onClick={handleSaveRound}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <CheckCircle />}
            size="small"
          >
            {t('common.save')}
          </Button>
        </Box>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label={t('roundDetail.fields.receivedDate')}
              type="date"
              value={editReceivedDate}
              onChange={(e) => setEditReceivedDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label={t('roundDetail.fields.deadline')}
              type="date"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              color={
                isDeadlineApproaching(editDeadline) ||
                isDeadlinePassed(editDeadline)
                  ? 'warning'
                  : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <InputLabel>{t('roundDetail.fields.status')}</InputLabel>
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as RoundStatus)}
                label={t('roundDetail.fields.status')}
              >
                {ROUND_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {t(`rounds.status.${s}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Left column - Questions */}
        <Grid size={{ xs: 12, md: 7 }}>
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
                {t('roundDetail.questions.title')} ({questions.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    extracting ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AutoAwesome />
                    )
                  }
                  onClick={handleExtractQuestions}
                  disabled={extracting}
                >
                  {t('roundDetail.questions.extract')}
                </Button>
              </Box>
            </Box>

            {extracting && <LinearProgress sx={{ mb: 2 }} />}

            {questions.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  textAlign: 'center',
                  color: 'text.secondary',
                }}
              >
                <Typography variant="body2">
                  {t('roundDetail.questions.empty')}
                </Typography>
                <Typography variant="caption">
                  {t('roundDetail.questions.emptyHint')}
                </Typography>
              </Box>
            ) : (
              questions
                .sort((a, b) => a.question_number - b.question_number)
                .map((question) => (
                  <Accordion key={question.id} sx={{ mb: 1, overflow: 'hidden' }}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          width: '100%',
                          minWidth: 0,
                          mr: 1,
                        }}
                      >
                        <Chip
                          label={`Q${question.question_number}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ flexShrink: 0 }}
                        />
                        <Typography sx={{ flex: 1, minWidth: 0 }} noWrap>
                          {question.question_text}
                        </Typography>
                        <StatusChip status={question.status} type="question" />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography
                        variant="body2"
                        sx={{
                          bgcolor: 'grey.50',
                          p: 2,
                          borderRadius: 1,
                          fontStyle: 'italic',
                          mb: 2,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {question.question_text}
                      </Typography>

                      {question.response_text && (
                        <Box sx={{ mb: 2 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={600}
                          >
                            {t('roundDetail.questions.response')}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}
                          >
                            {question.response_text}
                          </Typography>
                        </Box>
                      )}

                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate(`/questions/${question.id}`)}
                      >
                        {t('roundDetail.questions.answer')}
                      </Button>
                    </AccordionDetails>
                  </Accordion>
                ))
            )}
          </Paper>

          {/* Export section */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  {t('roundDetail.export.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('roundDetail.export.description')}
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={
                  exporting ? <CircularProgress size={16} /> : <Download />
                }
                onClick={handleExport}
                disabled={exporting}
              >
                {t('roundDetail.export.button')}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Right column - Documents */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              {t('roundDetail.documents.title')}
            </Typography>

            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                <InputLabel>{t('document.upload')}</InputLabel>
                <Select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  label={t('document.upload')}
                >
                  <MenuItem value="question_dr">{t('document.types.question_dr')}</MenuItem>
                  <MenuItem value="support">{t('document.types.support')}</MenuItem>
                  <MenuItem value="response_draft">{t('document.types.response_draft')}</MenuItem>
                  <MenuItem value="other">{t('document.types.other')}</MenuItem>
                </Select>
              </FormControl>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.png"
                multiple
                label={t('roundDetail.documents.upload')}
              />
              {uploading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <CircularProgress size={20} />
                </Box>
              )}
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
                <Typography variant="body2">
                  {t('roundDetail.documents.empty')}
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {documents.map((doc) => (
                  <ListItem key={doc.id} sx={{ px: 0, flexWrap: 'wrap' }}>
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
                          {doc.ocr_text && (
                            <Chip
                              label="OCR"
                              size="small"
                              color="success"
                              sx={{ fontSize: '0.65rem', height: 18 }}
                            />
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title={t('roundDetail.documents.ocr')}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleTriggerOcr(doc.id)}
                          disabled={ocrLoading === doc.id}
                          sx={{ mr: 0.5 }}
                        >
                          {ocrLoading === doc.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Refresh fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.download')}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleDownload(doc.id)}
                        >
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => setDeleteDocId(doc.id)}
                          color="error"
                        >
                          <Delete fontSize="small" />
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

      {/* Delete document confirmation dialog */}
      <Dialog open={!!deleteDocId} onClose={() => setDeleteDocId(null)}>
        <DialogTitle>{t('dossierDetail.documents.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('dossierDetail.documents.deleteMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDocId(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => deleteDocId && handleDeleteDocument(deleteDocId)}
            color="error"
            variant="contained"
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
