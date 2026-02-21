import { useCallback, useState } from 'react';
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
 */
function detectDocType(filename: string): DocType {
  const lower = filename.toLowerCase();

  // Information request / demand for info patterns
  if (
    /demande[_\s-]*(de[_\s-]*)?renseignement/i.test(lower) ||
    /\bdr\b/.test(lower) ||
    /vraag[_\s-]*(om[_\s-]*)?inlichtingen/i.test(lower) ||
    /information[_\s-]*request/i.test(lower) ||
    /avis[_\s-]*(de[_\s-]*)?rectification/i.test(lower) ||
    /notification/i.test(lower)
  ) {
    return 'question_dr';
  }

  // Response / reply patterns
  if (
    /\br[ée]ponse\b/i.test(lower) ||
    /\breply\b/i.test(lower) ||
    /\bantwoord\b/i.test(lower) ||
    /\bresponse\b/i.test(lower) ||
    /\bbrouillon\b/i.test(lower) ||
    /\bdraft\b/i.test(lower) ||
    /\bconcept\b/i.test(lower)
  ) {
    return 'response_draft';
  }

  // Supporting document patterns
  if (
    /\bannexe\b/i.test(lower) ||
    /\bbijlage\b/i.test(lower) ||
    /\battachment\b/i.test(lower) ||
    /pi[èe]ce[_\s-]*justificative/i.test(lower) ||
    /\bbewijsstuk\b/i.test(lower) ||
    /\bsupport\b/i.test(lower) ||
    /\bjustificati/i.test(lower) ||
    /\bfactur/i.test(lower) ||
    /\binvoice\b/i.test(lower) ||
    /\bcontrat\b/i.test(lower) ||
    /\bcontract\b/i.test(lower) ||
    /\bbilan\b/i.test(lower) ||
    /\bbalans\b/i.test(lower) ||
    /\bcomptes?\b/i.test(lower) ||
    /\brekening/i.test(lower)
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

  const [items, setItems] = useState<BatchUploadItem[]>(() =>
    files.map((file) => ({
      file,
      docType: detectDocType(file.name),
    })),
  );

  // Sync items when files change
  if (files.length > 0 && items.length !== files.length) {
    setItems(
      files.map((file) => ({
        file,
        docType: detectDocType(file.name),
      })),
    );
  }

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
