import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { NotistackProvider } from '../providers/NotistackProvider';
import { AppLayout } from '../components/AppLayout';
import { AppRouter } from '../routes/AppRouter';
import { theme } from '../theme';

const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotistackProvider>
          <AppLayout>
            <AppRouter />
          </AppLayout>
        </NotistackProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
