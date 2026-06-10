"use client";

interface EmailSentPanelProps {
	email: string;
	/** Called when the user clicks "try again" — restarts the form */
	onTryAgain?: () => void;
	/**
	 * When set, the panel renders a "I've verified — continue" button that
	 * fires this callback. Used by the playground flow simulator to advance
	 * past the verification stage without a real email link.
	 */
	onContinue?: () => void;
}

export function EmailSentPanel({ email, onTryAgain, onContinue }: EmailSentPanelProps) {
	return (
		<div className="space-y-4">
			<div className="bg-accent/60 border border-border/40 rounded-2xl p-6 text-center">
				<div className="flex items-center justify-center w-12 h-12 rounded-full bg-foreground/5 mx-auto mb-4">
					<svg className="w-6 h-6 text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
					</svg>
				</div>
				<h3 className="text-lg font-semibold text-foreground mb-1">Check your email</h3>
				<p className="text-sm text-muted-foreground">
					We sent a verification link to <span className="text-foreground font-medium">{email}</span>. Click the link to verify your account and choose your plan.
				</p>
				{onContinue && (
					<button
						onClick={onContinue}
						className="mt-5 w-full h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors cursor-pointer"
					>
						I&rsquo;ve verified — continue
					</button>
				)}
			</div>
			{onTryAgain && (
				<p className="text-center text-xs text-muted-foreground">
					Didn&rsquo;t receive it? Check your spam folder or{" "}
					<button onClick={onTryAgain} className="text-foreground underline hover:no-underline cursor-pointer">try again</button>.
				</p>
			)}
		</div>
	);
}
