import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
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
} from '@mui/icons-material';
import { questionsApi } from '../api/questions';
import { llmApi } from '../api/llm';
import type {
  Question,
  QuestionStatus,
  LlmMessage,
  LlmModel,
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

  // Question state
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
  const [autoApply, setAutoApply] = useState(false);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPromptOverride, setSystemPromptOverride] = useState('');

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      if (data.length > 0 && !selectedModel) {
        setSelectedModel(data[0].id);
      }
    } catch {
      // Models fetch can fail silently -- settings might not be configured yet
    }
  }, [selectedModel]);

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

  useEffect(() => {
    fetchQuestion();
    fetchModels();
    fetchMessages();
  }, [fetchQuestion, fetchModels, fetchMessages]);

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

  // Send chat message
  const handleSendMessage = useCallback(async () => {
    if (!id || !chatInput.trim() || !selectedModel) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setSending(true);

    try {
      const response = await llmApi.chat(id, {
        message: messageText,
        model: selectedModel,
        systemPrompt: systemPromptOverride || undefined,
        autoApplyToResponse: autoApply,
        includeDocuments,
      });

      // If auto-apply is enabled, update response text
      if (autoApply && response.content) {
        setResponseText(response.content);
        if (question) {
          await questionsApi.update(id, { response_text: response.content });
        }
      }

      // Refresh messages
      fetchMessages();
    } catch {
      enqueueSnackbar(t('questionDetail.errors.chatFailed'), {
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  }, [
    id,
    chatInput,
    selectedModel,
    systemPromptOverride,
    autoApply,
    includeDocuments,
    question,
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
      setResponseText(content);
      enqueueSnackbar(t('questionDetail.copiedToResponse'), {
        variant: 'info',
      });
    },
    [enqueueSnackbar, t],
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
              rows={2}
              size="small"
              sx={{ mb: 2 }}
            />
          </Collapse>

          {/* Response editor */}
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            {t('questionDetail.response.title')}
          </Typography>
          <TextField
            value={responseText}
            onChange={(e) => handleResponseChange(e.target.value)}
            placeholder={t('questionDetail.response.placeholder')}
            fullWidth
            multiline
            sx={{
              flex: 1,
              '& .MuiInputBase-root': {
                height: '100%',
                alignItems: 'flex-start',
              },
              '& .MuiInputBase-input': {
                height: '100% !important',
                overflow: 'auto !important',
              },
            }}
          />
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

          {/* System prompt override (collapsible) */}
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
                value={systemPromptOverride}
                onChange={(e) => setSystemPromptOverride(e.target.value)}
                placeholder={t('questionDetail.chat.systemPromptPlaceholder')}
                fullWidth
                multiline
                rows={3}
                size="small"
                sx={{ mb: 1 }}
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
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {msg.content}
                  </Typography>
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
                    <Tooltip title={t('questionDetail.chat.copyToResponse')}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopyToResponse(msg.content)}
                        sx={{ ml: 0.5 }}
                      >
                        <ContentCopy sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))}

            {sending && (
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
                maxRows={4}
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
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeDocuments}
                    onChange={(e) => setIncludeDocuments(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption">
                    {t('questionDetail.chat.includeDocuments')}
                  </Typography>
                }
                sx={{ mt: 0.5 }}
              />
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};
