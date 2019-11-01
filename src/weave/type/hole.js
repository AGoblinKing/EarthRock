import uuid from "uuid/v4"
import { random } from "/util/text.js"

import { writable } from "svelte/store"

export default ({
  id = `/${uuid()}`,
  value = random(2),
  value_overwrite = false,
  type = ` `,
  name = random(2),
  ...junk
} = false) => ({
  ...junk,
  id: id[0] === `/` ? id : `/${id}`,
  name: writable(name),
  type,
  value: value_overwrite ? value : writable(value)
})
