import React from 'react';
import ReactDOM from 'react-dom/client';
import '@livekit/components-styles';
import './styles.css';
import {App} from './App';
import {Toaster} from 'sonner';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-center" richColors />
  </React.StrictMode>,
);
