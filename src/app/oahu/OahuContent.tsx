'use client';

import { MemoryRouter } from 'react-router-dom';
import OahuHome from '@/views/OahuHome';

export default function OahuContent() {
  return (
    <MemoryRouter initialEntries={['/oahu']}>
      <OahuHome />
    </MemoryRouter>
  );
}
