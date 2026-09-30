/**
 * Re-encodes a browser recording as 16 kHz mono 16-bit PCM WAV.
 *
 * Why: MediaRecorder's WebM is a streaming container without duration/cues.
 * Browsers play it, but OpenAI's transcription rejects it ("corrupted or
 * unsupported") once the recorder was paused/resumed or flushed with
 * requestData() - which pause-and-continue and listen-before-send need. WAV is
 * accepted everywhere. 16 kHz mono is plenty for speech: ~1.9 MB per minute.
 */
export async function toWav(recording: Blob, sampleRate = 16000): Promise<Blob> {
  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(await recording.arrayBuffer())
  } finally {
    void context.close()
  }

  // Resample + downmix to mono by rendering through an offline context.
  const frames = Math.ceil(decoded.duration * sampleRate)
  const offline = new OfflineAudioContext(1, frames, sampleRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const samples = (await offline.startRendering()).getChannelData(0)

  const header = 44
  const view = new DataView(new ArrayBuffer(header + samples.length * 2))
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(header + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}
