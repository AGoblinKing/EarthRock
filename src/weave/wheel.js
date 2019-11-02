// Should run off the compiled out JSON from weave
import Weave from './weave.js'

export default () => {
  const weaves = new Map()

  const wheel = {
    load: (weave_json) => {
      const weave = Weave(weave_json)

      weaves.set(weave.id, weave)
      return weave
    },
    start: (weave_id) => {
      if (!weaves.has(weave_id)) return
    }
  }

  return wheel
}
