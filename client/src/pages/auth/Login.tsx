import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Check } from "lucide-react";
import { AuthShell } from "../../components/layouts";
import { Button, Field, Input, cn, useToast } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { homeForRole, useAuth } from "../../lib/auth";
import { LogoMark } from "../../components/icons";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type FormValues = z.infer<typeof schema>;

const demoAccounts = [
  { label: "Administrator", email: "admin@pgmanager.app", tone: "bg-primary/10 text-primary" },
  { label: "PG Owner", email: "owner@sunriseresidency.in", tone: "bg-ocean/10 text-[#4E65F6]" },
  { label: "Resident", email: "rahul@example.com", tone: "bg-mint/20 text-[#4E65F6]" },
];

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const loggedIn = await login(values.email.trim(), values.password);
      toast.push(`Welcome back, ${loggedIn.name.split(" ")[0]}.`);
      if (loggedIn.role === "PG_OWNER" && loggedIn.status !== "ACTIVE") {
        navigate("/owner/pending", { replace: true });
      } else {
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from ?? homeForRole(loggedIn.role), { replace: true });
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not sign you in.");
    }
  };

  const useDemo = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", "Password@123", { shouldValidate: true });
    setSelectedDemo(email);
  };

  return (
    <AuthShell>
      <div className="mb-7 flex items-center gap-3 lg:hidden">
        <LogoMark size={38} />
        <div>
          <p className="text-[15px] font-extrabold leading-tight">PG Manager</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Owners · Residents</p>
        </div>
      </div>

      <h1 className="text-[26px] font-extrabold leading-tight sm:text-2xl">Welcome back</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted sm:text-sm">
        Sign in to manage your PG or check your room details.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-3.5" noValidate>
        <Field label="Email address" error={errors.email?.message} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            {...register("email")}
            error={!!errors.email}
          />
        </Field>
        <Field label="Password" error={errors.password?.message} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...register("password")}
            error={!!errors.password}
          />
        </Field>

        {formError ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[13px] font-medium text-ink" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-0.5">
          <Link to="/forgot-password" className="text-[13px] font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
          <span className="text-[13px] text-ink-muted">
            New here?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </span>
        </div>

        <Button type="submit" full size="lg" loading={isSubmitting} icon={<ArrowRight className="h-4 w-4" />}>
          Sign in
        </Button>
      </form>

      <div className="mt-7 rounded-2xl border border-ink/[0.07] bg-surface p-3.5 sm:p-4">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Demo accounts</p>
          <span className="font-mono text-[11px] text-ink-soft">Password@123</span>
        </div>
        <p className="mb-2.5 text-[12px] text-ink-muted sm:hidden">Tap one to fill the form.</p>
        <div className="space-y-1.5">
          {demoAccounts.map((account) => {
            const active = selectedDemo === account.email;
            return (
              <button
                key={account.email}
                type="button"
                onClick={() => useDemo(account.email)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition",
                  active
                    ? "border-primary bg-primary/[0.07] ring-2 ring-primary/25"
                    : "border-ink/[0.07] hover:border-primary/30 hover:bg-canvas"
                )}
              >
                <span className={cn("chip shrink-0", account.tone)}>{account.label}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-muted">{account.email}</span>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    active ? "bg-primary text-white" : "bg-ink/[0.06] text-ink-muted"
                  )}
                  aria-hidden
                >
                  <Check className="h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </AuthShell>
  );
}
