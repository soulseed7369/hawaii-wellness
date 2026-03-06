import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useSubmitFlag, type FlagReason } from '@/hooks/useListingFlags';
import { useToast } from '@/hooks/use-toast';

const REASONS: { value: FlagReason; label: string; description: string }[] = [
  {
    value: 'closed',
    label: 'Business closed / no longer active',
    description: 'This practitioner or business has closed or is no longer operating.',
  },
  {
    value: 'inaccurate',
    label: 'Inaccurate information',
    description: 'Phone number, address, website, or other details are wrong.',
  },
  {
    value: 'duplicate',
    label: 'Duplicate listing',
    description: 'This business is already listed elsewhere on the directory.',
  },
];

interface FlagListingButtonProps {
  listingType: 'practitioner' | 'center';
  listingId: string;
  listingName: string;
  /** Visual style — 'ghost' for subtle placement, 'outline' for more visible */
  variant?: 'ghost' | 'outline';
}

export function FlagListingButton({
  listingType,
  listingId,
  listingName,
  variant = 'ghost',
}: FlagListingButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitFlag = useSubmitFlag();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason) return;
    try {
      await submitFlag.mutateAsync({
        listing_type: listingType,
        listing_id: listingId,
        listing_name: listingName,
        reason,
        details: details.trim() || undefined,
        reporter_email: email.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Could not submit your report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset state on close
      setTimeout(() => {
        setReason(null);
        setDetails('');
        setEmail('');
        setSubmitted(false);
      }, 200);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        className="text-gray-400 hover:text-red-500 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Flag className="w-3.5 h-3.5" />
        Report listing
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Flag className="w-5 h-5 text-green-600" />
              </div>
              <DialogHeader>
                <DialogTitle>Thanks for your report</DialogTitle>
                <DialogDescription>
                  Our team will review this listing and take action if needed.
                </DialogDescription>
              </DialogHeader>
              <Button className="mt-2" onClick={() => handleClose(false)}>
                Close
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Report this listing</DialogTitle>
                <DialogDescription>
                  Help us keep the directory accurate. Select the issue below.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Reason selection */}
                <div className="space-y-2">
                  {REASONS.map(r => (
                    <label
                      key={r.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        reason === r.value
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="flag-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="mt-0.5 accent-red-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{r.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Optional details */}
                <div>
                  <Label htmlFor="flag-details" className="text-sm">
                    Additional details <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="flag-details"
                    placeholder="Anything that would help us investigate…"
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    className="mt-1 text-sm min-h-[80px]"
                  />
                </div>

                {/* Optional email */}
                <div>
                  <Label htmlFor="flag-email" className="text-sm">
                    Your email <span className="text-gray-400 font-normal">(optional, for follow-up)</span>
                  </Label>
                  <Input
                    id="flag-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="mt-1 text-sm"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" onClick={() => handleClose(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!reason || submitFlag.isPending}
                    onClick={handleSubmit}
                  >
                    {submitFlag.isPending ? 'Submitting…' : 'Submit report'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
