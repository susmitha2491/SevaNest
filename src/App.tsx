import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { router } from './app/router/routes';

export const App: React.FC = () => {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
};

export default App;
