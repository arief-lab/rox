/**
 * Demo fixtures for slice 1.
 *
 * The SDP is hardcoded so the round-trip test has a known input. A real app
 * would obtain the SDP from the WebRTC peer connection — that arrives in
 * slice 2 and beyond.
 */
export const DEMO_OFFER_SDP =
  "v=0\no=- 99999 88888 IN IP4 192.168.1.42\ns=-\nt=0 0\n";

export const DEMO_OFFER_NAME = "Slice1Tester";
