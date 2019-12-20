import * as twgl from "twgl"
import { write } from "/util/store.js"
import { frame } from "/sys/time.js"
import { sprite } from "/sys/shader.js"
import { camera, position, look } from "/sys/camera.js"
import { SPRITES } from "/sys/flag.js"

const { m4 } = twgl
const up = [0, 1, 0]

const BUFFER_DEFAULTS = {
  position: [-2, 3, 1],
  sprite: [66],
  scale: [1]
}

export default () => {
  const canvas = document.createElement(`canvas`)
  canvas.width = 16 * 100
  canvas.height = 16 * 100

  const gl = canvas.getContext(`webgl`)
  twgl.addExtensionsToContext(gl)

  const textures = twgl.createTextures(gl, {
    map: {
      src: SPRITES.get(),
      mag: gl.NEAREST,
      min: gl.LINEAR
    }
  })

  const program_info = twgl.createProgramInfo(
    gl,
    sprite.get()
  )

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
    }
  }

  const snapshot = () => {
    return {
      count: 0,
      buffer
    }
  }

  canvas.snap = write(snapshot())

  const view = m4.identity()
  const view_projection = m4.identity()

  // lifecycle on knot
  canvas.cancel = frame.subscribe(([time, t]) => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    // see what these are about
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

    const { buffer, count } = snapshot()

    canvas.snap.set({
      buffer,
      count
    })

    const u = {
      u_map: textures.map,
      u_time: t * 0.001,
      u_sprite_size: 16,
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
