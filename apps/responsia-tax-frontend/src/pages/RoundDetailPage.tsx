import { useCallback, useEffect, useRef, useState } from 'react';
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
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  alpha,
} from '@mui/material';
import {
  Delete,
  Description,
  Download,
  AutoAwesome,
  Refresh,
  CheckCircle,
  Warning,
  ChevronRight,
  QuestionAnswer,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import { roundsApi } from '../api/rounds';
import { questionsApi } from '../api/questions';
import { documentsApi } from '../api/documents';
import { exportsApi } from '../api/exports';
import { llmApi } from '../api/llm';
import { StatusChip } from '../components/StatusChip';
import { FileUpload } from '../components/FileUpload';
import { BatchUploadDialog } from '../components/BatchUploadDialog';
import type { BatchUploadItem } from '../components/BatchUploadDialog';
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
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);
  const [massDeleting, setMassDeleting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [draftingAll, setDraftingAll] = useState(false);
  const [draftProgress, setDraftProgress] = useState({ current: 0, total: 0 });
  const draftAbortRef = useRef(false);

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

  const handleDraftAll = useCallback(async () => {
    const unanswered = questions
      .filter((q) => !q.response_text)
      .sort((a, b) => a.question_number - b.question_number);

    if (unanswered.length === 0) {
      enqueueSnackbar(t('roundDetail.questions.allAnswered'), { variant: 'info' });
      return;
    }

    try {
      setDraftingAll(true);
      draftAbortRef.current = false;
      setDraftProgress({ current: 0, total: unanswered.length });

      const models = await llmApi.getModels();
      const defaultModel = models[0]?.id;
      if (!defaultModel) {
        enqueueSnackbar(t('roundDetail.errors.noModels'), { variant: 'error' });
        return;
      }

      for (let i = 0; i < unanswered.length; i++) {
        if (draftAbortRef.current) break;
        setDraftProgress({ current: i + 1, total: unanswered.length });

        await llmApi.chat(unanswered[i].id, {
          message: t('questionDetail.chat.quickDraft'),
          model: defaultModel,
          autoApplyToResponse: true,
          includeDocuments: true,
        });
      }

      fetchQuestions();
      if (!draftAbortRef.current) {
        enqueueSnackbar(
          t('roundDetail.questions.draftAllComplete', { count: unanswered.length }),
          { variant: 'success' },
        );
      } else {
        enqueueSnackbar(t('roundDetail.questions.draftAllCancelled'), { variant: 'warning' });
      }
    } catch {
      enqueueSnackbar(t('roundDetail.errors.draftAllFailed'), { variant: 'error' });
    } finally {
      setDraftingAll(false);
      setDraftProgress({ current: 0, total: 0 });
    }
  }, [questions, enqueueSnackbar, t, fetchQuestions]);

  const handleCancelDraftAll = useCallback(() => {
    draftAbortRef.current = true;
  }, []);

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
    (files: File[]) => {
      setPendingFiles(files);
    },
    [],
  );

  const handleBatchUploadConfirm = useCallback(
    async (items: BatchUploadItem[]) => {
      if (!round?.dossier_id) return;
      try {
        setUploading(true);
        await documentsApi.uploadBatch(
          round.dossier_id,
          items.map((i) => ({ file: i.file, docType: i.docType })),
          id,
        );
        enqueueSnackbar(t('roundDetail.documentsUploaded'), {
          variant: 'success',
        });
        setPendingFiles([]);
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

  const handleToggleSelect = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedDocIds((prev) =>
      prev.size === documents.length
        ? new Set()
        : new Set(documents.map((d) => d.id)),
    );
  }, [documents]);

  const handleMassDelete = useCallback(async () => {
    if (selectedDocIds.size === 0) return;
    try {
      setMassDeleting(true);
      const result = await documentsApi.removeBatch(Array.from(selectedDocIds));
      enqueueSnackbar(
        t('roundDetail.documents.massDeleted', { count: result.deleted }),
        { variant: 'success' },
      );
      setSelectedDocIds(new Set());
      setMassDeleteOpen(false);
      fetchDocuments();
    } catch {
      enqueueSnackbar(t('roundDetail.errors.deleteFailed'), { variant: 'error' });
    } finally {
      setMassDeleting(false);
    }
  }, [selectedDocIds, enqueueSnackbar, t, fetchDocuments]);

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
            {/* Header */}
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
                {draftingAll ? (
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    startIcon={<Stop />}
                    onClick={handleCancelDraftAll}
                  >
                    {t('roundDetail.questions.cancelDraft')}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrow />}
                    onClick={handleDraftAll}
                    disabled={extracting || questions.filter((q) => !q.response_text).length === 0}
                  >
                    {t('roundDetail.questions.draftAll')}
                  </Button>
                )}
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
                  disabled={extracting || draftingAll}
                >
                  {t('roundDetail.questions.extract')}
                </Button>
              </Box>
            </Box>

            {extracting && <LinearProgress sx={{ mb: 2 }} />}

            {draftingAll && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('roundDetail.questions.draftingProgress', {
                      current: draftProgress.current,
                      total: draftProgress.total,
                    })}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={draftProgress.total > 0 ? (draftProgress.current / draftProgress.total) * 100 : 0}
                  color="secondary"
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            )}

            {/* Progress bar */}
            {questions.length > 0 && (() => {
              const answered = questions.filter((q) => q.response_text).length;
              const reviewed = questions.filter((q) => q.status === 'reviewed' || q.status === 'approved').length;
              const pct = Math.round((answered / questions.length) * 100);
              return (
                <Box sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {answered}/{questions.length} {t('roundDetail.questions.answered')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {reviewed} {t('roundDetail.questions.reviewedCount')}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'grey.100',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        bgcolor: pct === 100 ? 'success.main' : 'primary.main',
                      },
                    }}
                  />
                </Box>
              );
            })()}

            {questions.length === 0 ? (
              <Box
                sx={{
                  py: 6,
                  textAlign: 'center',
                  color: 'text.secondary',
                }}
              >
                <QuestionAnswer sx={{ fontSize: 48, mb: 1.5, opacity: 0.15 }} />
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {t('roundDetail.questions.empty')}
                </Typography>
                <Typography variant="caption">
                  {t('roundDetail.questions.emptyHint')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {questions
                  .sort((a, b) => a.question_number - b.question_number)
                  .map((question) => (
                    <Box
                      key={question.id}
                      onClick={() => navigate(`/questions/${question.id}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
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
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        },
                      }}
                    >
                      {/* Question number */}
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          bgcolor: question.response_text ? 'primary.main' : 'grey.200',
                          color: question.response_text ? 'primary.contrastText' : 'text.secondary',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}
                      >
                        {question.question_number}
                      </Box>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.5,
                            mb: 0.5,
                          }}
                        >
                          {question.question_text}
                        </Typography>
                        {question.response_text ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {question.response_text}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled" fontStyle="italic">
                            {t('roundDetail.questions.noResponse')}
                          </Typography>
                        )}
                      </Box>

                      {/* Status + arrow */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          flexShrink: 0,
                          alignSelf: 'center',
                        }}
                      >
                        <StatusChip status={question.status} type="question" />
                        <ChevronRight sx={{ color: 'text.disabled', fontSize: 20 }} />
                      </Box>
                    </Box>
                  ))}
              </Box>
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
              {t('roundDetail.documents.title')} ({documents.length})
            </Typography>

            <Box sx={{ mb: 2 }}>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.png"
                multiple
                label={t('roundDetail.documents.upload')}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Selection toolbar */}
            {selectedDocIds.size > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                }}
              >
                <Typography variant="body2" fontWeight={500}>
                  {t('roundDetail.documents.selected', { count: selectedDocIds.size })}
                </Typography>
                <Button
                  size="small"
                  color="error"
                  variant="contained"
                  startIcon={<Delete fontSize="small" />}
                  onClick={() => setMassDeleteOpen(true)}
                >
                  {t('roundDetail.documents.deleteSelected')}
                </Button>
              </Box>
            )}

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
                {/* Select all */}
                <ListItem sx={{ px: 0 }}>
                  <Checkbox
                    size="small"
                    checked={selectedDocIds.size === documents.length}
                    indeterminate={selectedDocIds.size > 0 && selectedDocIds.size < documents.length}
                    onChange={handleToggleSelectAll}
                    sx={{ mr: 0.5 }}
                  />
                  <ListItemText
                    primary={
                      <Typography variant="caption" color="text.secondary">
                        {t('roundDetail.documents.selectAll')}
                      </Typography>
                    }
                  />
                </ListItem>
                <Divider />
                {documents.map((doc) => (
                  <ListItem key={doc.id} sx={{ px: 0, flexWrap: 'wrap' }}>
                    <Checkbox
                      size="small"
                      checked={selectedDocIds.has(doc.id)}
                      onChange={() => handleToggleSelect(doc.id)}
                      sx={{ mr: 0.5 }}
                    />
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

      {/* Mass delete confirmation dialog */}
      <Dialog open={massDeleteOpen} onClose={() => setMassDeleteOpen(false)}>
        <DialogTitle>{t('roundDetail.documents.massDeleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('roundDetail.documents.massDeleteMessage', { count: selectedDocIds.size })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMassDeleteOpen(false)} disabled={massDeleting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleMassDelete}
            color="error"
            variant="contained"
            disabled={massDeleting}
            startIcon={massDeleting ? <CircularProgress size={16} /> : undefined}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

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
