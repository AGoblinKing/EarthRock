import * as twgl from "twgl.js"
import { read, transformer } from "/util/store.js"
import { frame } from "/sys/time.js"
import { trippy } from "/sys/shader.js"

export default ({
  value = {
    position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]
  },
  id,
  life
}) => {
  const canvas = document.createElement(`canvas`)
  canvas.width = 100
  canvas.height = 100
  const gl = canvas.getContext(`webgl`)

  const program_info = twgl.createProgramInfo(gl, trippy.get())

  let arrays_last

  let buffer

  const gpu = ({
    knot: read(`screen`),

    value: transformer((arrays) => {
      arrays_last = arrays
      try {
        buffer = twgl.createAttribsFromArrays(gl, arrays)
      } catch (ex) {
        console.error(ex)
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
      value: arrays_last,
      shader: gpu.shader.get()
    })
  })

  const arrays = {
    position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]
  }
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

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
    twgl.setBuffersAndAttributes(gl, program_info, bufferInfo)
    twgl.setUniforms(program_info, uniforms)
    twgl.drawBufferInfo(gl, bufferInfo)
  }))

  return gpu
}
