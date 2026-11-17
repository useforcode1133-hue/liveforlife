import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BuildingIcon, ProfileIcon, LogoMark } from "../../components/icons";
import { AuthShell } from "../../components/layouts";
import { Button, Field, Input, cn, useToast } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { homeForRole, useAuth } from "../../lib/auth";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, "Use at least 8 characters."),
  role: z.enum(["PG_OWNER", "RESIDENT"]),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "RESIDENT" },
  });

  const role = watch("role");

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const user = await createAccount({
        name: values.name,
        email: values.email.trim(),
        phone: values.phone,
        password: values.password,
        role: values.role,
      });
      if (user.role === "PG_OWNER" && user.status !== "ACTIVE") {
        toast.push("Account created. An administrator will review it shortly.", "info");
        navigate("/owner/pending", { replace: true });
      } else {
        toast.push("Your account is ready.");
        navigate(homeForRole(user.role), { replace: true });
      }
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setFormError(Object.values(error.fields)[0] ?? error.message);
      } else {
        setFormError(error instanceof ApiError ? error.message : "Could not create your account.");
      }
    }
  };

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <LogoMark size={40} />
        <span className="text-lg font-extrabold">PG Manager</span>
      </div>
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-muted">It takes less than a minute. You can join a PG right after.</p>

      <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
        {[
          { value: "RESIDENT" as const, title: "I am a resident", description: "View rent, menu and raise issues", icon: <ProfileIcon size={26} /> },
          { value: "PG_OWNER" as const, title: "I run a PG", description: "Manage rooms, residents and rent", icon: <BuildingIcon size={26} /> },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={role === option.value}
            onClick={() => setValue("role", option.value, { shouldValidate: true })}
            className={cn(
              "rounded-2xl border-2 p-3.5 text-left transition",
              role === option.value ? "border-primary bg-primary/5" : "border-ink/10 bg-surface hover:border-primary/30"
            )}
          >
            <span className="mb-2 block">{option.icon}</span>
            <span className="block text-[13px] font-bold">{option.title}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{option.description}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message} htmlFor="name">
          <Input id="name" autoComplete="name" placeholder="Rahul Verma" {...register("name")} error={!!errors.name} />
        </Field>
        <Field label="Email address" error={errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} error={!!errors.email} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" hint="Optional" error={errors.phone?.message} htmlFor="phone">
            <Input id="phone" inputMode="tel" placeholder="98765 43210" {...register("phone")} />
          </Field>
          <Field label="Password" error={errors.password?.message} htmlFor="password" hint="At least 8 characters">
            <Input id="password" type="password" autoComplete="new-password" placeholder="Create a password" {...register("password")} error={!!errors.password} />
          </Field>
        </div>

        {formError ? (
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[13px] font-medium text-ink" role="alert">
            {formError}
          </div>
        ) : null}

        <Button type="submit" full size="lg" loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-center text-[13px] text-ink-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
        {role === "PG_OWNER" ? (
          <p className="rounded-xl bg-sun/15 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink">
            Owner accounts are reviewed by an administrator before properties go live.
          </p>
        ) : null}
      </form>
    </AuthShell>
  );
}
