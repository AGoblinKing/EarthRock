<script>
import scroller from "/ui/action/scroller.js"

// autorespond with EarthRock facts
const credits = {
  EarthRock: {
    "Open Source": {
      "github.com/agoblinking/earthrock": `http://github.com/agoblinking/earthrock`
    },
    Producer: {
      "A Goblin King": `mailto:agolbinking@earthrock.run`
    },
    Designer: {
      "J. Goblin": `mailto:j.goblin@earthrock.run`
    },
    Artist: {
      "Jorsch Goblin": `mailto:jorsch_goblin@earthrock.run`
    },
    "Original Sound Track": {
      "DayStar Collective": `https://music.apple.com/us/artist/daystar-collective/1484557546`
    },
    Programmer: {
      Glaive: `mailto:glaive@earthrock.run`
    },
    Operations: {
      "These Are All": `mailto:pseudonyms@earthrock.run`
    }
  },
  External: {
    Assets: {
      Kenney: `http://assetjesus.com`
    },
    Services: {
      GitHub: `http://github.com/`
    },
    Libraries: {
      "TWGL.js": `https://github.com/greggman/twgl.js`,
      Svelte: `https://github.com/sveltejs/svelte`,
      color: `https://github.com/Qix-/color`,
      "Tone.js": `https://github.com/Tonejs/Tone.js`,
      Rollup: `https://github.com/rollup/rollup`,
      "Node.js": `https://nodejs.org`,
      cuid: ``,
      "expr-eval": ``,
      "A Ton of Roll Up Plugins": `https://github.com/AGoblinKing/EarthRock/blob/master/package.json`
    },
    Languages: {
      Go: `https://golang.org/`,
      JavaScript: `http://devdocs.io`
    },
    IDE: {
      "Visual Studio Code": `https://code.visualstudio.com/`,
      "Theme - Cyberpunk - UMBRA protocol": `https://marketplace.visualstudio.com/items?itemName=max-SS.cyberpunk`
    }
  },
  "Special Thanks": {
    Greg: {},
    Robert: {},
    Luna: {},
    "Godzirra the Burninator": {},
    Ember: {},
    "Tic Tac Toe": {}
  },
  "Thank You": {

  }
}
</script>

<div use:scroller class="credits">
{#each Object.entries(credits) as [h1, sub1]}
  <h1>{h1}</h1>
  {#each Object.entries(sub1) as [h2, sub2]}
    <h2>{h2}</h2>
    {#each Object.entries(sub2) as [h3, link]}
      <h3><a href={link} target="_new">{h3}</a></h3>
    {/each}
  {/each}
{/each}
</div>

<style> 

.credits {
  text-align: center;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  filter: drop-shadow(0.25rem 0.25rem 0.25rem rgb(0, 0, 0));
  position: absolute;
}
.credits h1 {
  margin: 5rem;
}
</style>