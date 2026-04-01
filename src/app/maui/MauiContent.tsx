'use client';

import { MemoryRouter } from 'react-router-dom';
import MauiHome from '@/views/MauiHome';

export default function MauiContent() {
  return (
    <MemoryRouter initialEntries={['/maui']}>
      <MauiHome />
    </MemoryRouter>
  );
}
