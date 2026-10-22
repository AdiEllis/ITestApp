import type { Assignment } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { AppError } from "./authz";
import { randomToken, sha256 } from "./crypto";
import { env } from "./env";

/**
 * Classroom exams in Safe Exam Browser (SEB, free, safeexambrowser.org).
 *
 * The teacher downloads a config file (.seb) for the assignment. Opening it starts SEB in full screen
 * on the assignment page, and SEB blocks every other site and program until the exam ends.
 * The file adds a secret marker to SEB's user agent; the server refuses SEB-only assignments
 * without it, so the exam cannot be opened in a regular browser.
 *
 * The marker is not cryptographic proof (a technical student could fake a user agent in another
 * browser), but in a classroom with a proctor it reliably separates SEB from a normal browser.
 */

export const SEB_MARKER_PREFIX = "OralPrepSEB/";

export function newSebKey() {
  return randomToken(18);
}

/** A 6-digit quit password for the proctor. */
export function newQuitPassword() {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}

export function sebMarker(sebKey: string) {
  return `${SEB_MARKER_PREFIX}${sebKey}`;
}

export function isInSeb(userAgent: string | null | undefined, sebKey: string | null) {
  return !!sebKey && !!userAgent && userAgent.includes(sebMarker(sebKey));
}

export const SEB_REQUIRED_MESSAGE = "את המבחן הזה עושים רק בכיתה, במחשב הנעול (Safe Exam Browser). פנו למשגיח/ה.";

export function assertSebIfRequired(assignment: Pick<Assignment, "requireSeb" | "sebKey">, userAgent: string | null | undefined) {
  if (assignment.requireSeb && !isInSeb(userAgent, assignment.sebKey)) throw new AppError(403, SEB_REQUIRED_MESSAGE);
}

// ---------------- Config file ----------------

type PlistValue = string | number | boolean | PlistValue[] | { [k: string]: PlistValue };

function xml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plistValue(v: PlistValue, indent: string): string {
  if (typeof v === "boolean") return `${indent}<${v}/>`;
  if (typeof v === "number") return `${indent}<integer>${Math.round(v)}</integer>`;
  if (typeof v === "string") return `${indent}<string>${xml(v)}</string>`;
  if (Array.isArray(v)) return `${indent}<array>\n${v.map((x) => plistValue(x, indent + "\t")).join("\n")}\n${indent}</array>`;
  const keys = Object.keys(v).sort();
  return `${indent}<dict>\n${keys.map((k) => `${indent}\t<key>${xml(k)}</key>\n${plistValue(v[k], indent + "\t")}`).join("\n")}\n${indent}</dict>`;
}

function hostOf(url: string) {
  return new URL(url).host;
}

/**
 * Builds an unencrypted SEB config (XML property list). SEB for Windows, macOS and iPad accept this
 * plain format. Setting names follow SEB's documented configuration keys.
 */
export function buildSebConfig(assignment: Pick<Assignment, "id" | "sebKey" | "sebQuitPassword">, opts: { googleSignIn: boolean; appUrl?: string } = { googleSignIn: false }) {
  if (!assignment.sebKey) throw new Error("assignment has no SEB key");
  const appUrl = opts.appUrl ?? env.appUrl;
  const host = hostOf(appUrl);
  const allowedHosts = [host];
  // Students who sign in with Google pass through Google's sign-in pages.
  if (opts.googleSignIn) allowedHosts.push("accounts.google.com", "accounts.google.co.il", "accounts.youtube.com");
  // An expression without a path allows every page on that host.
  const rules: PlistValue[] = allowedHosts.map((h) => ({ active: true, regex: false, action: 1, expression: h }));
  const settings: Record<string, PlistValue> = {
    originatorVersion: "OralPrep",
    // 0 = this file starts an exam (it does not change the computer's SEB settings).
    sebConfigPurpose: 0,
    startURL: `${appUrl}/s/assignments/${assignment.id}`,
    browserUserAgent: sebMarker(assignment.sebKey),
    // Only our site (and the sign-in pages) may be opened. Recordings upload in the background and are not affected.
    URLFilterEnable: true,
    URLFilterEnableContentFilter: false,
    URLFilterRules: rules,
    // Microphone for recording answers, sound for hearing the questions.
    allowAudioCapture: true,
    allowVideoCapture: false,
    audioControlEnabled: true,
    audioMute: false,
    audioSetVolumeLevel: false,
    // After submitting, the student's page offers a button that closes SEB.
    quitURL: `${appUrl}/seb/quit`,
    quitURLConfirm: false,
    allowQuit: true,
    hashedQuitPassword: sha256(assignment.sebQuitPassword ?? ""),
    // Reloading is safe: answers are saved and the exam resumes where it was.
    browserWindowAllowReload: true,
    showReloadButton: true,
    showTaskBar: true,
    enableZoomPage: true,
    enableZoomText: true,
    allowSpellCheck: false,
    allowDictionaryLookup: false,
    allowPDFPlugIn: false,
    allowDownUploads: false,
    allowDownloads: false,
    allowUploads: false,
    allowPrint: false,
    allowPreferencesWindow: false,
    allowApplicationLog: false,
    allowScreenSharing: false,
    allowSwitchToApplications: false,
    allowFlashFullscreen: false,
    enableAppSwitcherCheck: true,
    sendBrowserExamKey: false,
    newBrowserWindowByLinkPolicy: 0,
    newBrowserWindowByScriptPolicy: 0,
  };
  if (!assignment.sebQuitPassword) delete settings.hashedQuitPassword;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${plistValue(settings, "")}
</plist>
`;
}
