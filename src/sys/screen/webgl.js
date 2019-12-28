import * as twgl from "twgl"
import Color from "color"

import { write } from "/util/store.js"
import { frame, tick } from "/sys/time.js"
import { sprite } from "/sys/shader.js"
import { camera, position, look } from "/sys/camera.js"
import { SPRITES, CLEAR_COLOR } from "/sys/flag.js"

import { snapshot } from "./buffer.js"

let clear_color = [0, 0, 0, 1]

CLEAR_COLOR.listen((txt) => {
	const { red, green, blue } = Color(txt).toRGB()
	clear_color = [red, green, blue, 1]
})

const { m4 } = twgl
const up = [0, 1, 0]

const smooth_position = {
	last: [0, 0, 0],
	next: [0, 0, 0],
	get: (t) =>
		twgl.v3.lerp(
			smooth_position.last,
			smooth_position.next,
			t
		)
}

tick.listen(() => {
	smooth_position.last = smooth_position.next
	smooth_position.next = position.get()
})

export default () => {
	const canvas = document.createElement(`canvas`)

	canvas.width = 16 * 100
	canvas.height = 16 * 100

	const gl = canvas.getContext(`webgl`, { alpha: false })
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

	canvas.snap = write(snapshot())

	const view = m4.identity()
	const view_projection = m4.identity()

	// lifecycle on knot
	canvas.cancel = frame.listen(([time, t]) => {
		const snap = snapshot()

		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

		// see what these are about
		gl.enable(gl.DEPTH_TEST)
		gl.enable(gl.BLEND)
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
		const r = canvas.width / canvas.height

		const projection = twgl.m4.ortho(
			-10 * r, 10 * r, 10, -10, -100, 50
		)

		const c = camera.get()
		const $pos = smooth_position.get(snap.time)

		m4.lookAt($pos, twgl.v3.add($pos, look.get()), up, c)
		m4.inverse(c, view)

		m4.multiply(projection, view, view_projection)

		gl.clearColor(...clear_color)
		gl.clear(gl.COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)

		if (snap.count < 1) {
			return
		}

		const u = {
			u_map: textures.map,
			u_time: snap.time,
			u_sprite_size: 16,
			u_sprite_columns: 32,
			u_view_projection: view_projection
		}

		try {
			const buffer_info = twgl.createBufferInfoFromArrays(
				gl,
				snap.buffer
			)

			const vertex_info = twgl.createVertexArrayInfo(gl, program_info, buffer_info)

			gl.useProgram(program_info.program)
			twgl.setBuffersAndAttributes(gl, program_info, vertex_info)
			twgl.setUniforms(program_info, u)

			twgl.drawObjectList(gl, [{
				programInfo: program_info,
				vertexArrayInfo: vertex_info,
				uniforms: u,
				instanceCount: snap.count
			}])
		} catch (ex) {
			console.warn(`GPU ERROR ${ex}`)
		}
	})

	return canvas
}
