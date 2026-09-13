"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * TrustedDevices — manage the devices previously accepted during
 * pairing. Listed on the home screen (collapsed until opened); each
 * row can be revoked, which restores the confirmation prompt for that
 * device on the next pairing.
 */

import { ChevronDown, ChevronUp, ShieldCheck, X } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import type { TrustedDevice } from "../../../main/transfer/trusted-devices";

const TrustedDevices = memo(function TrustedDevicesPanel() {
	const [devices, setDevices] = useState<TrustedDevice[]>([]);
	const [open, setOpen] = useState(false);

	const refresh = useCallback(() => {
		window.ipc.trust
			.list()
			.then((result) => {
				setDevices(result.devices);
			})
			.catch(() => {
				setDevices([]);
			});
	}, []);

	useEffect(() => {
		refresh();
		const onFocus = (): void => {
			refresh();
		};
		window.addEventListener("focus", onFocus);
		return () => {
			window.removeEventListener("focus", onFocus);
		};
	}, [refresh]);

	const handleRevoke = useCallback(
		(id: string) => {
			window.ipc.trust.revoke(id).then(refresh);
		},
		[refresh]
	);
	const toggleOpen = useCallback(() => {
		setOpen((prev) => !prev);
	}, []);

	if (devices.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2 rounded-xl border bg-card p-4">
			<button
				aria-expanded={open}
				className="flex w-full items-center gap-2 text-left"
				onClick={toggleOpen}
				type="button"
			>
				<ShieldCheck aria-hidden={true} className="h-4 w-4 text-receive" />
				<span className="flex-1 font-medium text-foreground text-sm">
					Trusted devices
					<span className="ml-2 text-muted-foreground">{devices.length}</span>
				</span>
				{open ? (
					<ChevronUp aria-hidden={true} className="h-4 w-4" />
				) : (
					<ChevronDown aria-hidden={true} className="h-4 w-4" />
				)}
			</button>
			{open ? (
				<ul className="divide-y divide-border">
					{devices.map((device) => (
						<li className="flex items-center gap-3 py-2" key={device.id}>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-foreground text-sm">
									{device.name}
								</p>
								<p className="truncate font-mono text-muted-foreground text-xs">
									{device.id}
								</p>
							</div>
							<button
								aria-label={`Revoke trust for ${device.name}`}
								className="shrink-0 rounded-lg border p-1.5 text-muted-foreground transition hover:border-destructive hover:text-destructive"
								// biome-ignore lint/performance/noJsxPropsBind: per-device identity is only known at render time
								onClick={() => {
									handleRevoke(device.id);
								}}
								title="Revoke trust, ask again next time"
								type="button"
							>
								<X aria-hidden={true} className="h-4 w-4" />
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
});

export default TrustedDevices;
