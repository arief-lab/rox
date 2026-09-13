import type { AppProps } from "next/app";

import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
	// Desktop renderer is dark-only: root element carries the `dark` class
	// that activates the shared token theme in @rox/ui/globals.css.
	return (
		<div className="dark h-svh">
			<Component {...pageProps} />
		</div>
	);
}

export default MyApp;
