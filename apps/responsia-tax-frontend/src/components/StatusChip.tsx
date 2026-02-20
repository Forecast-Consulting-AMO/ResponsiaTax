import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';

type StatusType = 'dossier' | 'round' | 'question';

interface StatusChipProps {
  status: string;
  type: StatusType;
}

const getChipColor = (
  status: string,
): 'default' | 'primary' | 'success' | 'info' | 'warning' | 'error' => {
  switch (status) {
    case 'open':
    case 'pending':
      return 'default';
    case 'in_progress':
    case 'drafting':
      return 'primary';
    case 'completed':
    case 'responded':
    case 'reviewed':
      return 'success';
    case 'closed':
    case 'approved':
      return 'info';
    default:
      return 'default';
  }
};

export const StatusChip = ({ status, type }: StatusChipProps) => {
  const { t } = useTranslation();

  const labelKey = `${type}.statuses.${status}`;
  const label = t(labelKey, { defaultValue: status });

  return (
    <Chip
      label={label}
      color={getChipColor(status)}
      size="small"
      variant="filled"
    />
  );
};
