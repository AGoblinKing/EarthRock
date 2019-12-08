import * as twgl from "twgl"
import { read, transformer } from "/util/store.js"
import { frame } from "/sys/time.js"
import { sprite } from "/sys/shader.js"

const VALUE = () => ({
  square: read({
    position: read([
      -1, -1, 0,
      1, -1, 0,
      -1, 1, 0,
      -1, 1, 0,
      1, -1, 0,
      1, 1, 0
    ])
  })
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
  const textures = twgl.createTextures(gl, {
    map: {
      src: `/sheets/default.png`,
      mag: gl.NEAREST,
      min: gl.LINEAR
    }
  })

  const p_m = twgl.m4.perspective(
    60,
    canvas.width / canvas.height,
    0.01,
    2000
  )

  // move camera back
  twgl.m4.translate(p_m, [0, 0, 10], p_m)

  let buffer_data = {}

  const buffer_defaults = {
    position: read([0, 0, 0]),
    sprite: read([0]),
    color: read([1.0, 1, 1, 1.0])
  }

  const gpu = ({
    knot: read(`screen`),
    value: transformer((data) => {
      buffer_data = data
      return canvas
    }).set(value),

    toJSON: () => ({
      id,
      knot: gpu.knot.get()
    })
  })

  const program_info = twgl.createProgramInfo(
    gl,
    sprite.get()
  )

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  const snapshot = () => {
    const $value = buffer_data
    const buffer = {
      position: [],
      sprite: [],
      color: []
    }
    const uniforms = {}

    Object.entries($value).forEach(([
      key,
      chan
    ]) => {
      const $chan = chan.get()

      // tell us about the objects
      if (
        typeof $chan !== `object` ||
        Array.isArray($chan) ||
        $chan === null ||
        $chan === undefined
      ) {
        uniforms[`u_${key}`] = $chan
        return
      }

      // okay they're an object lets add buffer data for them
      Object.keys(buffer).forEach((key_buffer) => {
        const chan_buffer = $chan[key_buffer]

        // doesn't have the channel
        if (!chan_buffer || !chan_buffer.get || !chan_buffer.get()) {
          buffer[key_buffer].push(
            ...buffer_defaults[key_buffer].get()
          )
          return
        }

        buffer[key_buffer].push(...chan_buffer.get())
      })
    })

    return {
      buffer,
      uniforms
    }
  }

  // lifecycle on knot
  life(() => frame.subscribe(([, t]) => {
    if (program_info === null) return
    const { buffer, uniforms } = snapshot()

    const u = {
      ...uniforms,
      u_map: textures.map,
      u_time: t * 0.001,
      u_projection_matrix: p_m
    }

    try {
      const buffer_info = twgl.createBufferInfoFromArrays(
        gl,
        buffer
      )

      gl.useProgram(program_info.program)
      twgl.setBuffersAndAttributes(gl, program_info, buffer_info)
      twgl.setUniforms(program_info, u)
      twgl.drawBufferInfo(gl, buffer_info)
    } catch (ex) {
      console.warn(`GPU ERROR ${ex}`)
    }
  }))

  return gpu
}
