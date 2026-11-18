"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { CircleCheckIcon, MailCheckIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { safeReturnPath } from "@/lib/auth/return-path";
import { authClient } from "@/lib/client/auth/client";

type AuthMode = "sign-in" | "sign-up";
type PendingAction = "google" | "email" | "verify" | "resend" | null;

function authenticationError(reason: unknown) {
  if (reason && typeof reason === "object") {
    const status = Number((reason as { status?: unknown }).status);
    if (status >= 500) return "The authentication service is temporarily unavailable. Please try again.";
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Authentication failed. Please try again.";
}

function authenticationErrorCode(reason: unknown) {
  if (!reason || typeof reason !== "object") return "";
  const directCode = (reason as { code?: unknown }).code;
  if (typeof directCode === "string") return directCode;
  const nestedCode = (reason as { error?: { code?: unknown } }).error?.code;
  return typeof nestedCode === "string" ? nestedCode : "";
}

function requiresEmailVerification(reason: unknown) {
  return authenticationErrorCode(reason).toUpperCase() === "EMAIL_NOT_VERIFIED";
}

function oauthContinuationError(reason: unknown) {
  return (reason as { status?: number } | undefined)?.status === 400
    ? "This authorization link has expired. Return to Codex and connect again."
    : "Could not continue authorization. Please try again.";
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14.1a6 6 0 0 1 0-4.2V7.3H3.2a10 10 0 0 0 0 9.4l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.9.5 3.9 1.5l2.8-2.8A9.4 9.4 0 0 0 12 2a10 10 0 0 0-8.8 5.3l3.3 2.6A5.8 5.8 0 0 1 12 5.9Z" />
    </svg>
  );
}

function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <Alert className="border-primary/20 bg-primary/5" role="status">
      <CircleCheckIcon />
      <AlertDescription className="text-foreground/80">{children}</AlertDescription>
    </Alert>
  );
}

