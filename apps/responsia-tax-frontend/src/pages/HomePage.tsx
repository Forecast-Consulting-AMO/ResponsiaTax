import { Box, Typography, Container } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const HomePage = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <Typography variant="h3" component="h1" gutterBottom>
          {t('common.appName')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Template ready. Start building your app.
        </Typography>
      </Box>
    </Container>
  );
};
