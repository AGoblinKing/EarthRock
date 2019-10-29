import Tone from "tone"
import { SOUND_ON } from "./flags.js"

if (!SOUND_ON) {
  Tone.Master.mute = true
}

Tone.Master.volume.value = -10

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

let wind_noise
export const wind_on = () => {
  if (wind_noise) {
    wind_noise.stop()
  }
  wind_noise = new Tone.Noise(`brown`).connect(filter).start()
}

export const wind_off = () => {
  if (wind_noise) {
    wind_noise.stop()
    wind_noise = false

    pluck()
  }
}
