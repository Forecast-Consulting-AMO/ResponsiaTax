import { SnackbarProvider } from 'notistack';
import { PropsWithChildren } from 'react';

export const NotistackProvider = ({ children }: PropsWithChildren) => {
  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      autoHideDuration={4000}
    >
      {children}
    </SnackbarProvider>
  );
};
