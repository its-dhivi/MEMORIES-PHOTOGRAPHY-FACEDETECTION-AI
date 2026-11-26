'use client';
import { Button } from '@memories/ui/button';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const request = useMutation({ mutationFn: () => authApi.forgotPassword(email) });
  return (
    <main className="ai-ambient cinematic-grid flex min-h-screen items-center justify-center bg-[#08090d] p-6">
      <section className="glass w-full max-w-md rounded-[1.75rem] p-9">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">Memories Photography</p>
        <h1 className="mt-4 font-serif text-4xl">Reset your password</h1>
        {request.isSuccess ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
            If that address belongs to an account, password reset instructions are on their way.
          </div>
        ) : (
          <form
            className="mt-7 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              request.mutate();
            }}
          >
            <label className="block text-sm font-medium">
              Email address
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.04] px-4 outline-none focus:border-violet-400"
              />
            </label>
            {request.error && (
              <p role="alert" className="text-sm text-red-700">
                {request.error.message}
              </p>
            )}
            <Button
              className="w-full bg-violet-600 text-white hover:bg-violet-500"
              disabled={request.isPending}
            >
              Send reset instructions
            </Button>
          </form>
        )}
        <Link
          href="/login"
          className="mt-6 block text-center text-sm text-white/45 hover:text-white"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
