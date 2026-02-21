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
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import type { DocType } from '../types';

const DOC_TYPES: DocType[] = ['question_dr', 'support', 'response_draft', 'other'];

/**
 * Auto-detect document type based on filename patterns.
 * Uses NFD normalization to strip accents for robust matching.
 */
function detectDocType(filename: string): DocType {
  const lower = filename.toLowerCase();
  // Strip accents: "réponse" → "reponse", "pièce" → "piece"
  const ascii = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Information request / demand for info patterns
  if (
    /demande[\s_-]*(de[\s_-]*)?renseignement/.test(ascii) ||
    /(^|[\s_\-.])dr([\s_\-.]|$)/.test(lower) ||
    /vraag[\s_-]*(om[\s_-]*)?inlichtingen/.test(ascii) ||
    /information[\s_-]*request/.test(lower) ||
    /avis[\s_-]*(de[\s_-]*)?rectification/.test(ascii) ||
    /notification/.test(lower)
  ) {
    return 'question_dr';
  }

  // Response / reply patterns
  if (
    /reponse/.test(ascii) ||
    /reply/.test(lower) ||
    /antwoord/.test(lower) ||
    /response/.test(lower) ||
    /brouillon/.test(lower) ||
    /draft/.test(lower) ||
    /concept/.test(lower)
  ) {
    return 'response_draft';
  }

  // Supporting document patterns
  if (
    /annexe/.test(lower) ||
    /bijlage/.test(lower) ||
    /attachment/.test(lower) ||
    /piece[\s_-]*justificative/.test(ascii) ||
    /bewijsstuk/.test(lower) ||
    /support/.test(lower) ||
    /justificati/.test(lower) ||
    /factur/.test(lower) ||
    /invoice/.test(lower) ||
    /contrat/.test(lower) ||
    /contract/.test(lower) ||
    /bilan/.test(lower) ||
    /balans/.test(lower) ||
    /comptes?/.test(lower) ||
    /rekening/.test(lower)
  ) {
    return 'support';
  }

  return 'other';
}

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

  // Rebuild items whenever the files prop changes
  useEffect(() => {
    setItems(
      files.map((file) => ({
        file,
        docType: detectDocType(file.name),
      })),
    );
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
          disabled={uploading || items.length === 0}
          startIcon={uploading ? <CircularProgress size={16} /> : undefined}
        >
          {t('common.upload')} ({items.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};
