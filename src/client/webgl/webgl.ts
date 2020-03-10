import * as twgl from "twgl.js"
import sprite_frag from "./shader/sprite.frag"
import sprite_vert from "./shader/sprite.vert"

import { Read, Store } from "src/store"

import { frame } from "src/sys/time"
import { camera, position, look } from "src/client/sys/camera"
import { SPRITES } from "src/client/sys/flag"

import { snapshot } from "./buffer"

const shader = new Read([
	sprite_vert,
	sprite_frag
])

const { m4 } = twgl
const up = [0, 1, 0]

export default () => {
	const smooth_position = {
		last: [0, 0, 0],
		next: [0, 0, 0],
		future: [0, 0, 0],

		update () {
			smooth_position.last = [...smooth_position.next]
			smooth_position.next = position.get()
		},

		get: (t) => {
			const v = twgl.v3.lerp(
				smooth_position.last,
				smooth_position.next,
				t
			)

			if (1 - t < 0.05) {
				smooth_position.update()
			}

			return v
		}
	}

	const canvas = document.createElement(`canvas`)

	canvas.width = 16 * 100
	canvas.height = 16 * 100

	const gl = twgl.getContext(canvas)
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
		shader.get()
	)

	if (!program_info) return
	canvas.snap = Store(snapshot(gl))

	const view = m4.identity()
	const view_projection = m4.identity()

	let vertex_info
	// lifecycle on warp

	const drawObjects = [{
		programInfo: program_info,
		vertexArrayInfo: vertex_info,
		uniforms: {},
		instanceCount: 0
	}]

	gl.enable(gl.DEPTH_TEST)
	gl.enable(gl.BLEND)
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
	gl.useProgram(program_info.program)

	canvas.cancel = frame.listen(([time, t]) => {
		const $clear_color = clear_color.get()
		gl.viewport(0, 0, canvas.width, canvas.height)
		gl.clearColor(...$clear_color.slice(0, 4))
		gl.clear(gl.COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT)

		const snap = snapshot(gl)
		if (snap.count < 1) return

		const r = canvas.width / canvas.height
		const projection = twgl.m4.ortho(-10 * r, 10 * r, 10, -10, -100, 50)
		const c = camera.get()
		const $pos = smooth_position.get(snap.time)

		m4.lookAt($pos, twgl.v3.add($pos, look.get()), up, c)
		m4.inverse(c, view)
		m4.multiply(projection, view, view_projection)

		// if (snap.dirty || !drawObjects[0].vertexArrayInfo) {
		drawObjects[0].vertexArrayInfo = twgl.createVertexArrayInfo(gl, program_info, snap.buffer_info)
		// }

		drawObjects[0].instanceCount = snap.count
		drawObjects[0].uniforms = {
			u_map: textures.map,
			u_time: snap.time,
			u_sprite_size: 16,
			u_sprite_columns: 32,
			u_view_projection: view_projection
		}

		twgl.drawObjectList(gl, drawObjects)
	})

	return canvas
}
