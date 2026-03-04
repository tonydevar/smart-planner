import React from 'react';
import { AppProvider } from './context/AppContext.jsx';
import PlannerPage from './pages/PlannerPage.jsx';

export default function App() {
  return (
    <AppProvider>
      <PlannerPage />
    </AppProvider>
  );
}
