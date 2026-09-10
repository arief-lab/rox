import React from 'react'
import Head from 'next/head'

export default function HomePage() {
  return (
    <React.Fragment>
      <Head>
        <title>Rox</title>
      </Head>
      <div className="grid grid-cols-1 w-full min-h-screen place-items-center bg-neutral-950 text-neutral-100">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Rox</h1>
          <p className="text-neutral-400">Peer-to-peer file sharing, desktop edition.</p>
          <p className="text-xs text-neutral-600">
            Transfer features land in renderer/features — see apps/desktop/AGENTS.md
          </p>
        </div>
      </div>
    </React.Fragment>
  )
}
