import { useCallback, useEffect, useState } from 'react';
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
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { settingsApi } from '../api/settings';
import { llmApi } from '../api/llm';
import type { LlmModel } from '../types';

const DEFAULT_SYSTEM_PROMPT = `Vous êtes un assistant spécialisé dans les contrôles fiscaux belges. Votre rôle est d'aider les conseillers fiscaux à rédiger des réponses professionnelles, précises et argumentées aux questions posées par l'administration fiscale.

Principes directeurs :
- Répondez toujours en français professionnel
- Citez les articles de loi pertinents (CIR 92, CTVA, etc.)
- Structurez les réponses de manière claire et logique
- Restez factuel et objectif
- Proposez des arguments juridiques solides basés sur la jurisprudence et la doctrine`;

interface SettingsField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'select';
  defaultValue?: string;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
}

interface SettingsSection {
  sectionKey: string;
  title: string;
  description?: string;
  fields: SettingsField[];
}

export const SettingsPage = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [models, setModels] = useState<LlmModel[]>([]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await settingsApi.findAll();
      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        settingsMap[s.key] = s.value;
      }
      setValues(settingsMap);
    } catch {
      enqueueSnackbar(t('settings.errors.fetchFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  const fetchModels = useCallback(async () => {
    try {
      const data = await llmApi.getModels();
      setModels(data);
    } catch {
      // Models may not be available until API keys are configured
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchModels();
  }, [fetchSettings, fetchModels]);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveSection = useCallback(
    async (sectionKey: string, fields: SettingsField[]) => {
      try {
        setSavingSection(sectionKey);
        for (const field of fields) {
          const value = values[field.key] ?? field.defaultValue ?? '';
          await settingsApi.upsert(field.key, { value });
        }
        enqueueSnackbar(t('settings.saved'), { variant: 'success' });

        // Refresh models if API keys were saved
        if (
          sectionKey === 'openai' ||
          sectionKey === 'anthropic' ||
          sectionKey === 'azure_openai'
        ) {
          fetchModels();
        }
      } catch {
        enqueueSnackbar(t('settings.errors.saveFailed'), { variant: 'error' });
      } finally {
        setSavingSection(null);
      }
    },
    [values, enqueueSnackbar, t, fetchModels],
  );

  const sections: SettingsSection[] = [
    {
      sectionKey: 'openai',
      title: t('settings.sections.openai.title'),
      description: t('settings.sections.openai.description'),
      fields: [
        {
          key: 'openai_api_key',
          label: t('settings.fields.openaiApiKey'),
          type: 'password',
          placeholder: 'sk-...',
        },
      ],
    },
    {
      sectionKey: 'azure_openai',
      title: t('settings.sections.azureOpenai.title'),
      description: t('settings.sections.azureOpenai.description'),
      fields: [
        {
          key: 'azure_openai_endpoint',
          label: t('settings.fields.azureOpenaiEndpoint'),
          type: 'text',
          placeholder: 'https://your-resource.openai.azure.com/',
        },
        {
          key: 'azure_openai_api_key',
          label: t('settings.fields.azureOpenaiApiKey'),
          type: 'password',
          placeholder: '***',
        },
        {
          key: 'azure_openai_api_version',
          label: t('settings.fields.azureOpenaiApiVersion'),
          type: 'text',
          defaultValue: '2025-04-01-preview',
          placeholder: '2025-04-01-preview',
        },
      ],
    },
    {
      sectionKey: 'anthropic',
      title: t('settings.sections.anthropic.title'),
      description: t('settings.sections.anthropic.description'),
      fields: [
        {
          key: 'anthropic_api_key',
          label: t('settings.fields.anthropicApiKey'),
          type: 'password',
          placeholder: 'sk-ant-...',
        },
      ],
    },
    {
      sectionKey: 'azure_di',
      title: t('settings.sections.azureDi.title'),
      description: t('settings.sections.azureDi.description'),
      fields: [
        {
          key: 'azure_di_endpoint',
          label: t('settings.fields.azureDiEndpoint'),
          type: 'text',
          placeholder: 'https://your-resource.cognitiveservices.azure.com/',
        },
        {
          key: 'azure_di_key',
          label: t('settings.fields.azureDiKey'),
          type: 'password',
          placeholder: '***',
        },
      ],
    },
    {
      sectionKey: 'azure_search',
      title: t('settings.sections.azureSearch.title'),
      description: t('settings.sections.azureSearch.description'),
      fields: [
        {
          key: 'azure_search_endpoint',
          label: t('settings.fields.azureSearchEndpoint'),
          type: 'text',
          placeholder: 'https://your-search.search.windows.net',
        },
        {
          key: 'azure_search_key',
          label: t('settings.fields.azureSearchKey'),
          type: 'password',
          placeholder: '***',
        },
      ],
    },
    {
      sectionKey: 'default_llm',
      title: t('settings.sections.defaultLlm.title'),
      description: t('settings.sections.defaultLlm.description'),
      fields: [
        {
          key: 'default_llm_model',
          label: t('settings.fields.defaultLlmModel'),
          type: 'select',
          options: models.map((m) => ({ value: m.id, label: m.name })),
        },
        {
          key: 'default_system_prompt',
          label: t('settings.fields.defaultSystemPrompt'),
          type: 'textarea',
          defaultValue: DEFAULT_SYSTEM_PROMPT,
          helpText: t('settings.fields.defaultSystemPromptHelp'),
        },
      ],
    },
  ];

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" fontWeight={700} sx={{ mb: 4 }}>
        {t('settings.title')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sections.map((section) => (
          <Paper key={section.sectionKey} sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
              {section.title}
            </Typography>
            {section.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                {section.description}
              </Typography>
            )}

            <Divider sx={{ mb: 2 }} />

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {section.fields.map((field) => {
                const fieldValue =
                  values[field.key] ?? field.defaultValue ?? '';

                if (field.type === 'select') {
                  return (
                    <FormControl key={field.key} fullWidth>
                      <InputLabel>{field.label}</InputLabel>
                      <Select
                        value={fieldValue}
                        onChange={(e) =>
                          handleChange(field.key, e.target.value)
                        }
                        label={field.label}
                      >
                        {(field.options ?? []).map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <TextField
                      key={field.key}
                      label={field.label}
                      value={fieldValue}
                      onChange={(e) =>
                        handleChange(field.key, e.target.value)
                      }
                      placeholder={field.placeholder}
                      fullWidth
                      multiline
                      rows={8}
                      helperText={field.helpText}
                    />
                  );
                }

                return (
                  <TextField
                    key={field.key}
                    label={field.label}
                    value={fieldValue}
                    onChange={(e) =>
                      handleChange(field.key, e.target.value)
                    }
                    placeholder={field.placeholder}
                    type={field.type}
                    fullWidth
                    helperText={field.helpText}
                  />
                );
              })}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                onClick={() =>
                  handleSaveSection(section.sectionKey, section.fields)
                }
                disabled={savingSection === section.sectionKey}
                startIcon={
                  savingSection === section.sectionKey ? (
                    <CircularProgress size={16} />
                  ) : (
                    <CheckCircle />
                  )
                }
              >
                {t('common.save')}
              </Button>
            </Box>
          </Paper>
        ))}
      </Box>
    </Container>
  );
};
