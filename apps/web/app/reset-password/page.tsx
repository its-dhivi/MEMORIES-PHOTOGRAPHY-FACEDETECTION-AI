'use client';
import { Button } from '@memories/ui/button';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { authApi } from '@/lib/api';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const reset = useMutation({ mutationFn: () => authApi.resetPassword({ token, password }) });
  return (
    <main className="ai-ambient cinematic-grid flex min-h-screen items-center justify-center bg-[#08090d] p-6">
      <section className="glass w-full max-w-md rounded-[1.75rem] p-9">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">Memories Photography</p>
        <h1 className="mt-4 font-serif text-4xl">Choose a new password</h1>
        {!token ? (
          <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            This reset link is incomplete.
          </p>
        ) : reset.isSuccess ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
            Your password was updated. You can now sign in.
          </div>
        ) : (
          <form
            className="mt-7 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              reset.mutate();
            }}
          >
            <label className="block text-sm font-medium">
              New password
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.04] px-4 outline-none focus:border-violet-400"
              />
            </label>
            <p className="text-xs text-slate-500">
              Use at least 12 characters with uppercase, lowercase, and a number.
            </p>
            {reset.error && (
              <p role="alert" className="text-sm text-red-700">
                {reset.error.message}
              </p>
            )}
            <Button
              className="w-full bg-violet-600 text-white hover:bg-violet-500"
              disabled={reset.isPending}
            >
              Update password
            </Button>
          </form>
        )}
        <Link
          href="/login"
          className="mt-6 block text-center text-sm text-white/45 hover:text-white"
        >
          Go to sign in
        </Link>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ivory" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
