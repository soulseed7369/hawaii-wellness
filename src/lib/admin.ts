export const ADMIN_EMAILS = [
  'marcuswoo@gmail.com',
];

export function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? '');
}
