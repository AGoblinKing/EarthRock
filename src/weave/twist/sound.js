import { extend } from "/object.js"
import scribble from "scribbletune"
import Tone from "tone"

export default extend({
	play () {
		this.clip = scribble.clip({
			synth: `PolySynth`,
			pattern: `[xx][xR]`.repeat(4),
			notes: scribble.arp({
				chords: `Dm BbM Am FM BbM FM CM Gm`,
				count: 8,
				order: 1022
			}),
			accent: `x-xx--xx`
		})

		this.clip.start()
		Tone.Transport.start()
	},

	stop () {
		if (this.clip) this.clip.stop()
	},

	rez () {
		let first = false
		this.cancel = this.value.listen(($song) => {
			if (!first) {
				first = true
				return
			}
			// construct $sound from data and then play it
			this.stop()
			this.play()
		})
	},

	derez () {
		this.cancel()
	}
})
