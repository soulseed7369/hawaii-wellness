import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useMyPractitioner, useSavePractitioner, type PractitionerFormData } from "@/hooks/useMyPractitioner";

const regions = [
  "Kailua-Kona",
  "Hilo",
  "Waimea",
  "Kohala Coast",
  "Captain Cook",
  "Volcano Village",
  "Pahoa",
  "Holualoa",
  "Honokaa",
];

const emptyForm: PractitionerFormData = {
  name: "",
  modalities: "",
  bio: "",
  city: "",
  region: "",
  address: "",
  phone: "",
  email: "",
  website_url: "",
  external_booking_url: "",
  accepts_new_clients: true,
};

export default function DashboardProfile() {
  const { data: practitioner, isLoading } = useMyPractitioner();
  const saveMutation = useSavePractitioner();
  const [form, setForm] = useState<PractitionerFormData>(emptyForm);

  // Pre-populate form when data loads
  useEffect(() => {
    if (practitioner) {
      setForm({
        name: practitioner.name ?? "",
        modalities: practitioner.modalities?.join(", ") ?? "",
        bio: practitioner.bio ?? "",
        city: practitioner.city ?? "",
        region: practitioner.region ?? "",
        address: practitioner.address ?? "",
        phone: practitioner.phone ?? "",
        email: practitioner.email ?? "",
        website_url: practitioner.website_url ?? "",
        external_booking_url: practitioner.external_booking_url ?? "",
        accepts_new_clients: practitioner.accepts_new_clients ?? true,
      });
    }
  }, [practitioner]);

  const handleChange = (field: keyof PractitionerFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Full name is required.");
      return;
    }
    try {
      await saveMutation.mutateAsync(form);
      toast.success("Profile saved! It will appear in the directory once reviewed.");
    } catch (err) {
      toast.error("Failed to save profile. Please try again.");
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">My Practitioner Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your public directory listing. Changes are saved as draft until reviewed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo placeholder — image upload is a Sprint 5 feature */}
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-input bg-muted">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <Button variant="outline" size="sm" disabled>
                Upload Photo
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">Coming in a future update</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="Dr. Leilani Kamaka"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modalities">Services / Modalities</Label>
              <Input
                id="modalities"
                placeholder="Acupuncture, Massage, Reiki"
                value={form.modalities}
                onChange={(e) => handleChange("modalities", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma-separated list</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Contact Email (public)</Label>
            <Input
              id="email"
              type="email"
              placeholder="dr.kamaka@example.com"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(808) 555-0123"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Accepting New Clients</p>
              <p className="text-xs text-muted-foreground">Show "Accepting New Clients" badge on your profile</p>
            </div>
            <Switch
              checked={form.accepts_new_clients}
              onCheckedChange={(checked) => handleChange("accepts_new_clients", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={form.region}
                onValueChange={(val) => handleChange("region", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Kailua-Kona"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              placeholder="75-5660 Palani Rd"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Tell potential clients about your practice, philosophy, and experience..."
            className="min-h-[140px]"
            value={form.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Online Presence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website_url">Website</Label>
            <Input
              id="website_url"
              type="url"
              placeholder="https://yourwebsite.com"
              value={form.website_url}
              onChange={(e) => handleChange("website_url", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lead-Gen CTA */}
      <Card className="border-primary/30 bg-terracotta-light/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ExternalLink className="h-4 w-4 text-primary" />
            Direct Booking Link
          </CardTitle>
          <CardDescription>
            Where should we send patients to book with you? (e.g., your Square, Mindbody, or personal website link)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="https://your-booking-page.com"
            type="url"
            value={form.external_booking_url}
            onChange={(e) => handleChange("external_booking_url", e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
