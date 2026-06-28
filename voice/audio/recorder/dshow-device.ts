/** Resolve Windows DirectShow microphone device string for ffmpeg. */
export function resolveDshowDevice(
  configured?: string,
): string {
  const raw = (configured ?? process.env.VOICE_DSHOW_DEVICE ?? "").trim();
  if (!raw) return "audio=Microphone";
  return raw.startsWith("audio=") ? raw : `audio=${raw}`;
}
