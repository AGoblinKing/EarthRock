import * as twgl from "twgl"
import { write } from "/util/store.js"
import { frame } from "/sys/time.js"
import { sprite } from "/sys/shader.js"
import { camera } from "/sys/camera.js"

const { m4 } = twgl

export default () => {
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

  const buffer_defaults = {
    position: [-2, 3, 1],
    sprite: [66],
    color: [1.0, 1, 1, 1.0]
  }

  const program_info = twgl.createProgramInfo(
    gl,
    sprite.get()
  )

  const random = (min, max) => min + Math.random() * (max - min)
  const set_random = (count) => {
    const result = []
    for (let i = 0; i < count; i++) {
      result.push(random(-100, 100))
    }
    return result
  }
  const count = 50
  const snapshot = () => {
    const buffer = {
      position: set_random(3 * count),
      sprite: {
        numComponents: 1,
        data: set_random(count)
      },
      color: set_random(4 * count)
    }

    const uniforms = {}

    return {
      buffer,
      uniforms
    }
  }

  canvas.snap = write(snapshot())

  const color_clear = [0, 0, 0, 0]
  const view = m4.identity()
  const view_projection = m4.identity()

  // lifecycle on knot
  canvas.cancel = frame.subscribe(([, t]) => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(color_clear[0], color_clear[1], color_clear[2], color_clear[3])
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    const projection = twgl.m4.perspective(
      30 * Math.PI / 180,
      gl.canvas.width / gl.canvas.height,
      0.01,
      2000
    )

    m4.inverse(camera.get(), view)
    m4.multiply(projection, view, view_projection)

    const { buffer, uniforms } = snapshot()
    canvas.snap.set({
      buffer,
      uniforms
    })

    const u = {
      ...uniforms,
      u_map: textures.map,
      u_time: t * 0.001,
      u_view_projection: view_projection
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
  })

  return canvas
}
