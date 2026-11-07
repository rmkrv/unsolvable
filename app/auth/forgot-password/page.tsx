import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Reset your password</h1><p>Enter your account email. The response is the same whether or not an account exists.</p><PasswordRecoveryForm mode="request" initialEmail={email} /></section></main>;
}
