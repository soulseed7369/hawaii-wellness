'use client';

import { MemoryRouter } from 'react-router-dom';
import KauaiHome from '@/views/KauaiHome';

export default function KauaiContent() {
  return (
    <MemoryRouter initialEntries={['/kauai']}>
      <KauaiHome />
    </MemoryRouter>
  );
}
