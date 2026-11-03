import type { ReadonlyURLSearchParams } from "next/navigation";
import { PLAN_VERSION, planFromPayload, type PlanParams } from "@/lib/plan";

/** Query keys that may carry a plan. `scenario` matches the lifetime app. */
export const PLAN_PARAM_KEYS = ["plan", "scenario"] as const;

/** Prefix for compressed payloads: deflate-raw, then base64url. */
const COMPRESSED_PREFIX = "z1.";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(input: string): Uint8Array<ArrayBuffer> {
  let normalized = input.trim().replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipeBytes(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

const canCompress = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

/** Encodes a plan for the `?plan=` query param. Compressed when the browser supports it. */
export async function encodePlan(params: PlanParams): Promise<string> {
  const json = JSON.stringify({ version: PLAN_VERSION, params });
  const bytes = new TextEncoder().encode(json);
  if (canCompress()) {
    const compressed = await pipeBytes(bytes, new CompressionStream("deflate-raw"));
    return COMPRESSED_PREFIX + bytesToBase64(compressed).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return bytesToBase64(bytes);
}

/** Decodes raw JSON, base64 JSON (lifetime style), or a compressed `z1.` payload. */
export async function decodePlan(raw: string): Promise<PlanParams | null> {
  const value = raw.trim();
  if (!value) return null;
  try {
    if (value.startsWith(COMPRESSED_PREFIX)) {
      if (!canCompress()) return null;
      const bytes = await pipeBytes(base64ToBytes(value.slice(COMPRESSED_PREFIX.length)), new DecompressionStream("deflate-raw"));
      return planFromPayload(JSON.parse(new TextDecoder().decode(bytes)));
    }
    if (value.startsWith("{")) return planFromPayload(JSON.parse(value));
    return planFromPayload(JSON.parse(new TextDecoder().decode(base64ToBytes(value))));
  } catch (error) {
    console.warn("Could not read plan from URL", error);
    return null;
  }
}

export function rawPlanFromQuery(searchParams: ReadonlyURLSearchParams | null): string | null {
  if (!searchParams) return null;
  for (const key of PLAN_PARAM_KEYS) {
    const raw = searchParams.get(key);
    if (raw) return raw;
  }
  return null;
}

export async function buildShareUrl(params: PlanParams): Promise<string> {
  const shareUrl = new URL(window.location.pathname, window.location.origin);
  shareUrl.searchParams.set("plan", await encodePlan(params));
  return shareUrl.toString();
}
