import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, hasSupabase } from "@/lib/supabase";

export default function DashboardSettings() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    if (!supabase || !user) {
      toast.error("Account settings are unavailable in preview mode.");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (newPassword && newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const updates: { email?: string; password?: string } = {};
      if (email.trim() && email.trim() !== user.email) {
        updates.email = email.trim();
      }
      if (newPassword) {
        updates.password = newPassword;
      }

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save.");
        return;
      }

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      if (updates.email) {
        toast.success("Check your new email address for a confirmation link.");
      } else {
        toast.success("Password updated successfully.");
      }
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update account.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Account Settings</h1>

      {!hasSupabase && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Account settings are in preview mode. Connect Supabase to enable email and password
            changes.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Address</CardTitle>
          <CardDescription>
            Update the email address associated with your account. You'll receive a confirmation
            link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!hasSupabase}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
          <CardDescription>
            Leave blank to keep your current password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={!hasSupabase}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!hasSupabase}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleUpdate} disabled={saving || !hasSupabase}>
          {saving ? "Saving…" : "Update Account"}
        </Button>
      </div>
    </div>
  );
}
