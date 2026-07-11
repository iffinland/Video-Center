// Video Center — main layout shell

import type { ReactNode } from 'react';
import { Header } from './Header';

type Props = {
  children: ReactNode;
  onSearch: (query: string) => void;
};

export const Layout = ({ children, onSearch }: Props) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      color: '#111827',
    }}>
      <Header onSearch={onSearch} />
      <main style={{ flex: 1, padding: '1.5rem 1rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
};
