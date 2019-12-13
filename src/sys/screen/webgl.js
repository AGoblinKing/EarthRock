import * as twgl from "twgl"
import { write } from "/util/store.js"
import { frame, tick } from "/sys/time.js"
import { sprite } from "/sys/shader.js"
import { camera, position, look } from "/sys/camera.js"

const { m4 } = twgl
const up = [0, 1, 0]
export default () => {
  const canvas = document.createElement(`canvas`)
  canvas.width = 16 * 100
  canvas.height = 16 * 100

  const gl = canvas.getContext(`webgl`)
  twgl.addExtensionsToContext(gl)
  const textures = twgl.createTextures(gl, {
    map: {
      src: `/sheets/default_2.png`,
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
  const set_random = (count, min = 0) => {
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
  const count = 8 * 8 * 8
  const pos_ordered = () => {
    const s = Math.cbrt(count)
    const arr = [...Array(count * 3)].fill(0)
    const half = s / 2

    for (let x = 0; x < s; x++) {
      for (let y = 0; y < s; y++) {
        for (let z = 0; z < s; z++) {
          for (let a = 0; a < s; a++) {
            const idx = (x + y * s + z * s * s + a * s * s * s) * 4
            arr[idx] = (x - half)
            arr[idx + 1] = (y - half)
            arr[idx + 2] = (z - half)
            arr[idx + 3] = 0.5
          }
        }
      }
    }
    return arr
  }

  const set_count = () => [...Array(count)]
    .map((_, idx) => idx)

  const verts = twgl.primitives.createXYQuadVertices(1)
  const buffer = {
    ...Object.fromEntries(Object.entries(verts).map(
      ([key, val]) => {
        val.divisor = 0
        return [key, val]
      }
    )),
    translate: {
      divisor: 1,
      data: pos_ordered(),
      numComponents: 4
    },
    sprite: {
      numComponents: 1,
      data: set_count(),
      divisor: 1
    },
    color: {
      numComponents: 4,
      data: set_random(4 * count),
      divisor: 1
    }
  }

  console.log(buffer)
  const snapshot = () => {
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
  canvas.cancel = frame.subscribe(([time, t]) => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const projection = twgl.m4.ortho(
      -10, 10, 10, -10, -100, 50
    )

    const c = camera.get()
    const $pos = position.get()

    m4.lookAt($pos, twgl.v3.add($pos, look.get()), up, c)
    m4.inverse(c, view)
    camera.set(c)
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
      u_sprite_size: 1,
      u_sprite_columns: 32,
      u_view_projection: view_projection
    }

    try {
      const buffer_info = twgl.createBufferInfoFromArrays(
        gl,
        buffer
      )

      const vertex_info = twgl.createVertexArrayInfo(gl, program_info, buffer_info)

      gl.useProgram(program_info.program)
      twgl.setBuffersAndAttributes(gl, program_info, vertex_info)
      twgl.setUniforms(program_info, u)

      twgl.drawObjectList(gl, [{
        programInfo: program_info,
        vertexArrayInfo: vertex_info,
        uniforms: u,
        instanceCount: count
      }])
    } catch (ex) {
      console.warn(`GPU ERROR ${ex}`)
    }
  })

  return canvas
}
