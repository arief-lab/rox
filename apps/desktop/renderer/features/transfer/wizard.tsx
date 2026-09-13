"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transfer wizard shell — a guided, step-based flow that replaces the
 * old side-by-side send/receive panels. Submodules implement each leg:
 *  - ChooseMode: pick send or receive
 *  - SendWizard:  dropzone → offer QR
 *  - ReceiveWizard: scan/paste → progress → done
 */

import { type ReactNode, useCallback, useState } from "react";

export type TransferMode = "send" | "receive" | null;

export interface WizardStep {
	body: ReactNode;
	title: string;
}

export function Wizard({
	steps,
	current,
	onBack,
}: {
	steps: WizardStep[];
	current: number;
	onBack: () => void;
}) {
	const canGoBack = current > 0;

	return (
		<section className="space-y-6 rounded-xl border bg-card p-6">
			<ol aria-label="Transfer progress" className="flex items-center gap-2">
				{steps.map((step, index) => {
					const isDone = index < current;
					const isActive = index === current;
					let stepTone: string;
					if (isDone) {
						stepTone = "border-send bg-send text-send-foreground";
					} else if (isActive) {
						stepTone = "border-send text-send";
					} else {
						stepTone = "border-border text-muted-foreground";
					}
					return (
						<li className="flex flex-1 items-center gap-2" key={step.title}>
							<span
								aria-current={isActive ? "step" : undefined}
								className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${stepTone}`}
							>
								{isDone ? "✓" : index + 1}
							</span>
							<span
								className={`hidden text-xs sm:inline ${
									isActive ? "text-foreground" : "text-muted-foreground"
								}`}
							>
								{step.title}
							</span>
							{index < steps.length - 1 ? (
								<span className="h-px flex-1 bg-border" />
							) : null}
						</li>
					);
				})}
			</ol>

			{steps[current]?.body}

			{canGoBack ? (
				<button
					className="rounded-lg border px-4 py-2 text-muted-foreground text-sm transition hover:text-foreground"
					onClick={onBack}
					type="button"
				>
					← Start over
				</button>
			) : null}
		</section>
	);
}

export function useWizardStep<T extends string>(
	initial: T
): [T, (next: T) => void, () => void] {
	const [step, setStep] = useState<T>(initial);

	const go = useCallback((next: T) => {
		setStep(next);
	}, []);

	const reset = useCallback(() => {
		setStep(initial);
	}, [initial]);

	return [step, go, reset];
}
