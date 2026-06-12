import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rox",
    short_name: "Rox",
    description: "Peer-to-peer file sharing and streaming over WebRTC",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    // Slice 11: register as a share target so the app appears in
    // the OS share sheet (Photos, Files, WhatsApp, Mail, etc.).
    // The browser POSTs the shared file as multipart/form-data
    // to /share-target; the service worker intercepts and
    // redirects to the share-target page for display.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [{ name: "file", accept: ["*/*"] }],
      },
    },
  } as MetadataRoute.Manifest & {
    share_target?: {
      action: string;
      method: string;
      enctype: string;
      params: { files: { name: string; accept: string[] }[] };
    };
  };
}
