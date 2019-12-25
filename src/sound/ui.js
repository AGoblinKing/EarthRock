import Tone from "tone"

import { position } from "../sys/mouse.js"

const player = ({
	instrument,
	pattern = []
}) => () => {
	Tone.context.resume()

	const [note, duration] = pattern
	instrument.triggerAttackRelease(note, duration)
}

export const test = player({
	instrument: new Tone.Synth().toMaster(),
	pattern: [`C2`, `8n`]
})

export const person = player({
	instrument: new Tone.Synth().toMaster(),
	pattern: [`F2`, `16n`]
})

export const button = player({
	instrument: new Tone.Synth().toMaster(),
	pattern: [`C3`, `8n`]
})

export const button_press = player({
	instrument: new Tone.Synth().toMaster(),
	pattern: [`A3`, `8n`]
})

export const card = player({
	instrument: new Tone.MembraneSynth().toMaster(),
	pattern: [`D1`, `16n`]
})

export const pluck = player({
	instrument: new Tone.PluckSynth().toMaster(),
	pattern: [`C5`, `2n`]
})

const filter = new Tone.Filter({
	type: `bandpass`,
	Q: 12
}).toMaster()

const wind_noise = new Tone.Noise(`pink`).connect(filter)

const notes = [`A2`, `B2`, `C2`, `D6`, `E6`, `F6`, `G6`].reverse()
let last_note

position.subscribe(([_, y]) => {
	const yn = Math.floor(y / window.innerHeight * 7)
	if (last_note === notes[yn] || yn < 0 || yn > notes.length - 1) {
		return
	}
	last_note = notes[yn]
	filter.frequency.linearRampToValueAtTime(`${notes[yn]}`, Tone.context.currentTime)
})

export const wind_on = () => {
	wind_noise.start()
}

export const wind_off = () => {
	wind_noise.stop()
	pluck()
}
