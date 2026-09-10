"use client";

import Head from "next/head";

import { ReceiveFeature } from "../features/transfer/receive-feature";
import { SendFeature } from "../features/transfer/send-feature";
import { useTransfer } from "../shared/use-transfer";

export default function HomePage() {
	const transfer = useTransfer();

	return (
		<>
			<Head>
				<title>Rox</title>
			</Head>
			<main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
				<div className="mx-auto max-w-2xl space-y-6">
					<header className="space-y-1">
						<h1 className="font-bold text-3xl">Rox</h1>
						<p className="text-neutral-400 text-sm">
							Peer-to-peer file sharing, desktop edition — powered by Hyperdrive
							&amp; Hyperswarm.
						</p>
					</header>

					<SendFeature transfer={transfer} />
					<ReceiveFeature transfer={transfer} />

					<footer className="pt-2 text-center text-neutral-600 text-xs">
						Rox · transfers flow peer-to-peer, no servers
					</footer>
				</div>
			</main>
		</>
	);
}
