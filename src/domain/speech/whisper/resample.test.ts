import { describe, expect, it } from 'vitest'
import { downmix, resample } from './resample'

const values = (array: Float32Array) => Array.from(array, (v) => Math.round(v * 1000) / 1000)

describe('downmix', () => {
  it('averages the channels into mono', () => {
    expect(values(downmix([Float32Array.of(1, 0, 0.5), Float32Array.of(0, 1, 0.5)]))).toEqual([0.5, 0.5, 0.5])
  })

  it('passes a single channel through', () => {
    expect(values(downmix([Float32Array.of(0.25, -0.25)]))).toEqual([0.25, -0.25])
  })

  it('returns silence for no channels', () => {
    expect(downmix([])).toHaveLength(0)
  })
})

describe('resample', () => {
  it('copies the signal when the rates match', () => {
    const input = Float32Array.of(0.1, 0.2, 0.3)
    const output = resample(input, 16_000, 16_000)
    expect(values(output)).toEqual([0.1, 0.2, 0.3])
    expect(output).not.toBe(input)
  })

  it('downsamples by averaging each window (a cheap anti-aliasing filter)', () => {
    expect(values(resample(Float32Array.of(0, 0, 0, 3, 3, 3), 48_000, 16_000))).toEqual([0, 3])
    expect(values(resample(Float32Array.of(1, -1, 1, -1, 1, -1), 48_000, 16_000))).toEqual([0.333, -0.333])
  })

  it('keeps the duration for non-integer ratios', () => {
    const second = new Float32Array(44_100).fill(0.5)
    const output = resample(second, 44_100, 16_000)
    expect(output).toHaveLength(16_000)
    expect(output.every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true)
  })

  it('upsamples by linear interpolation', () => {
    expect(values(resample(Float32Array.of(0, 1), 8_000, 16_000))).toEqual([0, 0.5, 1, 1])
  })

  it('handles empty input', () => {
    expect(resample(new Float32Array(0), 48_000, 16_000)).toHaveLength(0)
  })
})
