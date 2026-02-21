import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Select,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  LinearProgress,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { llmApi } from '../api/llm';
import type { DocType } from '../types';

const DOC_TYPES: DocType[] = ['question_dr', 'support', 'response_draft', 'other'];

export interface BatchUploadItem {
  file: File;
  docType: DocType;
}

interface BatchUploadDialogProps {
  open: boolean;
  files: File[];
  onClose: () => void;
  onConfirm: (items: BatchUploadItem[]) => void;
  uploading?: boolean;
}

export const BatchUploadDialog = ({
  open,
  files,
  onClose,
  onConfirm,
  uploading = false,
}: BatchUploadDialogProps) => {
  const { t } = useTranslation();

  const [items, setItems] = useState<BatchUploadItem[]>([]);
  const [classifying, setClassifying] = useState(false);

  // When files change, initialize items with 'other' and call LLM to classify
  useEffect(() => {
    if (files.length === 0) {
      setItems([]);
      return;
    }

    // Initialize all items immediately as 'other' so the dialog is usable
    const initial = files.map((file) => ({
      file,
      docType: 'other' as DocType,
    }));
    setItems(initial);

    // Call LLM to classify filenames
    let cancelled = false;
    setClassifying(true);

    llmApi
      .classifyDocTypes(files.map((f) => f.name))
      .then((classifications) => {
        if (cancelled) return;
        setItems(
          files.map((file, i) => ({
            file,
            docType: (classifications[i] as DocType) || 'other',
          })),
        );
      })
      .catch(() => {
        // On error, keep items as 'other' — user can still change manually
      })
      .finally(() => {
        if (!cancelled) setClassifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [files]);

  const handleTypeChange = useCallback(
    (index: number, docType: DocType) => {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], docType };
        return next;
      });
    },
    [],
  );

  const handleRemove = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog
      open={open}
      onClose={uploading ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{t('document.batchUpload.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('document.batchUpload.description')}
        </Typography>

        {classifying && <LinearProgress sx={{ mb: 1 }} />}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('document.batchUpload.filename')}</TableCell>
              <TableCell>{t('document.batchUpload.size')}</TableCell>
              <TableCell>{t('document.batchUpload.type')}</TableCell>
              <TableCell width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                    {item.file.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {formatFileSize(item.file.size)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Select
                    value={item.docType}
                    onChange={(e) =>
                      handleTypeChange(index, e.target.value as DocType)
                    }
                    size="small"
                    variant="standard"
                    sx={{ fontSize: '0.85rem' }}
                  >
                    {DOC_TYPES.map((dt) => (
                      <MenuItem key={dt} value={dt}>
                        {t(`document.types.${dt}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(index)}
                    disabled={uploading}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {items.length === 0 && (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('document.batchUpload.noFiles')}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(items)}
          disabled={uploading || classifying || items.length === 0}
          startIcon={uploading ? <CircularProgress size={16} /> : undefined}
        >
          {t('common.upload')} ({items.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};
