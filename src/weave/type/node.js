import uuid from "uuid/v4"

import { writable } from "svelte/store"

export default ({
  id = `/${uuid()}`,
  write = ,
  read = 
  ...junk
} = false) => writable({
  ...junk,
  id: id[0] === `/` ? id : `/${id}`
})
