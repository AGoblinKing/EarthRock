import * as twgl from "twgl"
import { TIME_TICK_RATE } from "/sys/flag.js"
import { tick } from "/sys/time.js"

const blank = () => ({
  position: [],
  sprite: [],
  scale: [],
  translate_last: [],
  scale_last: []
})

const defaults = Object.entries({
  position: [0, 0, 0],
  sprite: [335],
  scale: [1]
})

const verts = twgl.primitives.createXYQuadVertices(1)

let count = 0

const buffer = {
  ...Object.fromEntries(Object.entries(verts).map(
    ([key, val]) => {
      val.divisor = 0
      return [key, val]
    }
  )),
  translate_last: {
    divisor: 1,
    data: [],
    numComponents: 3
  },
  translate: {
    divisor: 1,
    data: [],
    numComponents: 3
  },
  sprite: {
    numComponents: 1,
    data: [],
    divisor: 1
  },
  scale: {
    numComponents: 1,
    data: [],
    divisor: 1
  },
  scale_last: {
    numComponents: 1,
    data: [],
    divisor: 1
  }
}

const translate_last = {}
const scale_last = {}

let last_snap = Date.now()

export const snapshot = () => ({
  count,
  buffer,
  time: (Date.now() - last_snap) / TIME_TICK_RATE.get()
})

// RAF so it happens at end of frame
tick.listen(() => requestAnimationFrame(() => {
  const buffs = blank()
  const running = Wheel.running.get()

  Object.values(Wheel.weaves.get()).forEach((weave) => {
    if (!running[weave.name.get()]) return

    Object.keys(weave.rezed.get()).forEach((id) => {
      const knot = weave.get_id(id)

      // wtf a nonstitch is rezed
      if (knot.knot.get() !== `stitch`) {
        console.warn(`non stitch rezed`, weave, knot)
        return
      }
      const vs = knot.value.get()

      defaults.forEach(([key, def]) => {
        if (!vs[key]) {
          return buffs[key].push(...def)
        }

        let value = vs[key].get()

        if (typeof value === `number`) {
          value = [value]
        }

        if (!Array.isArray(value)) {
          return buffs[key].push(...def)
        }

        const result = []
        for (let i = 0; i < def.length; i++) {
          if (typeof value[i] !== `number` || i >= value.length) {
            result.push(def[i])
            return
          }
          result.push(value[i])
        }

        buffs[key].push(...result)
      })

      const t_last = translate_last[id] || buffs.position.slice(-3)
      translate_last[id] = buffs.position.slice(-3)
      buffs.translate_last.push(...t_last)

      const s_last = scale_last[id] || buffs.scale.slice(-1)
      scale_last[id] = buffs.scale.slice(-1)
      buffs.scale_last.push(s_last)
    })
  })

  Object.entries(buffs).forEach(([key, buff]) => {
    if (key === `position`) {
      buffer.translate.data = buff
      return
    }
    buffer[key].data = buff
  })

  count = buffer.sprite.data.length
  last_snap = Date.now()
}))
