"use client";

import { useEffect, useState } from "react";
import { ensureSession, supabase } from "@/lib/supabaseClient";

type Status = "idle" | "sending" | "sent" | "error";

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [linkEmail, setLinkEmail] = useState("");
  const [linkStatus, setLinkStatus] = useState<Status>("idle");
  const [linkError, setLinkError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginStatus, setLoginStatus] = useState<Status>("idle");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [otpCode, setOtpCode] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<Status>("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [linkOtpCode, setLinkOtpCode] = useState("");
  const [linkVerifyStatus, setLinkVerifyStatus] = useState<Status>("idle");
  const [linkVerifyError, setLinkVerifyError] = useState<string | null>(null);

  useEffect(() => {
    ensureSession().then(refreshUser);
  }, []);

  async function refreshUser() {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email ?? null);
    setLoading(false);
  }

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    setLinkStatus("sending");
    setLinkError(null);
    const { error } = await supabase.auth.updateUser(
      { email: linkEmail },
      { emailRedirectTo: `${window.location.origin}/account` },
    );
    if (error) {
      setLinkStatus("error");
      setLinkError(error.message);
    } else {
      setLinkStatus("sent");
    }
  }

  async function handleVerifyLinkOtp(e: React.FormEvent) {
    e.preventDefault();
    setLinkVerifyStatus("sending");
    setLinkVerifyError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: linkEmail,
      token: linkOtpCode,
      type: "email_change",
    });
    if (error) {
      setLinkVerifyStatus("error");
      setLinkVerifyError(error.message);
    } else {
      setLinkVerifyStatus("idle");
      setLinkStatus("idle");
      setLinkOtpCode("");
      await refreshUser();
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginStatus("sending");
    setLoginError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    if (error) {
      setLoginStatus("error");
      setLoginError(error.message);
    } else {
      setLoginStatus("sent");
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifyStatus("sending");
    setVerifyError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: loginEmail,
      token: otpCode,
      type: "email",
    });
    if (error) {
      setVerifyStatus("error");
      setVerifyError(error.message);
    } else {
      setVerifyStatus("idle");
      setLoginStatus("idle");
      setOtpCode("");
      await refreshUser();
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">Your account</h1>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">Loading…</p>
      ) : email ? (
        <p className="mt-4 text-sm text-zinc-300">
          Signed in as <span className="text-white">{email}</span>. Your library follows you on
          any device — just log in with this email.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-zinc-500">
            Right now your library only lives in this browser. Add your email so it&apos;s never
            lost and you can open it on any device.
          </p>

          <form onSubmit={handleSaveEmail} className="mt-6 flex gap-2">
            <input
              type="email"
              required
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-full border border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={linkStatus === "sending"}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition disabled:opacity-50"
            >
              {linkStatus === "sending" ? "Sending…" : "Save my library"}
            </button>
          </form>
          {linkStatus === "sent" && (
            <form onSubmit={handleVerifyLinkOtp} className="mt-4">
              <p className="mb-2 text-sm text-zinc-400">
                Check your email for a 6-digit code and enter it below — no need to open Safari.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={linkOtpCode}
                  onChange={(e) => setLinkOtpCode(e.target.value)}
                  placeholder="123456"
                  className="flex-1 rounded-full border border-zinc-700 bg-transparent px-4 py-2.5 text-sm tracking-widest text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={linkVerifyStatus === "sending"}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition disabled:opacity-50"
                >
                  {linkVerifyStatus === "sending" ? "Verifying…" : "Verify"}
                </button>
              </div>
              {linkVerifyStatus === "error" && (
                <p className="mt-2 text-sm text-red-400">{linkVerifyError}</p>
              )}
            </form>
          )}
          {linkStatus === "error" && (
            <p className="mt-2 text-sm text-red-400">{linkError}</p>
          )}
        </>
      )}

      <div className="mt-12 border-t border-zinc-800 pt-8">
        <h2 className="text-sm font-medium text-zinc-400">
          Already saved your library? Log in on this device
        </h2>
        <form onSubmit={handleLogin} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-full border border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loginStatus === "sending"}
            className="rounded-full border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
          >
            {loginStatus === "sending" ? "Sending…" : "Log in"}
          </button>
        </form>
        {loginStatus === "sent" && (
          <form onSubmit={handleVerifyOtp} className="mt-4">
            <p className="mb-2 text-sm text-zinc-400">
              Check your email for a 6-digit code and enter it below — no need to open Safari.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="flex-1 rounded-full border border-zinc-700 bg-transparent px-4 py-2.5 text-sm tracking-widest text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={verifyStatus === "sending"}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition disabled:opacity-50"
              >
                {verifyStatus === "sending" ? "Verifying…" : "Verify"}
              </button>
            </div>
            {verifyStatus === "error" && (
              <p className="mt-2 text-sm text-red-400">{verifyError}</p>
            )}
          </form>
        )}
        {loginStatus === "error" && (
          <p className="mt-2 text-sm text-red-400">{loginError}</p>
        )}
      </div>
    </main>
  );
}
