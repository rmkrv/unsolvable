import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Choose a new password</h1><p>Use a unique password with at least eight characters.</p><PasswordRecoveryForm mode="reset" token={token} /></section></main>;
}
