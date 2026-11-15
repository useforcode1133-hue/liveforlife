import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../../components/layouts";
import { Button, Field, Input, useToast } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { LogoMark } from "../../components/icons";

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<{ message: string; resetToken?: string }>("/auth/forgot-password", { email });
      setMessage(data.message);
      if (data.resetToken) {
        setToken(data.resetToken);
        setStep("reset");
        toast.push("Reset code generated. Set a new password below.", "info");
      }
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Could not send the reset request.");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<{ message: string }>("/auth/reset-password", { token, password });
      toast.push(data.message);
      setStep("request");
      setMessage("Password updated. You can sign in now.");
      setPassword("");
      setToken("");
    } catch (resetError) {
      setError(resetError instanceof ApiError ? resetError.message : "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <LogoMark size={40} />
        <span className="text-lg font-extrabold">PG Manager</span>
      </div>
      <h1 className="text-2xl font-extrabold">Reset your password</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {step === "request"
          ? "Enter the email you signed up with and we will help you set a new password."
          : "Paste the reset code and choose a new password."}
      </p>

      {step === "request" ? (
        <form onSubmit={requestReset} className="mt-7 space-y-4">
          <Field label="Email address">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </Field>
          <Button type="submit" full size="lg" loading={loading}>
            Send reset instructions
          </Button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="mt-7 space-y-4">
          <Field label="Reset code" hint="Prefilled for this deployment. In production this arrives by email.">
            <Input value={token} onChange={(event) => setToken(event.target.value)} required />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </Field>
          <Button type="submit" full size="lg" loading={loading}>
            Set new password
          </Button>
        </form>
      )}

      {message ? <p className="mt-4 rounded-xl bg-mint/15 px-3.5 py-2.5 text-[13px] text-[#4E65F6]">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl bg-danger/5 px-3.5 py-2.5 text-[13px] text-[#141928]">{error}</p> : null}

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
