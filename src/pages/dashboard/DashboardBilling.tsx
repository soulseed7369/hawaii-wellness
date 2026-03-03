import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreditCard, CheckCircle, Calendar, AlertCircle, Clock } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    features: ["1 Practitioner listing", "Basic directory profile", "Email support"],
    current: false,
  },
  {
    name: "Professional",
    price: "$59",
    period: "/mo",
    features: [
      "1 Practitioner + 2 Center listings",
      "Priority placement",
      "Retreat listings",
      "Analytics dashboard",
    ],
    current: true,
  },
  {
    name: "Enterprise",
    price: "$119",
    period: "/mo",
    features: [
      "Unlimited listings",
      "Featured placement",
      "Custom branding",
      "Dedicated support",
    ],
    current: false,
  },
];

export default function DashboardBilling() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your plan, payment method, and billing history.
        </p>
      </div>

      {/* Coming Soon Banner */}
      <Alert className="border-amber-300 bg-amber-50 text-amber-900">
        <Clock className="h-4 w-4 text-amber-600" />
        <AlertTitle className="font-semibold text-amber-900">Coming Soon</AlertTitle>
        <AlertDescription className="text-amber-800">
          Paid plans and billing are not yet active. All listings are currently free during our
          launch period. We'll notify you before any charges begin.
        </AlertDescription>
      </Alert>

      {/* Current plan summary — display only */}
      <Card className="border-primary/20 bg-terracotta-light/20">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current Plan
            </p>
            <p className="font-display text-2xl font-bold text-foreground">Free (Launch)</p>
            <p className="text-sm text-muted-foreground">
              Enjoy free listings during our launch period.
            </p>
          </div>
          <Badge className="w-fit gap-1.5 bg-secondary text-secondary-foreground">
            <CheckCircle className="h-3.5 w-3.5" />
            Active
          </Badge>
        </CardContent>
      </Card>

      {/* Plans — disabled */}
      <div>
        <h2 className="mb-4 font-display text-lg font-semibold">
          Future Plans{" "}
          <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
            Not yet available
          </Badge>
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className="opacity-60">
              <CardContent className="flex flex-col gap-4 p-5">
                <div>
                  <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1">
                    <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="mt-auto w-full"
                  disabled
                >
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Auto-renewal toggle — disabled */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-lg">Auto-Renewal</CardTitle>
          <CardDescription>
            Your subscription will automatically renew each billing cycle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Auto-renew subscription</Label>
                <p className="text-xs text-muted-foreground">Not yet active</p>
              </div>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>

      {/* Payment method — disabled */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-lg">Payment Method</CardTitle>
          <CardDescription>
            Add a payment method when billing becomes available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-14 items-center justify-center rounded-md bg-background shadow-sm">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">No payment method on file</p>
                <p className="text-xs text-muted-foreground">Add one when billing launches</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" disabled>
              Update Card
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Billing is not yet active. All features are available for free during our launch period.
          We will give you advance notice before any charges begin.
        </p>
      </div>
    </div>
  );
}
