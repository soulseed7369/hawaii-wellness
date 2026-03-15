/**
 * RequestInfoModal — shown on practitioner profiles that have no external booking URL.
 * Provides a fallback conversion path: name + email + message → mailto: the practitioner.
 * If the practitioner has no email either, falls back to their website link.
 */
import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, CheckCircle } from "lucide-react";

interface RequestInfoModalProps {
  practitionerName: string;
  practitionerEmail: string | null;
  practitionerWebsite: string | null;
  /** If true, renders a full-width button (e.g. sidebar). Otherwise renders inline. */
  fullWidth?: boolean;
}

export function RequestInfoModal({
  practitionerName,
  practitionerEmail,
  practitionerWebsite,
  fullWidth = false,
}: RequestInfoModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
  }, []);

  const canSendEmail = !!practitionerEmail;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    if (canSendEmail) {
      const subject = encodeURIComponent(`Inquiry from ${name} via Hawaiʻi Wellness`);
      const body = encodeURIComponent(
        `Hi ${practitionerName},\n\n${message}\n\nBest,\n${name}\n${email}`
      );
      window.open(`mailto:${practitionerEmail}?subject=${subject}&body=${body}`, "_blank");
    }
    setSent(true);
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => {
        setName(""); setEmail(""); setMessage(""); setSent(false);
        resetTimeoutRef.current = null;
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={`gap-2${fullWidth ? " w-full" : ""}`}
        >
          <MessageCircle className="h-4 w-4" />
          Send a Message
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a message to {practitionerName}</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-base font-medium">Message ready to send!</p>
            <p className="text-sm text-muted-foreground">
              {canSendEmail
                ? "Your email client opened with a pre-filled message. Hit send whenever you're ready."
                : "This practitioner hasn't listed an email address. You can reach them via their website."}
            </p>
            {!canSendEmail && practitionerWebsite && (
              <a
                href={practitionerWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                Visit their website →
              </a>
            )}
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="ri-name">Your name</Label>
              <Input
                id="ri-name"
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ri-email">Your email</Label>
              <Input
                id="ri-email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ri-message">Message</Label>
              <Textarea
                id="ri-message"
                placeholder={`Hi ${practitionerName}, I'm interested in learning more about your services…`}
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {canSendEmail
                ? "This will open your email client with a pre-filled message to the practitioner."
                : "Your message will be composed — the practitioner can be reached via their website."}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || !email.trim() || !message.trim()}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Send message
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
