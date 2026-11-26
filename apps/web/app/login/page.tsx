'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@memories/ui/button';
import { useMutation } from '@tanstack/react-query';
import { Camera, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authApi } from '@/lib/api';

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
});
type LoginInput = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => router.replace('/dashboard'),
  });
  return (
    <main className="grid min-h-screen bg-[#faf9f6] text-[#252522] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#65594e] p-14 text-white lg:flex lg:flex-col lg:justify-between xl:p-20">
        <div className="absolute -right-24 top-1/4 h-[65%] w-[62%] rotate-6 bg-[#b9aa99] opacity-55" />
        <div className="absolute -bottom-20 -left-16 h-[48%] w-[54%] -rotate-6 bg-[#596760] opacity-65" />
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#08090d]">
            <Camera size={20} />
          </span>
          <span className="font-serif text-2xl">Memories Photography</span>
        </div>
        <div>
          <p className="relative text-xs font-semibold uppercase tracking-[.2em] text-white">
            Your studio workspace
          </p>
          <p className="mt-6 max-w-xl font-serif text-6xl leading-[.95]">
            Every event.
            <br />
            Every meaningful frame.
          </p>
          <p className="relative mt-7 max-w-md text-base leading-7 text-white">
            Manage private event galleries and help guests find the photographs made for them.
          </p>
        </div>
        <div className="flex gap-5 text-xs text-white/35">
          <span className="relative flex items-center gap-2 text-white">
            <ShieldCheck size={14} className="text-emerald-400" />
            Secure administration
          </span>
          <span className="relative">Private event collections</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md p-2 sm:p-8">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full border border-[#ded8cf] bg-white">
            <LockKeyhole className="h-5 w-5 text-[#8b7356]" />
          </div>
          <h1 className="font-serif text-4xl">Welcome back</h1>
          <p className="mt-2 text-sm text-[#696660]">Sign in to your studio workspace.</p>
          <form
            className="mt-8 space-y-5"
            onSubmit={form.handleSubmit((values) => login.mutate(values))}
            noValidate
          >
            <label className="block text-sm font-medium">
              Email address
              <input
                {...form.register('email')}
                autoComplete="email"
                inputMode="email"
                className="mt-2 h-12 w-full rounded-none border-0 border-b border-[#d8d1c8] bg-transparent px-0 outline-none focus:border-[#8b7356]"
              />
              {form.formState.errors.email && (
                <span className="mt-1 block text-xs text-red-700">
                  {form.formState.errors.email.message}
                </span>
              )}
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                {...form.register('password')}
                type="password"
                autoComplete="current-password"
                className="mt-2 h-12 w-full rounded-none border-0 border-b border-[#d8d1c8] bg-transparent px-0 outline-none focus:border-[#8b7356]"
              />
              {form.formState.errors.password && (
                <span className="mt-1 block text-xs text-red-700">
                  {form.formState.errors.password.message}
                </span>
              )}
            </label>
            {login.error && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {login.error.message}
              </div>
            )}
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-[#696660] hover:text-[#252522]">
                Forgot password?
              </Link>
            </div>
            <Button
              className="min-h-12 w-full rounded-full bg-[#252522] text-white hover:bg-[#4a443d]"
              disabled={login.isPending}
              type="submit"
            >
              {login.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Sign in
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
