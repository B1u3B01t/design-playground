"use client";

import { Check } from "lucide-react";

const FREE_FEATURES = [
	"Full access to the AI UX interactions gallery",
	"Create 1 collection",
	"Basic monthly newsletters",
];

const PRO_FEATURES = [
	"Everything in Free, plus:",
	"Download 86-page 'Trending AI UX Patterns' ebook",
	"Create unlimited collections",
	"Share collections without paywalls",
	"Access the entire Patterns Library",
	"Access all Insights, Case studies & Cheatsheets",
];

const TEAM_FEATURES = [
	"Everything in Pro, plus:",
	"1:1 Onboarding call",
	"Share patterns without login / paywalls",
	"Team training: AI patterns workshop (2 Hrs)",
	"AI UX product audit",
	"Workshop kit for Facilitators",
];

export type Plan = "free" | "pro" | "team";
export type BillingCycle = "annual" | "quarterly";

interface PlanCardsProps {
	selectedPlan: Plan;
	onSelectPlan: (plan: Plan) => void;
	billingCycle: BillingCycle;
	onBillingCycleChange: (cycle: BillingCycle) => void;
	firstName: string;
}

function PlanCard({
	selected,
	onClick,
	title,
	price,
	description,
	features,
	variant = "default",
}: {
	selected: boolean;
	onClick: () => void;
	title: string;
	price: React.ReactNode;
	description: string;
	features: string[];
	variant?: "default" | "pro";
}) {
	const selectedClasses =
		variant === "pro"
			? "shadow-lg border-orange-600/50 ring-2 ring-orange-600/20"
			: "shadow-md border-stone-900/40 ring-2 ring-stone-900/10";

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}}
			className={`w-full text-left bg-white rounded-2xl p-5 border transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.98] ${selected ? selectedClasses : "shadow-sm hover:shadow-lg border-stone-200/40 hover:border-stone-200"}`}
		>
			<div className="flex items-center justify-between mb-1">
				<h3 className="text-lg font-semibold text-stone-900">{title}</h3>
				{price}
			</div>
			<p className="text-xs text-stone-500 mb-3">{description}</p>
			<ul className="space-y-2">
				{features.map((f) => (
					<li key={f} className="flex items-start gap-2 text-sm text-stone-500">
						<Check className="w-3.5 h-3.5 text-stone-900 mt-0.5 shrink-0" />
						<span>{f}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function BillingToggle({
	billingCycle,
	onChange,
}: {
	billingCycle: BillingCycle;
	onChange: (cycle: BillingCycle) => void;
}) {
	return (
		<div
			className="flex items-center gap-1.5"
			onClick={(e) => e.stopPropagation()}
		>
			<span className="text-[10px] text-stone-500">billed</span>
			<div className="flex items-center p-0.5 bg-stone-100 rounded-full">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onChange("annual");
					}}
					className={`relative px-2 py-1 text-[10px] font-medium rounded-full transition-all ${
						billingCycle === "annual"
							? "bg-stone-50 text-stone-900 shadow-sm"
							: "text-stone-500 hover:text-stone-900"
					}`}
				>
					Annually
					{billingCycle === "quarterly" && (
						<span className="ml-0.5 text-[9px] text-orange-600 font-semibold">-30%</span>
					)}
				</button>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onChange("quarterly");
					}}
					className={`px-2 py-1 text-[10px] font-medium rounded-full transition-all ${
						billingCycle === "quarterly"
							? "bg-stone-50 text-stone-900 shadow-sm"
							: "text-stone-500 hover:text-stone-900"
					}`}
				>
					Quarterly
				</button>
			</div>
		</div>
	);
}

export function PlanCards({ selectedPlan, onSelectPlan, billingCycle, onBillingCycleChange, firstName }: PlanCardsProps) {
	const proPrice = billingCycle === "annual" ? 8 : 12;

	return (
		<>
			<h2 className="text-4xl sm:text-5xl font-serif tracking-tight text-stone-900 text-center mb-10">
				{firstName ? <>What&rsquo;s right for you, <em>{firstName}</em>?</> : <>Compare <em>Plans</em></>}
			</h2>

			<div className="space-y-3">
				<PlanCard
					selected={selectedPlan === "free"}
					onClick={() => onSelectPlan("free")}
					title="Free"
					price={<span className="text-lg font-semibold text-stone-900">$0</span>}
					description="For curious designers, students and hobbyists"
					features={FREE_FEATURES}
				/>
				<PlanCard
					selected={selectedPlan === "pro"}
					onClick={() => onSelectPlan("pro")}
					title="PRO"
					price={
						<div className="flex items-center gap-3">
							<BillingToggle billingCycle={billingCycle} onChange={onBillingCycleChange} />
							<div className="text-right">
								<span className="text-lg font-semibold text-stone-900">${proPrice}</span>
								<span className="text-xs text-stone-500">/mo</span>
							</div>
						</div>
					}
					description="For designers actively building AI products"
					features={PRO_FEATURES}
					variant="pro"
				/>
				<div className="bg-white rounded-2xl p-5 border border-stone-200/40">
					<div className="flex items-center gap-1 mb-2">
						{Array.from({ length: 5 }).map((_, i) => (
							<span key={i} className="text-orange-600 text-sm">★</span>
						))}
					</div>
					<p className="text-stone-900 text-sm italic leading-relaxed">
						&ldquo;Our VP of UX recommended the library to the whole team.&rdquo;
					</p>
					<p className="text-stone-500 text-xs mt-2">— UX Designer at ADP</p>
				</div>
				<PlanCard
					selected={selectedPlan === "team"}
					onClick={() => onSelectPlan("team")}
					title="Team"
					price={<span className="text-sm font-medium text-stone-500">Custom</span>}
					description="For teams shipping AI at scale"
					features={TEAM_FEATURES}
				/>
			</div>
		</>
	);
}
