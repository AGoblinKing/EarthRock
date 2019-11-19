import { weaves } from "/weave/wheel.js"
import { derived, transformer } from "/util/store.js"

// Which weave is being woven
export const woven = transformer((weave_id) =>
  weaves.get()[weave_id]
, `sys`)

// Keep a positional spread of the active edited weave
export const spread = derived(woven, ($woven) => {

})
