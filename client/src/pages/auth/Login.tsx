import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "../../components/layouts";
import { Button, Field, Input, useToast } from "../../components/ui";
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

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <LogoMark size={40} />
        <span className="text-lg font-extrabold">PG Manager</span>
      </div>
      <h1 className="text-2xl font-extrabold">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Sign in to manage your PG or check your room details.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
        <Field label="Email address" error={errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} error={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password?.message} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" placeholder="Your password" {...register("password")} error={!!errors.password} />
        </Field>

        {formError ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[13px] font-medium text-[#141928]" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
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

      <div className="mt-8 rounded-2xl border border-ink/5 bg-white p-4">
        <p className="mb-3 text-[11px] font-bold tracking-wide text-ink-muted">
          Demo accounts <span className="font-normal">· password</span>{" "}
          <span className="font-mono text-[11px] text-ink-soft">Password@123</span>
        </p>
        <div className="space-y-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setValue("email", account.email, { shouldValidate: true });
                setValue("password", "Password@123", { shouldValidate: true });
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink/5 px-3 py-2 text-left transition hover:border-primary/30 hover:bg-canvas"
            >
              <span className={`chip ${account.tone}`}>{account.label}</span>
              <span className="truncate text-xs text-ink-muted">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
