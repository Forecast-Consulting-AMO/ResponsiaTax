import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Container,
  Typography,
  Button,
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
  Chip,
  Checkbox,
  FormControlLabel,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Send,
  AutoAwesome,
  ContentCopy,
  Delete,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Chat,
  ChevronLeft,
  ChevronRight,
  Description,
  FolderOpen,
} from '@mui/icons-material';
import { RichTextEditor } from '../components/RichTextEditor';
import { questionsApi } from '../api/questions';
import { llmApi } from '../api/llm';
import { roundsApi } from '../api/rounds';
import { documentsApi } from '../api/documents';
import type {
  Question,
  QuestionStatus,
  LlmMessage,
  LlmModel,
  Document,
} from '../types';

const QUESTION_STATUSES: QuestionStatus[] = [
  'pending',
  'drafting',
  'reviewed',
  'approved',
];

export const QuestionDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Question state
  const [siblings, setSiblings] = useState<Array<{id: string; question_number: number}>>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [status, setStatus] = useState<QuestionStatus>('pending');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);

  // LLM Chat state
  const [models, setModels] = useState<LlmModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages] = useState<LlmMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [autoApply, setAutoApply] = useState(false);
  const [dossierDocuments, setDossierDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [docSelectorOpen, setDocSelectorOpen] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(true);
  const [systemPromptOverride, setSystemPromptOverride] = useState('');
  const [systemPromptLoaded, setSystemPromptLoaded] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Fetch question
  const fetchQuestion = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await questionsApi.findOne(id);
      setQuestion(data);
      setResponseText(data.response_text ?? '');
      setStatus(data.status);
      setNotes(data.notes ?? '');
    } catch {
      enqueueSnackbar(t('questionDetail.errors.fetchFailed'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar, t]);

  // Fetch LLM models
  const fetchModels = useCallback(async () => {
    try {
      const data = await llmApi.getModels();
      setModels(data);
      if (data.length > 0) {
        setSelectedModel((prev) => prev || data[0].id);
      }
    } catch {
      // Models fetch can fail silently -- settings might not be configured yet
    }
  }, []);

  // Fetch chat messages
  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const data = await llmApi.getMessages(id);
      setMessages(data);
    } catch {
      // Chat history fetch can fail silently on first use
    }
  }, [id]);

  // Fetch effective system prompt (pre-populate override field)
  const fetchSystemPrompt = useCallback(async () => {
    if (!id || systemPromptLoaded) return;
    try {
      const prompt = await llmApi.getSystemPrompt(id);
      if (prompt && !systemPromptOverride) {
        setSystemPromptOverride(prompt);
      }
      setSystemPromptLoaded(true);
    } catch {
      // Silently ignore - prompt will use default
    }
  }, [id, systemPromptLoaded, systemPromptOverride]);

  // Fetch documents for the dossier (for RAG document selector)
  const fetchDocuments = useCallback(async () => {
    if (!question?.round_id) return;
    try {
      const round = await roundsApi.findOne(question.round_id);
      if (round.dossier_id) {
        const docs = await documentsApi.findAll(round.dossier_id);
        setDossierDocuments(docs);
        // Select all documents with OCR text by default
        setSelectedDocIds(new Set(docs.filter((d) => d.ocr_text).map((d) => d.id)));
      }
    } catch {
      // Silently ignore - document selector is optional
    }
  }, [question?.round_id]);

  useEffect(() => {
    fetchQuestion();
    fetchModels();
    fetchMessages();
    fetchSystemPrompt();
  }, [fetchQuestion, fetchModels, fetchMessages, fetchSystemPrompt]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Fetch siblings for navigation
  useEffect(() => {
    if (!question?.round_id) return;
    questionsApi.findAll(question.round_id).then((data) => {
      setSiblings(data.map(q => ({ id: q.id, question_number: q.question_number })));
    }).catch(() => { /* silently ignore - navigation is optional */ });
  }, [question?.round_id]);

  const currentIdx = siblings.findIndex(s => s.id === id);
  const prevQuestion = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextQuestion = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  // Keyboard shortcuts for navigation (Ctrl+Left/Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'ArrowLeft' && prevQuestion) {
        navigate(`/questions/${prevQuestion.id}`);
      } else if (e.ctrlKey && e.key === 'ArrowRight' && nextQuestion) {
        navigate(`/questions/${nextQuestion.id}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevQuestion, nextQuestion, navigate]);

  // Debounced auto-save for response text
  const handleResponseChange = useCallback(
    (value: string) => {
      setResponseText(value);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        if (!id) return;
        try {
          await questionsApi.update(id, { response_text: value });
        } catch {
          // Silent fail for auto-save; user can manually save
        }
      }, 500);
    },
    [id],
  );

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Save response and status explicitly
  const handleSaveResponse = useCallback(async () => {
    if (!id) return;
    try {
      setSavingResponse(true);
      const updated = await questionsApi.update(id, {
        response_text: responseText,
        status,
        notes: notes || undefined,
      });
      setQuestion(updated);
      enqueueSnackbar(t('questionDetail.saved'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('questionDetail.errors.saveFailed'), {
        variant: 'error',
      });
    } finally {
      setSavingResponse(false);
    }
  }, [id, responseText, status, notes, enqueueSnackbar, t]);

  // Mark response as reviewed
  const handleMarkReviewed = useCallback(async () => {
    if (!id) return;
    try {
      const updated = await questionsApi.update(id, {
        response_text: responseText,
        status: 'reviewed',
      });
      setQuestion(updated);
      setStatus('reviewed');
      enqueueSnackbar(t('questionDetail.markedReviewed'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('questionDetail.errors.saveFailed'), {
        variant: 'error',
      });
    }
  }, [id, responseText, enqueueSnackbar, t]);

  // Send chat message (with SSE streaming)
  const handleSendMessage = useCallback(async () => {
    if (!id || !chatInput.trim() || !selectedModel) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setSending(true);
    setStreamingContent('');

    llmApi.chatStream(
      id,
      {
        message: messageText,
        model: selectedModel,
        systemPrompt: systemPromptOverride || undefined,
        autoApplyToResponse: autoApply,
        documentIds: selectedDocIds.size > 0 ? Array.from(selectedDocIds) : undefined,
        includeDocuments: selectedDocIds.size === 0 ? false : undefined,
      },
      // onDelta - accumulate streaming content
      (delta) => {
        setStreamingContent((prev) => prev + delta);
      },
      // onDone - finalize
      (response) => {
        setStreamingContent('');
        setSending(false);
        if (autoApply && response.content) {
          setResponseText(response.content);
          questionsApi.update(id, { response_text: response.content });
        }
        fetchMessages();
      },
      // onError
      (error) => {
        setSending(false);
        setStreamingContent('');
        enqueueSnackbar(error || t('questionDetail.errors.chatFailed'), {
          variant: 'error',
        });
      },
    );
  }, [
    id,
    chatInput,
    selectedModel,
    systemPromptOverride,
    autoApply,
    selectedDocIds,
    enqueueSnackbar,
    t,
    fetchMessages,
  ]);

  // Quick action: Draft response
  const handleQuickDraft = useCallback(() => {
    if (!question) return;
    setChatInput(
      `En te basant sur la question suivante, rédige une réponse professionnelle et complète:\n\n${question.question_text}`,
    );
  }, [question]);

  // Quick action: Improve response
  const handleQuickImprove = useCallback(() => {
    if (!responseText) {
      enqueueSnackbar(t('questionDetail.errors.noResponseToImprove'), {
        variant: 'warning',
      });
      return;
    }
    setChatInput(
      `Améliore la réponse suivante en la rendant plus professionnelle et complète:\n\n${responseText}`,
    );
  }, [responseText, enqueueSnackbar, t]);

  // Quick action: Summarize
  const handleQuickSummarize = useCallback(() => {
    if (!question) return;
    setChatInput(
      `Résume les points clés de cette question et ce qui est attendu:\n\n${question.question_text}`,
    );
  }, [question]);

  // Clear chat history
  const handleClearHistory = useCallback(async () => {
    if (!id) return;
    try {
      await llmApi.clearMessages(id);
      setMessages([]);
      enqueueSnackbar(t('questionDetail.chatCleared'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('questionDetail.errors.clearFailed'), {
        variant: 'error',
      });
    }
  }, [id, enqueueSnackbar, t]);

  // Copy assistant message to response
  const handleCopyToResponse = useCallback(
    (content: string) => {
      handleResponseChange(content);
      enqueueSnackbar(t('questionDetail.copiedToResponse'), {
        variant: 'info',
      });
    },
    [handleResponseChange, enqueueSnackbar, t],
  );

  // Handle Enter key in chat input
  const handleChatKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!question) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography>{t('questionDetail.notFound')}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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
        <Link
          component={RouterLink}
          to={`/rounds/${question.round_id}`}
          underline="hover"
          color="inherit"
        >
          {t('questionDetail.backToRound')}
        </Link>
        <Typography color="text.primary">
          Q{question.question_number}
        </Typography>
      </Breadcrumbs>

      {/* Question navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          size="small"
          startIcon={<ChevronLeft />}
          disabled={!prevQuestion}
          onClick={() => prevQuestion && navigate(`/questions/${prevQuestion.id}`)}
        >
          Q{prevQuestion?.question_number ?? ''}
        </Button>
        <Typography variant="h6" fontWeight={600} sx={{ flex: 1, textAlign: 'center' }}>
          {t('questionDetail.title', { number: question.question_number })}
        </Typography>
        <Button
          size="small"
          endIcon={<ChevronRight />}
          disabled={!nextQuestion}
          onClick={() => nextQuestion && navigate(`/questions/${nextQuestion.id}`)}
        >
          Q{nextQuestion?.question_number ?? ''}
        </Button>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 3,
          height: 'calc(100vh - 180px)',
          minHeight: 600,
        }}
      >
        {/* Left panel - Question & Response */}
        <Paper
          sx={{
            flex: 1,
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Question text */}
          <Box
            sx={{
              bgcolor: 'grey.100',
              p: 2,
              borderRadius: 1,
              mb: 2,
              flexShrink: 0,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}
            >
              {question.question_text}
            </Typography>
          </Box>

          {/* Status + controls */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('questionDetail.fields.status')}</InputLabel>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuestionStatus)}
                label={t('questionDetail.fields.status')}
              >
                {QUESTION_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {t(`questions.status.${s}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowNotes(!showNotes)}
              endIcon={showNotes ? <ExpandLess /> : <ExpandMore />}
            >
              {t('questionDetail.fields.notes')}
            </Button>

            <Box sx={{ flex: 1 }} />

            <Button
              variant="outlined"
              size="small"
              onClick={handleMarkReviewed}
              startIcon={<CheckCircle />}
              color="success"
            >
              {t('questionDetail.markReviewed')}
            </Button>

            <Button
              variant="contained"
              size="small"
              onClick={handleSaveResponse}
              disabled={savingResponse}
              startIcon={
                savingResponse ? <CircularProgress size={16} /> : undefined
              }
            >
              {t('common.save')}
            </Button>
          </Box>

          {/* Notes (collapsible) */}
          <Collapse in={showNotes}>
            <TextField
              label={t('questionDetail.fields.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              sx={{ mb: 2 }}
            />
          </Collapse>

          {/* Response editor */}
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            {t('questionDetail.response.title')}
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <RichTextEditor
              content={responseText}
              onChange={handleResponseChange}
              placeholder={t('questionDetail.response.placeholder')}
            />
          </Box>
        </Paper>

        {/* Right panel - LLM Chat */}
        <Paper
          sx={{
            flex: 1,
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Chat header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <Chat color="primary" />
            <Typography variant="h6" fontWeight={600}>
              {t('questionDetail.chat.title')}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('questionDetail.chat.model')}</InputLabel>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                label={t('questionDetail.chat.model')}
              >
                {models.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* System prompt (collapsible, expanded by default) */}
          <Box sx={{ flexShrink: 0, mb: 1 }}>
            <Button
              size="small"
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              endIcon={showSystemPrompt ? <ExpandLess /> : <ExpandMore />}
              sx={{ mb: 0.5 }}
            >
              {t('questionDetail.chat.systemPrompt')}
            </Button>
            <Collapse in={showSystemPrompt}>
              <TextField
                label={t('questionDetail.chat.systemPrompt')}
                value={systemPromptOverride}
                onChange={(e) => setSystemPromptOverride(e.target.value)}
                placeholder={t('questionDetail.chat.systemPromptPlaceholder')}
                fullWidth
                multiline
                minRows={3}
                maxRows={10}
                size="small"
                sx={{
                  mb: 1,
                  '& .MuiInputBase-root': {
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                  },
                }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Collapse>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Chat messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              mb: 2,
              px: 0.5,
            }}
          >
            {messages.length === 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: 'text.secondary',
                  py: 4,
                }}
              >
                <AutoAwesome sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography variant="body2">
                  {t('questionDetail.chat.empty')}
                </Typography>
              </Box>
            )}

            {messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems:
                    msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    p: 2,
                    borderRadius: 2,
                    bgcolor:
                      msg.role === 'user'
                        ? 'primary.main'
                        : msg.role === 'system'
                          ? 'grey.200'
                          : 'grey.50',
                    color:
                      msg.role === 'user'
                        ? 'primary.contrastText'
                        : 'text.primary',
                    border: msg.role === 'assistant' ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <Box
                      sx={{
                        '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                        '& ul, & ol': { m: 0, mb: 1, pl: 2.5 },
                        '& li': { mb: 0.5 },
                        '& code': {
                          bgcolor: 'action.hover',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontSize: '0.85em',
                          fontFamily: 'monospace',
                        },
                        '& pre': {
                          bgcolor: 'grey.900',
                          color: 'grey.100',
                          p: 1.5,
                          borderRadius: 1,
                          overflow: 'auto',
                          mb: 1,
                          '& code': { bgcolor: 'transparent', p: 0, color: 'inherit' },
                        },
                        '& h1, & h2, & h3, & h4': { mt: 1.5, mb: 0.5, fontWeight: 600 },
                        '& h1': { fontSize: '1.1rem' },
                        '& h2': { fontSize: '1rem' },
                        '& h3': { fontSize: '0.95rem' },
                        '& blockquote': {
                          borderLeft: '3px solid',
                          borderColor: 'divider',
                          pl: 1.5,
                          ml: 0,
                          color: 'text.secondary',
                        },
                        '& table': { borderCollapse: 'collapse', mb: 1, width: '100%' },
                        '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1, py: 0.5, fontSize: '0.85rem' },
                        '& th': { bgcolor: 'action.hover', fontWeight: 600 },
                        '& a': { color: 'primary.main' },
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {msg.content}
                    </Typography>
                  )}
                </Box>

                {/* Message metadata */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.5,
                    px: 0.5,
                  }}
                >
                  {msg.model && (
                    <Chip
                      label={msg.model}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 18 }}
                    />
                  )}
                  {(msg.tokens_in || msg.tokens_out) && (
                    <Typography variant="caption" color="text.secondary">
                      {msg.tokens_in ? `${msg.tokens_in} in` : ''}
                      {msg.tokens_in && msg.tokens_out ? ' / ' : ''}
                      {msg.tokens_out ? `${msg.tokens_out} out` : ''}
                    </Typography>
                  )}
                  {msg.role === 'assistant' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
                      onClick={() => handleCopyToResponse(msg.content)}
                      sx={{
                        ml: 'auto',
                        textTransform: 'none',
                        fontSize: '0.7rem',
                        py: 0.25,
                        px: 1,
                        minHeight: 0,
                        borderRadius: 1,
                      }}
                    >
                      {t('questionDetail.chat.useThisResponse')}
                    </Button>
                  )}
                </Box>
              </Box>
            ))}

            {sending && !streamingContent && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1,
                }}
              >
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  {t('questionDetail.chat.thinking')}
                </Typography>
              </Box>
            )}

            {sending && streamingContent && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                      '& ul, & ol': { m: 0, mb: 1, pl: 2.5 },
                      '& li': { mb: 0.5 },
                      '& code': {
                        bgcolor: 'action.hover',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontSize: '0.85em',
                        fontFamily: 'monospace',
                      },
                      '& pre': {
                        bgcolor: 'grey.900',
                        color: 'grey.100',
                        p: 1.5,
                        borderRadius: 1,
                        overflow: 'auto',
                        mb: 1,
                        '& code': { bgcolor: 'transparent', p: 0, color: 'inherit' },
                      },
                      '& h1, & h2, & h3, & h4': { mt: 1.5, mb: 0.5, fontWeight: 600 },
                      '& h1': { fontSize: '1.1rem' },
                      '& h2': { fontSize: '1rem' },
                      '& h3': { fontSize: '0.95rem' },
                      '& blockquote': {
                        borderLeft: '3px solid',
                        borderColor: 'divider',
                        pl: 1.5,
                        ml: 0,
                        color: 'text.secondary',
                      },
                      '& table': { borderCollapse: 'collapse', mb: 1, width: '100%' },
                      '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1, py: 0.5, fontSize: '0.85rem' },
                      '& th': { bgcolor: 'action.hover', fontWeight: 600 },
                      '& a': { color: 'primary.main' },
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </Box>
                </Box>
              </Box>
            )}

            <div ref={chatEndRef} />
          </Box>

          {/* Quick actions */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mb: 1.5,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoAwesome />}
              onClick={handleQuickDraft}
            >
              {t('questionDetail.chat.quickDraft')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleQuickImprove}
            >
              {t('questionDetail.chat.quickImprove')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleQuickSummarize}
            >
              {t('questionDetail.chat.quickSummarize')}
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              color="error"
              startIcon={<Delete />}
              onClick={handleClearHistory}
            >
              {t('questionDetail.chat.clearHistory')}
            </Button>
          </Box>

          {/* Chat input */}
          <Box sx={{ flexShrink: 0 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder={t('questionDetail.chat.inputPlaceholder')}
                fullWidth
                multiline
                maxRows={6}
                size="small"
                disabled={sending}
              />
              <Tooltip title={t('questionDetail.chat.send')}>
                <span>
                  <IconButton
                    color="primary"
                    onClick={handleSendMessage}
                    disabled={sending || !chatInput.trim() || !selectedModel}
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '&.Mui-disabled': {
                        bgcolor: 'action.disabledBackground',
                      },
                    }}
                  >
                    <Send />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption">
                    {t('questionDetail.chat.autoApply')}
                  </Typography>
                }
                sx={{ mt: 0.5 }}
              />
              <Button
                size="small"
                variant={selectedDocIds.size > 0 ? 'contained' : 'outlined'}
                color={selectedDocIds.size > 0 ? 'primary' : 'inherit'}
                startIcon={<FolderOpen sx={{ fontSize: 16 }} />}
                onClick={() => setDocSelectorOpen(true)}
                sx={{
                  mt: 0.5,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1.5,
                }}
              >
                {selectedDocIds.size > 0
                  ? t('questionDetail.chat.documentsSelected', { count: selectedDocIds.size })
                  : t('questionDetail.chat.selectDocuments')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
      {/* Document selector dialog */}
      <Dialog
        open={docSelectorOpen}
        onClose={() => setDocSelectorOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('questionDetail.chat.selectDocumentsTitle')}</DialogTitle>
        <DialogContent dividers>
          {dossierDocuments.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">
                {t('questionDetail.chat.noDocuments')}
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {/* Select / Unselect all */}
              <ListItem sx={{ px: 0 }}>
                <Checkbox
                  size="small"
                  checked={selectedDocIds.size === dossierDocuments.filter((d) => d.ocr_text).length && dossierDocuments.filter((d) => d.ocr_text).length > 0}
                  indeterminate={selectedDocIds.size > 0 && selectedDocIds.size < dossierDocuments.filter((d) => d.ocr_text).length}
                  onChange={() => {
                    const ocrDocs = dossierDocuments.filter((d) => d.ocr_text);
                    setSelectedDocIds((prev) =>
                      prev.size === ocrDocs.length
                        ? new Set()
                        : new Set(ocrDocs.map((d) => d.id)),
                    );
                  }}
                  sx={{ mr: 0.5 }}
                />
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={500}>
                      {t('questionDetail.chat.selectUnselectAll')}
                    </Typography>
                  }
                />
              </ListItem>
              <Divider />
              {dossierDocuments.map((doc) => {
                const hasOcr = !!doc.ocr_text;
                return (
                  <ListItem
                    key={doc.id}
                    sx={{ px: 0, opacity: hasOcr ? 1 : 0.5 }}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedDocIds.has(doc.id)}
                      disabled={!hasOcr}
                      onChange={() => {
                        setSelectedDocIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(doc.id)) next.delete(doc.id);
                          else next.add(doc.id);
                          return next;
                        });
                      }}
                      sx={{ mr: 0.5 }}
                    />
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Description fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap>
                          {doc.filename}
                        </Typography>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={doc.doc_type}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 18 }}
                          />
                          {hasOcr ? (
                            <Chip label="OCR" size="small" color="success" sx={{ fontSize: '0.6rem', height: 16 }} />
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              {t('questionDetail.chat.noOcr')}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 2 }}>
            {t('questionDetail.chat.documentsSelected', { count: selectedDocIds.size })}
          </Typography>
          <Button onClick={() => setDocSelectorOpen(false)} variant="contained" size="small">
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
