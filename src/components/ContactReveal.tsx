import { useState } from 'react';
import { Phone, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REVEAL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-reveal`;

interface Props {
  listingId: string;
  listingType: 'practitioner' | 'center';
  type: 'phone' | 'email';
  className?: string;
}

export function ContactReveal({ listingId, listingType, type, className }: Props) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);

  const reveal = async () => {
    setLoading(true);
    setError(false);
    setNotAvailable(false);
    try {
      const res = await fetch(
        `${REVEAL_URL}?id=${listingId}&type=${type}&listing_type=${listingType}`
      );
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      // Handle case where server returns { value: null }
      if (data.value === null || data.value === undefined) {
        setNotAvailable(true);
      } else {
        setValue(data.value);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (value) {
    const href = type === 'phone' ? `tel:${value}` : `mailto:${value}`;
    const Icon = type === 'phone' ? Phone : Mail;
    return (
      <a href={href} className={`flex items-center gap-2 font-medium text-primary hover:text-primary/80 transition-colors ${className ?? ''}`}>
        <Icon className="h-4 w-4 flex-shrink-0" /> {value}
      </a>
    );
  }

  if (notAvailable) {
    const Icon = type === 'phone' ? Phone : Mail;
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className ?? ''}`}>
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>Not available</span>
      </div>
    );
  }

  const Icon = type === 'phone' ? Phone : Mail;
  const label = type === 'phone' ? 'Show Phone' : 'Show Email';
  const errorLabel = error ? 'Retry' : label;

  return (
    <Button variant="ghost" size="sm" onClick={reveal} disabled={loading}
      className={`gap-2 text-primary ${className ?? ''}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {errorLabel}
    </Button>
  );
}
