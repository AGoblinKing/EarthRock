const str_color = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  let color = `#`
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF
    color += (`00` + value.toString(16)).substr(-2)
  }
  return color
}

export const color = str_color

// whiskers on kittens
const words = [
  `groovy`, `cat`, `bird`, `dog`, `poop`, `cool`, `not`, `okay`, `great`, `terrible`, `wat`,
  `goblin`, `life`, `ferret`, `gregert`, `robert`, `zilla`, `red`, `shirt`, `pants`, `blue`,
  `luna`, `ember`, `embear`, `lunatic`, `boring`, `killa`, `notice`, `thank`, `tank`,
  `under`, `near`, `near`, `quaint`, `potato`, `egg`, `bacon`, `narwhal`, `lamp`, `stairs`, `king`,
  `tyrant`, `grave`, `dire`, `happy`, `amazing`, `terrific`, `terrible`, `good`, `boring`,
  `rip`, `hello`, `world`, `global`, `universal`, `television`, `computer`
]

export const random = (count) => Array
  .from(new Array(count))
  .map(() => words[Math.floor(Math.random() * words.length)])
  .join(` `)
