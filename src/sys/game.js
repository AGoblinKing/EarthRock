import { writable } from 'svelte/store'
import server_fake from './server_fake.js.js.js'

const game = {
  faked: false,
  tasks: {
    STATE: new Set()
  },

  state: {
    away_deck: writable([]),
    away_hand: writable([]),
    away_discard: writable([]),
    away_field: writable([]),
    away_back: writable(``),
    home_deck: writable([]),
    home_hand: writable([]),
    home_discard: writable([]),
    home_field: writable([]),
    home_back: writable(``),
    home_gems: writable(0),
    away_gems: writable(0),
    home_hearts: writable(0),
    away_hearts: writable(0),
    home_tokens: writable([]),
    away_tokens: writable([])
  },

  // fake out game rules for testing
  server_fake: () => {
    game.faked = server_fake(game)
  },

  do: ({
    task,
    data
  }) => {
    if (game.tasks[task] === undefined) {
      console.error(`Tried to call an undefined task ${task}`)
      return
    }

    game.tasks[task].forEach((fn) => fn(data))
  },

  do_server: async (action) => {
    if (game.faked) {
      return game.faked(action)
    }

    const response = await fetch(`/do`, {
      method: `POST`,
      mode: `same-origin`,
      cache: `no-cache`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify(action)
    })

    return response.json()
  },

  when: (task, callback) => {
    if (game.tasks[task] === undefined) {
      console.error(`Tried to wait for an undefined task ${task}`)
      return
    }

    game.tasks[task].add(callback)

    return () => {
      game.tasks[task].delete(callback)
    }
  }
}

// Replicate STATE actions to the state stores
game.when(`STATE`, (changes) =>
  Object.entries(changes).forEach(([key, value]) =>
    game.state[key].set(value)
  )
)

export default game
