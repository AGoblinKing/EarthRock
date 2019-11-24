import * as twgl from "twgl.js"
import { read, transformer } from "/util/store.js"
import { frame } from "/sys/time.js"
import { trippy } from "/sys/shader.js"

const VALUE = () => ({
  position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]
})
export default ({
  value = VALUE(),
  id,
  life,
  weave
}) => {
  const canvas = document.createElement(`canvas`)
  canvas.width = 100
  canvas.height = 100
  const gl = canvas.getContext(`webgl`)

  let arrays_last

  const buffer = transformer((arrays) => {
    let b = buffer.get()
    try {
      b = twgl.createAttribsFromArrays(gl, arrays)
      arrays_last = arrays
    } catch (ex) {
      console.error(`${id} SCREEN: Unable to create gpu attributes`)
    }

    return b
  })

  buffer.set(VALUE())

  const gpu = ({
    knot: read(`screen`),

    value: transformer(({
      flock = VALUE(),
      ...rest
    }) => {
      buffer.set(flock)

      // lets return the canvas right now
      // can be serialized into a data array but GPU nodes
      // shouldn't serialize their value result
      // but their value input
      return canvas
    }).set(value),

    toJSON: () => ({
      id,
      knot: gpu.knot.get(),
      value: arrays_last,
      shader: gpu.shader.get()
    })
  })

  const program_info = twgl.createProgramInfo(gl, trippy.get())

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  const $buffer = twgl.createAttribsFromArrays(gl, VALUE())

  // lifecycle on knot
  life(() => frame.subscribe(([, t]) => {
    const uniforms = {
      time: t * 0.001,
      resolution: [gl.canvas.width, gl.canvas.height]
    }

    if (program_info === null) {
      return
    }

    gl.useProgram(program_info.program)
    twgl.setBuffersAndAttributes(gl, program_info, $buffer)
    twgl.setUniforms(program_info, uniforms)
    twgl.drawBufferInfo(gl, $buffer)
  }))

  return gpu
}