function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function AuthForm({
  mode,
  redirectTo,
  oauthVisit = false,
  oauthPrompt = "",
}: {
  mode: AuthMode;
  redirectTo?: string;
  oauthVisit?: boolean;
  oauthPrompt?: string;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const requestedDestination = safeReturnPath(redirectTo);
  const destination = requestedDestination.startsWith("/app")
    ? requestedDestination
    : `/app?returnTo=${encodeURIComponent(requestedDestination)}`;
  const isSignUp = mode === "sign-up";
  const pending = pendingAction !== null;

  useEffect(() => {
    if (!oauthVisit) return;
    const params = new URLSearchParams(window.location.search);
    const returnedFromGoogle = params.get("authReturn") === "google";
    const mustSignInAgain = /\b(login|create)\b/.test(oauthPrompt);
    if (mustSignInAgain && !returnedFromGoogle) return;

    authClient.getSession().then(({ data: session }) => {
      if (session) return authClient.oauth2.continue({ selected: true });
    }).catch((reason: unknown) => {
      setError(oauthContinuationError(reason));
    });
  }, [oauthPrompt, oauthVisit]);

  async function continueAfterAuthentication() {
    if (!oauthVisit) {
      window.location.assign(destination);
      return;
    }

    try {
      await authClient.oauth2.continue({ selected: true });
    } catch (reason) {
      setError(oauthContinuationError(reason));
      setPendingAction(null);
    }
  }

  async function signInWithGoogle() {
    setPendingAction("google");
    setError(null);
    setNotice(null);

    const callbackURL = oauthVisit ? new URL(window.location.href) : new URL(destination, window.location.origin);
    if (oauthVisit) callbackURL.searchParams.set("authReturn", "google");

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackURL.toString(),
      });
      if (result.error) {
        setError(result.error.message || "Google sign-in failed. Please try again.");
        setPendingAction(null);
      }
    } catch (reason) {
      setError(authenticationError(reason));
      setPendingAction(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("email");
    setError(null);
    setNotice(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        if (requiresEmailVerification(result.error)) {
          setVerificationEmail(email);
          setNotice("We sent a fresh verification code to your email.");
        } else {
          setError(result.error.message || "Authentication failed. Please try again.");
        }
        setPendingAction(null);
        return;
      }

      const signedUpUser = isSignUp
        ? (result.data as { user?: { emailVerified?: boolean } } | null | undefined)?.user
        : null;
      if (signedUpUser && !signedUpUser.emailVerified) {
        setVerificationEmail(email);
        setNotice("Enter the six-digit code we sent to your email.");
        setPendingAction(null);
        return;
      }

      const redirected = Boolean((result.data as { redirect?: boolean } | null | undefined)?.redirect);
      if (!redirected) await continueAfterAuthentication();
    } catch (reason) {
      if (requiresEmailVerification(reason)) {
        setVerificationEmail(email);
        setNotice("We sent a fresh verification code to your email.");
      } else {
        setError(authenticationError(reason));
      }
      setPendingAction(null);
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verificationEmail) return;
    setPendingAction("verify");
    setError(null);
    setNotice(null);

    const data = new FormData(event.currentTarget);
    const otp = String(data.get("otp") ?? "").trim();

    try {
      const result = await authClient.emailOtp.verifyEmail({ email: verificationEmail, otp });
      if (result.error) {
        setError(result.error.message || "That verification code could not be confirmed.");
        setPendingAction(null);
        return;
      }

      const { data: session } = await authClient.getSession();
      if (!session) {
        const signInPath = `/auth/sign-in?redirectTo=${encodeURIComponent(requestedDestination)}`;
        router.push(signInPath);
        return;
      }
      await continueAfterAuthentication();
    } catch (reason) {
      setError(authenticationError(reason));
      setPendingAction(null);
    }
  }

  async function resendVerificationCode() {
    if (!verificationEmail) return;
    setPendingAction("resend");
    setError(null);
    setNotice(null);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: verificationEmail,
        type: "email-verification",
      });
      if (result.error) {
        setError(result.error.message || "We could not send another code yet.");
      } else {
        setNotice("A new verification code is on its way.");
      }
    } catch (reason) {
      setError(authenticationError(reason));
    } finally {
      setPendingAction(null);
    }
  }

  const alternatePath = isSignUp ? "/auth/sign-in" : "/auth/sign-up";
  const alternateLabel = isSignUp ? "Already have an account? Sign in" : "New to Unsolvable? Create an account";

  if (verificationEmail) {
    return (
      <form className="mt-6 grid gap-4" onSubmit={verifyEmail}>
        <Alert className="border-primary/20 bg-primary/5" role="status">
          <MailCheckIcon />
          <AlertDescription className="text-foreground/80">
            Enter the six-digit code sent to <strong>{verificationEmail}</strong>.
          </AlertDescription>
        </Alert>

        <Field className="items-center">
          <FieldLabel htmlFor="otp">Verification code</FieldLabel>
          <InputOTP
            id="otp"
            name="otp"
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            autoComplete="one-time-code"
            required
            autoFocus
            aria-label="Six-digit verification code"
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => <InputOTPSlot index={index} key={index} />)}
            </InputOTPGroup>
          </InputOTP>
          <FieldDescription className="text-center">Codes expire quickly and can only be used once.</FieldDescription>
        </Field>

        {notice && <AuthNotice>{notice}</AuthNotice>}
        {error && <AuthError>{error}</AuthError>}

        <Button className="w-full" type="submit" disabled={pending}>
          {pendingAction === "verify" && <Spinner />}
          {pendingAction === "verify" ? "Verifying…" : "Verify email"}
        </Button>

        <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center">
          <Button variant="ghost" size="sm" type="button" onClick={resendVerificationCode} disabled={pending}>
            {pendingAction === "resend" ? "Sending…" : "Send another code"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => { setVerificationEmail(null); setError(null); setNotice(null); }}
            disabled={pending}
          >
            Use a different email
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={submit}>
      <Button
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        type="button"
        onClick={signInWithGoogle}
        disabled={pending}
      >
        {pendingAction === "google" ? <Spinner /> : <GoogleMark />}
        {pendingAction === "google" ? "Connecting…" : "Continue with Google"}
      </Button>

      <FieldSeparator>or continue with email</FieldSeparator>

      <FieldGroup className="gap-4">
        {isSignUp && (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" name="name" autoComplete="name" required maxLength={100} />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
          />
          {isSignUp && <FieldDescription>Use at least 8 characters and a password unique to Unsolvable.</FieldDescription>}
        </Field>
      </FieldGroup>

      {notice && <AuthNotice>{notice}</AuthNotice>}
      {error && <AuthError>{error}</AuthError>}

      <Button className="w-full" type="submit" disabled={pending}>
        {pendingAction === "email" && <Spinner />}
        {pendingAction === "email" ? "Please wait…" : isSignUp ? "Create account with email" : "Sign in with email"}
      </Button>

      {!isSignUp && !oauthVisit && (
        <Button asChild variant="link" size="sm" className="h-auto justify-center px-0 text-xs text-muted-foreground">
          <Link href="/auth/forgot-password">Forgot your password?</Link>
        </Button>
      )}
      {!oauthVisit && (
        <Button asChild variant="link" size="sm" className="h-auto justify-center px-0 text-xs text-muted-foreground">
          <Link href={`${alternatePath}?redirectTo=${encodeURIComponent(requestedDestination)}`}>{alternateLabel}</Link>
        </Button>
      )}
    </form>
  );
}
