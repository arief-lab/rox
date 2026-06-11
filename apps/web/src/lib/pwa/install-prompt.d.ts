/**
 * Non-standard browser event fired when a PWA meets installability
 * criteria (Chrome / Android). Not in the standard DOM lib.
 */
interface BeforeInstallPromptEvent extends Event {
  /** Trigger the native Add to Home Screen dialog. */
  prompt: () => Promise<void>;
  /** The user's response to the install prompt. */
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
