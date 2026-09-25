/**
 * Pure-JS audio conversion, used when the browser has no (usable)
 * OfflineAudioContext to do it natively (e.g. old Safari rejects 16 kHz contexts).
 */

/** Averages the channels of an AudioBuffer into one mono channel. */
export function downmix(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0]
  if (!first) return new Float32Array(0)
  if (channels.length === 1) return first
  const mono = new Float32Array(first.length)
  for (const channel of channels) {
    for (let i = 0; i < mono.length; i++) mono[i]! += (channel[i] ?? 0) / channels.length
  }
  return mono
}

/**
 * Converts the sample rate. Downsampling averages every output window (a box
 * filter — crude, but it keeps aliasing out of the speech band); upsampling
 * interpolates linearly.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input.slice()
  const ratio = fromRate / toRate
  const output = new Float32Array(Math.round(input.length / ratio))
  if (input.length === 0) return output
  const last = input.length - 1
  if (ratio > 1) {
    for (let i = 0; i < output.length; i++) {
      const start = Math.min(Math.floor(i * ratio), last)
      const end = Math.max(start + 1, Math.min(Math.floor((i + 1) * ratio), input.length))
      let sum = 0
      for (let k = start; k < end; k++) sum += input[k]!
      output[i] = sum / (end - start)
    }
    return output
  }
  for (let i = 0; i < output.length; i++) {
    const position = i * ratio
    const index = Math.min(Math.floor(position), last)
    const next = input[Math.min(index + 1, last)]!
    const current = input[index]!
    output[i] = current + (next - current) * (position - index)
  }
  return output
}
