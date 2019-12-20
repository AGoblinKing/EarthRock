const random = (min, max) => min + Math.random() * (max - min)

export const set_random = (count, min = 0) => {
  const result = []
  for (let i = 0; i < count; i++) {
    if (i % 4 === 0) {
      result.push(1)
    } else {
      result.push(random(0, 0.5))
    }
  }
  return result
}

export const pos_ordered = (count) => {
  const s = Math.cbrt(count)
  const arr = [...Array(count * 3)]
  const half = s / 2

  for (let x = 0; x < s; x++) {
    for (let y = 0; y < s; y++) {
      for (let z = 0; z < s; z++) {
        const idx = (x + y * s + z * s * s) * 3
        arr[idx] = (x - half)
        arr[idx + 1] = (y - half) * 16
        arr[idx + 2] = (z - half)
      }
    }
  }

  return arr
}

export const set_count = (count) => [...Array(count)].map((_, idx) => idx)
