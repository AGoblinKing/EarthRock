import * as twgl from "twgl"
import { read, transformer, write } from "/util/store.js"
import { frame } from "/sys/time.js"
import { test } from "/sys/shader.js"

const VALUE = () => ({
  position: [
    -1, -1, 0,
    1, -1, 0,
    -1, 1, 0,
    -1, 1, 0,
    1, -1, 0,
    1, 1, 0
  ]
})

export default ({
  value = {
    flock: VALUE()
  },
  id,
  life,
  weave
}) => {
  const canvas = document.createElement(`canvas`)
  canvas.width = 100
  canvas.height = 100
  const gl = canvas.getContext(`webgl`)

  let arrays_last

  const buffer = write()
  const buffer_set = buffer.set

  buffer.set = (arrays) => {
    try {
      const b = twgl.createBufferInfoFromArrays(gl, arrays)
      arrays_last = arrays
      buffer_set(b)
    } catch (ex) {
      console.error(`${id} SCREEN: Unable to create gpu attributes`)
    }
  }

  const gpu = ({
    knot: read(`screen`),

    value: transformer(({
      flock,
      ...rest
    }) => {
      if (flock) {
        buffer.set(flock)
        console.log(buffer.get())
      }

      // lets return the canvas right now
      // can be serialized into a data array but GPU nodes
      // shouldn't serialize their value result
      // but their value input
      return canvas
    }).set(value),

    toJSON: () => ({
      id,
      knot: gpu.knot.get(),
      value: arrays_last
    })
  })

  const program_info = twgl.createProgramInfo(
    gl,
    test.get()
  )

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  // lifecycle on knot
  life(() => frame.subscribe(([, t]) => {
    const $buffer = buffer.get()

    if (!$buffer || program_info === null) return

    const uniforms = {
      time: t * 0.001,
      resolution: [
        gl.canvas.width,
        gl.canvas.height
      ]
    }

    gl.useProgram(program_info.program)
    twgl.setBuffersAndAttributes(gl, program_info, $buffer)
    twgl.setUniforms(program_info, uniforms)
    twgl.drawBufferInfo(gl, $buffer)
  }))

  return gpu
}
