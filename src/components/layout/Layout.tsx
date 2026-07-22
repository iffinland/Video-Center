// Video Center — main layout shell (Tailwind + CSS custom properties)

import type { ReactNode } from 'react';
import { Header } from './Header';

type Props = {
  children: ReactNode;
  onSearch: (query: string) => void;
};

export const Layout = ({ children, onSearch }: Props) => {
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--surface-app)' }}>
      <Header onSearch={onSearch} />
      <main className="flex-1 p-6 mx-auto w-full" style={{ maxWidth: 1200 }}>
        {children}
      </main>
    </div>
  );
};
