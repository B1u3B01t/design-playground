"use client";

import Link from "next/link";
import { EmailSentPanel } from "./EmailSentPanel";

interface SignupFormProps {
	fullName: string;
	setFullName: (value: string) => void;
	email: string;
	setEmail: (value: string) => void;
	password: string;
	setPassword: (value: string) => void;
	loading: boolean;
	error: string | null;
	emailSent: boolean;
	setEmailSent: (value: boolean) => void;
	onEmailSignup: (e: React.FormEvent) => void;
	onGoogleSignup: () => void;
	callbackUrl: string;
	/**
	 * When set, the form does NOT call the Supabase signup handler — instead
	 * it calls `onContinue` after the submit button is pressed. Used by the
	 * playground flow simulator to walk between stages with mock data.
	 */
	flowMode?: boolean;
	onContinue?: () => void;
}

export function SignupForm({
	fullName, setFullName,
	email, setEmail,
	password, setPassword,
	loading, error,
	emailSent, setEmailSent,
	onEmailSignup, onGoogleSignup,
	callbackUrl,
	flowMode = false,
	onContinue,
}: SignupFormProps) {
	if (emailSent) {
		return (
			<EmailSentPanel
				email={email}
				onTryAgain={() => setEmailSent(false)}
				onContinue={flowMode ? onContinue : undefined}
			/>
		);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (flowMode) {
			onContinue?.();
			return;
		}
		onEmailSignup(e);
	}

	return (
		<div className="w-full">
			{error && (
				<div className="mb-5 border-l-2 border-red-600 bg-red-50/60 px-3 py-2 text-sm text-red-700">
					{error}
				</div>
			)}

			<form onSubmit={handleSubmit} className="relative">
				<div
					className="pointer-events-none absolute left-[11px] top-5 bottom-5 w-px bg-stone-200"
					aria-hidden="true"
				/>

				<div className="space-y-6">
					<div className="relative flex items-start gap-4">
						<div className="relative z-10 mt-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-[10px] font-semibold tracking-wider text-stone-900">
							01
						</div>
						<div className="flex-1 min-w-0">
							<label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
								Full name
							</label>
							<input
								type="text"
								className="mt-1 h-10 w-full border-0 border-b border-stone-200 bg-transparent px-0 text-base text-stone-900 placeholder:text-stone-500/50 focus:border-stone-900 focus:outline-none focus:ring-0 transition-colors"
								placeholder="Ada Lovelace"
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="relative flex items-start gap-4">
						<div className="relative z-10 mt-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-[10px] font-semibold tracking-wider text-stone-900">
							02
						</div>
						<div className="flex-1 min-w-0">
							<label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
								Email address
							</label>
							<input
								type="email"
								className="mt-1 h-10 w-full border-0 border-b border-stone-200 bg-transparent px-0 text-base text-stone-900 placeholder:text-stone-500/50 focus:border-stone-900 focus:outline-none focus:ring-0 transition-colors"
								placeholder="ada@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="relative flex items-start gap-4">
						<div className="relative z-10 mt-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-[10px] font-semibold tracking-wider text-stone-900">
							03
						</div>
						<div className="flex-1 min-w-0">
							<label className="block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
								Create a password
							</label>
							<input
								type="password"
								className="mt-1 h-10 w-full border-0 border-b border-stone-200 bg-transparent px-0 text-base text-stone-900 placeholder:text-stone-500/50 focus:border-stone-900 focus:outline-none focus:ring-0 transition-colors"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required={!flowMode}
							/>
							<p className="mt-2 text-xs text-stone-500 leading-relaxed">
								Min. 8 characters with uppercase/lowercase, a digit, &amp; special character.
							</p>
						</div>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-6 font-medium text-white transition-colors hover:bg-stone-900/90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
				>
					{loading ? "Creating account…" : (
						<>
							<span>Create account</span>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M5 12h14" />
								<path d="m12 5 7 7-7 7" />
							</svg>
						</>
					)}
				</button>
			</form>

			<div className="relative my-6">
				<div className="absolute inset-0 flex items-center" aria-hidden="true">
					<div className="w-full border-t border-stone-200" />
				</div>
				<div className="relative flex justify-center">
					<span className="bg-stone-50 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">
						Or sign up in one click
					</span>
				</div>
			</div>

			<button
				onClick={flowMode ? onContinue : onGoogleSignup}
				disabled={loading}
				className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-stone-200 bg-white font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
			>
				{loading ? "Redirecting…" : (
					<>
						<svg className="w-5 h-5" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
						</svg>
						Continue with Google
					</>
				)}
			</button>

			<p className="mt-7 text-center text-sm text-stone-500">
				Already have an account?{" "}
				<Link
					href={`/login?redirect=${encodeURIComponent(callbackUrl)}`}
					className="font-medium text-stone-900 underline underline-offset-4 hover:no-underline"
				>
					Log in
				</Link>
			</p>
		</div>
	);
}
