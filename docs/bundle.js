var app = (function (Color, uuid, expr, twgl, exif) {
  'use strict';

  Color = Color && Color.hasOwnProperty('default') ? Color['default'] : Color;
  uuid = uuid && uuid.hasOwnProperty('default') ? uuid['default'] : uuid;
  expr = expr && expr.hasOwnProperty('default') ? expr['default'] : expr;
  exif = exif && exif.hasOwnProperty('default') ? exif['default'] : exif;

  const writable = (val) => {
    const subs = new Set();

    const w = {
      get: () => val,
      poke: () => {
        w.set(w.get());
        return w
      },
      set: (val_new) => {
        val = val_new === undefined
          ? null
          : val_new;

        subs.forEach((fn) => fn(val));
        return w
      },
      update: (fn) => {
        w.set(fn(val));
        return w
      },
      subscribe: (fn) => {
        subs.add(fn);
        fn(val);
        return () => subs.delete(fn)
      }
    };

    w.toJSON = w.get;
    w.listen = w.subscribe;

    return w
  };

  const readable = (val, handler) => {
    const w = writable(val);
    const { set } = w;
    w.set = () => console.warn(`tried to write to readable`);
    w.readonly = true;
    if (handler) handler(set);
    return w
  };

  const write = (thing) => writable(thing);
  const read = (thing, handler) => readable(thing, handler);

  const transformer = (transform) => {
    const store = write();

    const set = store.set;
    store.set = (update) => {
      set(transform(update));
      return store
    };

    return store
  };

  const map = (init = {}) => {
    const m = write();
    const set_m = m.set;

    m.set = (data) => set_m(Object.fromEntries(
      Object.entries(data)
        .map(([key, val]) => [
          key,
          (val && typeof val.subscribe === `function`)
            ? val
            : write(val)
        ])
    ));

    m.add = (channels) => {
      m.set({
        ...m.get(),
        ...channels
      });
    };

    m.remove = (channel) => {
      const $m = m.get();
      delete $m[channel];
      set_m($m);
    };

    m.set(init);

    return m
  };

  const derived = (stores, fn) => readable(undefined, (set) => {
    stores = Array.isArray(stores)
      ? stores
      : [stores];

    const cancels = stores.map(
      (store) =>
        store.listen(() =>
          set(fn(stores.map((s) => s.get())))
        )
    );
  });

  const SPRITES = read(`/sheets/default_2.png`);

  const IS_DEV = read(window.location.host === `localhost:5000`);
  const SOUND_ON = write(false);

  const SVELTE_ANIMATION = write({ delay: 100, duration: 300 });

  const TIME_TICK_RATE = write(100);

  const WEAVE_EXPLORE_OPEN = write(true);

  const INPUT_SCROLL_STRENGTH = write(10);
  const INPUT_ZOOM_STRENGTH = write(0.01);
  const INPUT_ZOOM_MIN = write(0.1);

  const TILE_COUNT = read(1024);
  const TILE_COLUMNS = read(32);

  const THEME_COLOR = write(`rgb(224, 168, 83)`);
  const THEME_BG = write(`#033`);
  const THEME_GLOW = write(`green`);

  const THEME_BORDER = read(``, (set) =>
    THEME_BG.listen(($THEME_BG) => set(Color($THEME_BG)
      .darkenByRatio(0.5)
      .toCSS()
    ))
  );
  const THEME_STYLE = read(``, (set) => {
    let $THEME_BORDER = ``;

    const update = () => set([
      `border: 0.25rem solid ${$THEME_BORDER};`
    ].join(``));

    THEME_BORDER.listen(($val) => {
      $THEME_BORDER = $val;
      update();
    });
  });

  var flag = /*#__PURE__*/Object.freeze({
    __proto__: null,
    SPRITES: SPRITES,
    IS_DEV: IS_DEV,
    SOUND_ON: SOUND_ON,
    SVELTE_ANIMATION: SVELTE_ANIMATION,
    TIME_TICK_RATE: TIME_TICK_RATE,
    WEAVE_EXPLORE_OPEN: WEAVE_EXPLORE_OPEN,
    INPUT_SCROLL_STRENGTH: INPUT_SCROLL_STRENGTH,
    INPUT_ZOOM_STRENGTH: INPUT_ZOOM_STRENGTH,
    INPUT_ZOOM_MIN: INPUT_ZOOM_MIN,
    TILE_COUNT: TILE_COUNT,
    TILE_COLUMNS: TILE_COLUMNS,
    THEME_COLOR: THEME_COLOR,
    THEME_BG: THEME_BG,
    THEME_GLOW: THEME_GLOW,
    THEME_BORDER: THEME_BORDER,
    THEME_STYLE: THEME_STYLE
  });

  const str_color = (str) => {
    if (!str) return `#111`

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    let color = `#`;
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += (`00` + value.toString(16)).substr(-2);
    }
    return color
  };

  const color = str_color;

  // whiskers on kittens
  const words = [
    `groovy`, `cat`, `bird`, `dog`, `poop`, `cool`, `not`, `okay`, `great`, `terrible`, `wat`,
    `goblin`, `life`, `ferret`, `gregert`, `robert`, `zilla`, `red`, `shirt`, `pants`, `blue`,
    `luna`, `ember`, `embear`, `lunatic`, `boring`, `killa`, `notice`, `thank`, `tank`,
    `under`, `near`, `near`, `quaint`, `potato`, `egg`, `bacon`, `narwhal`, `lamp`, `stairs`, `king`,
    `tyrant`, `grave`, `dire`, `happy`, `amazing`, `terrific`, `terrible`, `good`, `boring`,
    `rip`, `hello`, `world`, `global`, `universal`, `television`, `computer`
  ];

  const tile = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return `${Math.abs(hash) % TILE_COUNT.get()}`
  };

  const random = (count) => Array
    .from(new Array(count))
    .map(() => words[Math.floor(Math.random() * words.length)])
    .join(` `);

  var stitch = ({
    value = {},
    name = random(2),
    weave
  }) => ({
    knot: read(`stitch`),

    value: map(value),

    name: transformer((name_new) => {
      // tell weave it update its knots
      // probably should be on a channel instead
      weave && weave.knots && weave.knots.poke();
      return name_new
    }).set(name)
  });

  var stream = ({
    value = null
  }) => {
    const v = write();
    const set = v.set;

    v.set = (val) => {
      try {
        set(JSON.parse(val));
      } catch (ex) {
        set(val);
      }
    };
    v.set(value);
    return ({
      knot: read(`stream`),
      value: v
    })
  };

  var sprite = ({
    value = 66
  }) => ({
    knot: read(`sprite`),
    value: write(value)
  });

  twgl.v3.setDefaultType(Array);

  const parser = new expr.Parser({
    in: true,
    assignment: true
  });

  parser.functions.stop = function () {
    throw new Error(`math stop`)
  };

  Object.entries(twgl.v3).forEach(([key, fn]) => {
    parser.functions[`v3_${key}`] = function (...args) {
      return fn(...args)
    };
  });

  Object.entries(twgl.m4).forEach(([key, fn]) => {
    parser.functions[`m4_${key}`] = function (...args) {
      return fn(...args)
    };
  });

  const math = (formula) => {
    const p = parser.parse(formula);

    return (variables) => p.evaluate(variables)
  };

  const whitespace = /[ .~]/g;

  const escape = (str) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`); // $& means the whole matched string

  const re_var = /\//g;

  var math$1 = ({
    math: math$1 = `2+2`,
    value,
    weave,
    life,
    id
  } = false) => {
    let math_fn = () => {};

    const values = write({});

    const math_run = (expression) => requestAnimationFrame(() => {
      const matches = expression.match(Wheel.REG_ID);
      const vs = {};
      const leaf = weave.chain(id, true).shift();
      const s = weave.to_address(leaf);

      new Set(matches).forEach((item) => {
        const shh = item[0] === `$`;
        const gette = item
          .replace(`./`, `${s}/`)
          .replace(`~/`, `/${weave.name.get()}/`)
          .replace(`$`, ``)
          .trim();

        const k = Wheel.get(gette);
        const name = gette.replace(whitespace, ``).replace(re_var, ``);
        expression = expression.replace(
          new RegExp(escape(item), `g`),
          name
        );

        if (!k) {
          vs[name] = {
            k: {
              toJSON: () => null
            },
            shh: true
          };
          return
        }

        vs[name] = {
          k,
          shh
        };
      });

      // also wtf dont recompile expression each time
      try {
        math_fn = math(expression);
        values.set(vs);
      } catch (ex) {
        return console.warn(`MATH`, ex)
      }
    });

    const m = ({
      knot: read(`math`),
      math: transformer((expression) => {
        math_run(expression);
        return expression
      }),
      value: write(value)
    });

    const set = m.value.set;
    m.value.set = (val) => {
      const vs = values.get();
      val = val === undefined
        ? null
        : val;

      try {
        const result = math_fn({
          ...Object.fromEntries(Object.entries(vs).map(
            ([key, { k }]) => [key, k.toJSON() === undefined
              ? null
              : k.toJSON()
            ]
          )),
          v: val
        });
        set(result);
        return m.value
      } catch (ex) {

      }
    };
    m.math.set(math$1);

    life(() => {
      math_run(m.math.get());
      const cancels = new Set();
      //
      const cancel_vs = values.listen((vs) => {
        cancels.forEach((cancel) => cancel());
        cancels.clear();

        Object.entries(vs).forEach(([key, { k, shh }]) => {
          if (shh) return

          cancels.add(k.listen(m.value.poke));
        });
      });

      return () => {
        cancel_vs();
        cancels.forEach((cancel) => cancel());
      }
    });

    return m
  };

  // instead use the weave messaging channel
  var mail = ({
    whom = `/sys/mouse/position`,
    weave,
    id,
    life
  }) => {
    const value = write();
    const { set } = value;

    const fix = (address) => address
      .replace(`$`, ``)
      .replace(`~`, `/${weave.name.get()}`)
      .replace(`.`, weave.to_address(weave.chain(id, true).shift()));

    // when set hit up the remote
    value.set = (value_new) => {
      const $whom = fix(m.whom.get());

      const v = Wheel.get($whom);

      if (!v || !v.set) {
        return
      }

      v.set(value_new);

      set(value_new);
    };

    // Subscribe to remote
    const m = ({
      knot: read(`mail`),
      whom: write(whom),
      value,
      set
    });

    life(() => {
      const cancels = new Set();
      const clear = () => {
        cancels.forEach((fn) => fn());
        cancels.clear();
      };

      const cancel_whom = m.whom.listen(($whom) => {
        clear();

        $whom = $whom
          .replace(`.`, weave.to_address(weave.chain(id, true).shift()))
          .replace(`~`, weave.name.get());

        if ($whom[0] === `$`) {
          $whom = $whom.replace(`$`, ``);
          const thing = Wheel.get($whom);
          if (!thing) return set(null)

          set(thing.get());
          return
        }

        let thing = Wheel.get($whom);
        if (!thing) return set(null)
        thing = thing.value
          ? thing.value
          : thing;

        cancels.add(thing.listen(($thing) => {
          set($thing);
        }));
      });

      return () => {
        cancel_whom();
        clear();
      }
    });
    return m
  };



  var knots = /*#__PURE__*/Object.freeze({
    __proto__: null,
    stitch: stitch,
    stream: stream,
    sprite: sprite,
    math: math$1,
    mail: mail
  });

  // the basic knot
  var Knot = ({
    id = uuid(),
    knot,

    ...rest
  } = false) => {
    const k = {
      ...(knots[knot]
        ? knots[knot]({
          ...rest,
          id
        })
        : { knot: read(knot) }
      ),

      id: read(id),
      toJSON: () => k
    };
    return k
  };

  // Weave of holes connected with threads
  var Weave = ({
    name = random(2),
    id = uuid(),
    knots = {},
    threads = {},
    rezed = {}
  } = false) => {
    const exists = (id) => {
      const [knot, channel] = id.split(`/`);

      const k = w.knots.get()[knot];
      if (!k) return false
      if (channel === undefined) return true

      return Object.keys(k.value.get()).indexOf(channel) !== -1
    };
    const w = {
      id: read(id),
      name: write(name),
      threads: write(threads),
      lives: write([]),
      rezed: write(rezed),

      validate: () => {
        let dirty = false;
        let deletes = 0;
        const t = w.threads.get();
        const ks = w.knots.get();

        Object.values(ks).forEach((k) => {
          if (k.knot.get() === `stitch`) return

          const chain = w.chain(k.id.get(), true);
          const last = chain[chain.length - 1].split(`/`)[0];
          const first = chain[0].split(`/`)[0];
          const k_last = ks[last];
          const k_first = ks[first];

          if ((k_last && k_last.knot.get() === `stitch`) ||
            (k_first && k_first.knot.get() === `stitch`)
          ) return

          delete ks[k.id.get()];
          deletes += 1;
        });

        if (deletes > 0) {
          console.warn(`Deleted ${deletes} orphans on validation.`);
          w.knots.set(ks);
        }

        Object.entries(t).forEach(([r, w]) => {
          if (exists(r) && exists(w)) return

          dirty = true;
          delete (t[r]);
        });

        if (!dirty) return

        w.threads.set(t);
      },

      chain: (address, right = false) => {
        const other = right
          ? w.threads.get()[address]
          : w.threads_r.get()[address];

        if (!other) return [address]
        return [...w.chain(other, right), address]
      },

      toJSON: () => {
        const {
          id,
          knot,
          name,
          threads,
          knots,
          rezed
        } = w;

        return JSON.parse(JSON.stringify({
          id,
          knot,
          name,
          threads,
          knots,
          rezed
        }))
      }
    };

    const life_set = w.lives.set;

    w.lives.set = undefined;
    const life_add = (life) => life_set([
      ...w.lives.get(),
      life
    ]);

    w.threads_r = read({}, (set) => {
      w.threads.listen(($threads) => {
        set(Object.fromEntries(Object.entries($threads).map(
          (item) => item.reverse()
        )));
      });
    });

    w.get_id = (id) => w.knots.get()[id];
    w.to_address = (id_path) => {
      const [knot] = id_path.split(`/`);

      const k = w.get_id(knot);
      if (!k || !k.name) return `/sys/void`

      return `/${w.name.get()}/${k.name.get()}`
    };

    w.get_name = (name) => {
      const k = w.names.get()[name];
      if (!k) return

      return k
    };

    w.remove_name = (name) => {
      const k = w.get_name(name);
      if (!k) return

      const id = k.id.get();
      return w.remove(id)
    };

    w.remove = (id) => {
      const k = w.knots.get()[id];
      if (!k) return

      const $t = w.threads.get();
      const t_o = $t[id];
      const t_me = w.threads_r.get()[id];
      if (t_o) {
        delete $t[id];
        w.threads.set($t);
      }
      if (t_me) {
        delete $t[t_me];
        w.threads.set($t);
      }
      w.knots.update(($knots) => {
        delete $knots[id];

        return $knots
      });
    };
    w.add = (properties) => {
      const k = Knot({
        ...properties,
        weave: w,
        life: life_add
      });

      w.knots.update(($knots) => {
        $knots[k.id.get()] = k;
        return $knots
      });

      return k
    };

    w.knots = write(Object
      .entries(knots)
      .reduce((res, [knot_id, val]) => {
        if (val.id !== knot_id) {
          val.id = knot_id;
        }

        res[knot_id] = Knot({
          ...val,
          weave: w,
          life: life_add
        });

        return res
      }, {})
    );

    // index by name, uniqueness not guaranteed
    // Stitches only right now
    w.names = derived(w.knots, ([$knots]) => Object.fromEntries(
      Object.values($knots)
        .filter(({ knot }) => knot.get() === `stitch`)
        .map(
          (knot) => [
            knot.name.get(),
            knot
          ]
        )
    ));

    w.update = (structure) => {
      const $names = w.names.get();

      Object.entries(structure).forEach(([key, data]) => {
        const k = $names[key];

        if (!k) {
          console.log(`adding`, key, data);
          data.name = key;
          w.add(data);
          return
        }

        const type = k.knot.get();

        Object.entries(data).forEach(([key_sub, data_sub]) => {
          if (key_sub === `value` && type === `stitch`) {
            k[key_sub].set({
              ...k[key_sub].get(),
              ...data_sub
            });
            return
          }

          k[key_sub].set(data_sub);
        });
      });
    };

    return w
  };

  const SYSTEM = `sys`;

  let feed_set;
  const feed = read({}, (set) => {
    feed_set = set;
  });

  const feed_add = (address) => {
    const $f = feed.get();
    $f[address] = Date.now();
    feed_set($f);
  };

  // weaves [name]weave
  const weaves = write({
    [SYSTEM]: Weave({
      name: SYSTEM,
      id: SYSTEM
    })
  });

  const highways = new Map();

  let running_set;
  // run the system weave by default (safe idle)
  const running = read({
    [SYSTEM]: true
  }, (set) => { running_set = set; });

  const trash = write();

  const addr = (address) => {
    let path = address.split(`/`);
    if (path[0] === ``) path = path.slice(1);
    return path
  };

  // put into trash bin
  const del = (keys) => {
    const $running = running.get();
    const $weaves = weaves.get();

    let dirty = false;

    Object.keys(keys).forEach((key) => {
      if (key === SYSTEM) return

      if ($running[key]) {
        stop(key);
      }

      if ($weaves[key]) {
        dirty = true;

        trash.set(
          $weaves[key]
        );

        delete $weaves[key];
      }
    });

    if (dirty) weaves.set($weaves);
  };

  // name of the current wheel, path watches
  const name$1 = write(``);

  const get = (address) => {
    const [
      weave_name,
      knot_name,
      chan
    ] = addr(address);

    const w = weaves.get()[weave_name];
    if (w === undefined) return
    if (knot_name === undefined) return w

    const k = w.names.get()[knot_name];
    if (k === undefined) return
    if (chan === undefined) return k

    const c = k.value.get()[chan];
    if (c === undefined) return

    return c
  };

  const exists = (address) => get(address) !== undefined;

  // create the whole path if you gotta
  const spawn = (pattern = {}) => Object.fromEntries(
    Object.entries(pattern).map(([
      weave_id,
      weave_data
    ]) => {
      if (weave_id === SYSTEM) {
        console.warn(`tried to spawn ${SYSTEM}`);
        return [weave_id, get(weave_id)]
      }

      const ws = weaves.get();
      const w = Weave({
        ...weave_data,
        name: weave_id
      });

      ws[weave_id] = w;

      weaves.set(ws);
      return [weave_id, w]
    })
  );

  const start = (weave_name) => {
    if (weave_name === SYSTEM) {
      console.warn(`CaN NoT StArT or StOp /${SYSTEM}`);
      return
    }
    const w = get(weave_name);
    if (!w) return false

    const knots = w.knots.get();

    const by_id = (id) => {
      const [knot_id, knot_chan] = id.split(`/`);
      const knot = knots[knot_id];

      if (knot === undefined) {
        console.warn(`knot  undefined`);
        return
      }

      if (knot_chan === undefined) {
        return knot.value
      }

      return knot.value.get()[knot_chan]
    };

    // this could be reactive
    highways.set(weave_name, [
      // the internal streets
      ...Object.entries(w.threads.get())
        .map(([
          reader,
          writer
        ]) => {
          const r = by_id(reader);
          const wr = by_id(writer);
          if (!wr || !r) {
            w.threads.update(($t) => {
              delete $t[reader];
              return $t
            });
            return () => {}
          }

          return r.subscribe(($val) => {
            wr.set($val);

            // costly debug thingy,
            // TODO: better way?

            const $f = feed.get();
            $f[`${weave_name}/${reader}`] = Date.now();
            $f[`${weave_name}/${writer}`] = Date.now();

            feed_set($f);
          })
        }),
      // lives, think as this as the knots going out to other places
      ...w.lives.get().map((cb) => cb())
    ]);

    running_set({
      ...running.get(),
      [weave_name]: true
    });

    return true
  };

  const stop = (weave_name) => {
    if (weave_name === SYSTEM) {
      console.warn(`CaN NoT StArT or StOp /${SYSTEM}`);
    }

    const h = highways.get(weave_name);

    const r = running.get();
    delete r[weave_name];

    running_set(r);

    if (h === undefined) {
      return
    }

    h.forEach((cancel) => cancel());

    highways.delete(weave_name);
  };

  const stop_all = () => {
    const $weaves = weaves.get();

    Object.keys($weaves).forEach(($name) => stop($name));
  };

  const clear = () => {
    stop_all();
    name$1.set(false);
    weaves.set({
      [SYSTEM]: weaves.get()[SYSTEM]
    });
  };

  const restart = (name) => {
    Wheel.stop(name);
    Wheel.start(name);
  };

  const bump = (what) => JSON.parse(JSON.stringify(what));

  const toJSON = () => ({
    name: name$1.get(),
    weaves: bump(weaves),
    running: bump(running)
  });

  const REG_ID = /\$?[~\.]?\/[a-zA-Z \/]+/g;

  var Wheel$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    SYSTEM: SYSTEM,
    feed: feed,
    feed_add: feed_add,
    weaves: weaves,
    running: running,
    trash: trash,
    del: del,
    name: name$1,
    get: get,
    exists: exists,
    spawn: spawn,
    start: start,
    stop: stop,
    stop_all: stop_all,
    clear: clear,
    restart: restart,
    toJSON: toJSON,
    REG_ID: REG_ID
  });

  window.Wheel = Wheel$1;

  const position = read([0, 0], set => window
    .addEventListener(`mousemove`, ({ clientX, clientY }) => set([clientX, clientY]))
  );

  const mouse_up = read(null, set => window
    .addEventListener(`mouseup`, (e) => set(e))
  );

  const scroll = read([0, 0, 0], set => window
    .addEventListener(`wheel`, (e) => {
      set([-e.deltaX, -e.deltaY, 0]);
    })
  );

  window.addEventListener(`touchmove`, (e) => e.preventDefault());
  window.addEventListener(`pointermove`, (e) => e.preventDefault());

  var mouse = /*#__PURE__*/Object.freeze({
    __proto__: null,
    position: position,
    mouse_up: mouse_up,
    scroll: scroll
  });

  const tick = read(0, (set) => {
    let intv = false;

    TIME_TICK_RATE.listen(($rate) => {
      if (intv) clearInterval(intv);
      intv = setInterval(() => {
        set(tick.get() + 1);
      }, $rate);
    });
  });

  const frame = read([0, 0], (set) => {
    let old;
    const data = [0, 0];
    const frame_t = (ts) => {
      requestAnimationFrame(frame_t);

      if (old === undefined) old = ts;

      data[0] = ts;
      data[1] = Math.round(ts - old);

      old = ts;
      set(data);
    };

    requestAnimationFrame(frame_t);
  });

  var time = /*#__PURE__*/Object.freeze({
    __proto__: null,
    tick: tick,
    frame: frame
  });

  var sprite_frag = "precision highp float;uniform sampler2D u_map;varying vec2 v_sprite;void main(){gl_FragColor=texture2D(u_map,v_sprite);}";

  var sprite_vert = "precision highp float;uniform mat4 u_view_projection;uniform float u_sprite_size;uniform float u_sprite_columns;uniform float u_time;attribute vec3 translate;attribute vec3 translate_last;attribute float scale;attribute float scale_last;attribute float sprite;attribute vec2 position;varying vec2 v_sprite;void main(){float x=mod(sprite,u_sprite_columns);float y=floor(sprite/u_sprite_columns);float s=mix(scale_last,scale,u_time);vec2 pos_scale=position*s;vec2 coords=(position+vec2(0.5,0.5)+vec2(x,y))/u_sprite_columns;v_sprite=coords;vec3 t=mix(translate_last,translate,u_time);mat4 mv=u_view_projection;vec3 pos=vec3(pos_scale,0.0)+t;gl_Position=mv*vec4(pos,1.0);gl_Position-=vec4((gl_Position.xy)*gl_Position.z,0.0,0.0);}";

  const breaker = (a) => a.map(i => `\r\n${i}`);

  const sprite$1 = read(breaker([
    sprite_vert,
    sprite_frag
  ]));

  const validate = ({ set }) => (val) => {
    if (!Array.isArray(val)) {
      if (
        val &&
        typeof val[0] === `number` &&
        typeof val[1] === `number` &&
        typeof val[2] === `number`
      ) {
        set(val);
        return
      }

      return
    }
    set(val);
  };

  const camera = write(twgl.m4.identity());
  const position$1 = write([0, 0, 0]);
  const look = write([0, 0, -1]);

  look.set = validate(look);
  position$1.set = validate(position$1);

  var camera$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    camera: camera,
    position: position$1,
    look: look
  });

  const blank = () => ({
    position: [],
    sprite: [],
    scale: [],
    translate_last: [],
    scale_last: []
  });

  const defaults = Object.entries({
    position: [0, 0, 0],
    sprite: [335],
    scale: [1]
  });

  const verts = twgl.primitives.createXYQuadVertices(1);

  let count = 0;

  const buffer = {
    ...Object.fromEntries(Object.entries(verts).map(
      ([key, val]) => {
        val.divisor = 0;
        return [key, val]
      }
    )),
    translate_last: {
      divisor: 1,
      data: [],
      numComponents: 3
    },
    translate: {
      divisor: 1,
      data: [],
      numComponents: 3
    },
    sprite: {
      numComponents: 1,
      data: [],
      divisor: 1
    },
    scale: {
      numComponents: 1,
      data: [],
      divisor: 1
    },
    scale_last: {
      numComponents: 1,
      data: [],
      divisor: 1
    }
  };

  const translate_last = {};
  const scale_last = {};

  let last_snap = Date.now();

  const snapshot = () => ({
    count,
    buffer,
    time: (Date.now() - last_snap) / TIME_TICK_RATE.get()
  });

  // RAF so it happens at end of frame
  tick.listen(() => requestAnimationFrame(() => {
    const buffs = blank();
    const running = Wheel.running.get();

    Object.values(Wheel.weaves.get()).forEach((weave) => {
      if (!running[weave.name.get()]) return

      Object.keys(weave.rezed.get()).forEach((id) => {
        const knot = weave.get_id(id);

        // wtf a nonstitch is rezed
        if (knot.knot.get() !== `stitch`) {
          console.warn(`non stitch rezed`, weave, knot);
          return
        }
        const vs = knot.value.get();

        defaults.forEach(([key, def]) => {
          if (!vs[key]) {
            return buffs[key].push(...def)
          }

          let value = vs[key].get();

          if (typeof value === `number`) {
            value = [value];
          }

          if (!Array.isArray(value)) {
            return buffs[key].push(...def)
          }

          const result = [];
          for (let i = 0; i < def.length; i++) {
            if (typeof value[i] !== `number` || i >= value.length) {
              result.push(def[i]);
              return
            }
            result.push(value[i]);
          }

          buffs[key].push(...result);
        });

        const t_last = translate_last[id] || buffs.position.slice(-3);
        translate_last[id] = buffs.position.slice(-3);
        buffs.translate_last.push(...t_last);

        const s_last = scale_last[id] || buffs.scale.slice(-1);
        scale_last[id] = buffs.scale.slice(-1);
        buffs.scale_last.push(s_last);
      });
    });

    Object.entries(buffs).forEach(([key, buff]) => {
      if (key === `position`) {
        buffer.translate.data = buff;
        return
      }
      buffer[key].data = buff;
    });

    count = buffer.sprite.data.length;
    last_snap = Date.now();
  }));

  const { m4 } = twgl;
  const up = [0, 1, 0];

  var webgl = () => {
    const canvas = document.createElement(`canvas`);
    canvas.width = 16 * 100;
    canvas.height = 16 * 100;

    const gl = canvas.getContext(`webgl`);
    twgl.addExtensionsToContext(gl);

    const textures = twgl.createTextures(gl, {
      map: {
        src: SPRITES.get(),
        mag: gl.NEAREST,
        min: gl.LINEAR
      }
    });

    const program_info = twgl.createProgramInfo(
      gl,
      sprite$1.get()
    );

    canvas.snap = write(snapshot());

    const view = m4.identity();
    const view_projection = m4.identity();

    // lifecycle on knot
    canvas.cancel = frame.subscribe(([time, t]) => {
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      // see what these are about
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const projection = twgl.m4.ortho(
        -10, 10, 10, -10, -100, 50
      );

      const c = camera.get();
      const $pos = position$1.get();

      m4.lookAt($pos, twgl.v3.add($pos, look.get()), up, c);
      m4.inverse(c, view);
      camera.set(c);
      m4.multiply(projection, view, view_projection);

      const snap = snapshot();

      if (snap.count < 1) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return
      }

      const u = {
        u_map: textures.map,
        u_time: snap.time,
        u_sprite_size: 16,
        u_sprite_columns: 32,
        u_view_projection: view_projection
      };

      try {
        const buffer_info = twgl.createBufferInfoFromArrays(
          gl,
          snap.buffer
        );

        const vertex_info = twgl.createVertexArrayInfo(gl, program_info, buffer_info);

        gl.useProgram(program_info.program);
        twgl.setBuffersAndAttributes(gl, program_info, vertex_info);
        twgl.setUniforms(program_info, u);

        twgl.drawObjectList(gl, [{
          programInfo: program_info,
          vertexArrayInfo: vertex_info,
          uniforms: u,
          instanceCount: snap.count
        }]);
      } catch (ex) {
        console.warn(`GPU ERROR ${ex}`);
      }
    });

    return canvas
  };

  const size = read([window.innerWidth, window.innerHeight], (set) => {
    window.addEventListener(`resize`, () => {
      set([window.innerWidth, window.innerHeight]);
    });
  });

  const scale = write(1);

  size.subscribe(([width, height]) => {
    const target = width > height
      ? height
      : width;

    scale.set(target / 100);
    window.document.documentElement.style.fontSize = `${Math.round(scale.get())}px`;
  });

  // main canvas
  const main = read(webgl());

  var screen = /*#__PURE__*/Object.freeze({
    __proto__: null,
    size: size,
    scale: scale,
    main: main
  });

  const key = read(``, (set) => {
    window.addEventListener(`keyup`, (e) => {
      if (
        e.target.tagName === `INPUT` ||
        e.target.tagName === `TEXTAREA`
      ) {
        return
      }

      e.preventDefault();

      set(`${e.key.toLowerCase()}!`);
    });

    window.addEventListener(`keydown`, (e) => {
      if (
        e.target.tagName === `INPUT` ||
        e.target.tagName === `TEXTAREA`
      ) {
        return
      }

      e.preventDefault();

      set(e.key.toLowerCase());
    });
  });

  const keys = read({}, (set) => {
    const value = {};

    key.listen((char) => {
      value[char] = true;
      if (char.length > 1 && char[char.length - 1] === `!`) {
        value[char.slice(0, -1)] = false;
      } else {
        value[`${char}!`] = false;
      }
      set(value);
    });
  });

  var key$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    key: key,
    keys: keys
  });

  /* @license twgl.js 4.14.1 Copyright (c) 2015, Gregg Tavares All Rights Reserved.
  Available via the MIT license.
  see: http://github.com/greggman/twgl.js for details */
  /*
   * Copyright 2019 Gregg Tavares
   *
   * Permission is hereby granted, free of charge, to any person obtaining a
   * copy of this software and associated documentation files (the "Software"),
   * to deal in the Software without restriction, including without limitation
   * the rights to use, copy, modify, merge, publish, distribute, sublicense,
   * and/or sell copies of the Software, and to permit persons to whom the
   * Software is furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
   * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
   * DEALINGS IN THE SOFTWARE.
   */

  /**
   *
   * Vec3 math math functions.
   *
   * Almost all functions take an optional `dst` argument. If it is not passed in the
   * functions will create a new Vec3. In other words you can do this
   *
   *     var v = v3.cross(v1, v2);  // Creates a new Vec3 with the cross product of v1 x v2.
   *
   * or
   *
   *     var v = v3.create();
   *     v3.cross(v1, v2, v);  // Puts the cross product of v1 x v2 in v
   *
   * The first style is often easier but depending on where it's used it generates garbage where
   * as there is almost never allocation with the second style.
   *
   * It is always save to pass any vector as the destination. So for example
   *
   *     v3.cross(v1, v2, v1);  // Puts the cross product of v1 x v2 in v1
   *
   * @module twgl/v3
   */

  let VecType = Float32Array;

  /**
   * A JavaScript array with 3 values or a Float32Array with 3 values.
   * When created by the library will create the default type which is `Float32Array`
   * but can be set by calling {@link module:twgl/v3.setDefaultType}.
   * @typedef {(number[]|Float32Array)} Vec3
   * @memberOf module:twgl/v3
   */

  /**
   * Sets the type this library creates for a Vec3
   * @param {constructor} ctor the constructor for the type. Either `Float32Array` or `Array`
   * @return {constructor} previous constructor for Vec3
   * @memberOf module:twgl/v3
   */
  function setDefaultType(ctor) {
    const oldType = VecType;
    VecType = ctor;
    return oldType;
  }

  /**
   * Creates a vec3; may be called with x, y, z to set initial values.
   * @param {number} [x] Initial x value.
   * @param {number} [y] Initial y value.
   * @param {number} [z] Initial z value.
   * @return {module:twgl/v3.Vec3} the created vector
   * @memberOf module:twgl/v3
   */
  function create(x, y, z) {
    const dst = new VecType(3);
    if (x) {
      dst[0] = x;
    }
    if (y) {
      dst[1] = y;
    }
    if (z) {
      dst[2] = z;
    }
    return dst;
  }

  /**
   * Adds two vectors; assumes a and b have the same dimension.
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} A vector tha tis the sum of a and b.
   * @memberOf module:twgl/v3
   */
  function add(a, b, dst) {
    dst = dst || new VecType(3);

    dst[0] = a[0] + b[0];
    dst[1] = a[1] + b[1];
    dst[2] = a[2] + b[2];

    return dst;
  }

  /**
   * Subtracts two vectors.
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} A vector that is the difference of a and b.
   * @memberOf module:twgl/v3
   */
  function subtract(a, b, dst) {
    dst = dst || new VecType(3);

    dst[0] = a[0] - b[0];
    dst[1] = a[1] - b[1];
    dst[2] = a[2] - b[2];

    return dst;
  }

  /**
   * Performs linear interpolation on two vectors.
   * Given vectors a and b and interpolation coefficient t, returns
   * a + t * (b - a).
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {number} t Interpolation coefficient.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The linear interpolated result.
   * @memberOf module:twgl/v3
   */
  function lerp(a, b, t, dst) {
    dst = dst || new VecType(3);

    dst[0] = a[0] + t * (b[0] - a[0]);
    dst[1] = a[1] + t * (b[1] - a[1]);
    dst[2] = a[2] + t * (b[2] - a[2]);

    return dst;
  }

  /**
   * Performs linear interpolation on two vectors.
   * Given vectors a and b and interpolation coefficient vector t, returns
   * a + t * (b - a).
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} t Interpolation coefficients vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} the linear interpolated result.
   * @memberOf module:twgl/v3
   */
  function lerpV(a, b, t, dst) {
    dst = dst || new VecType(3);

    dst[0] = a[0] + t[0] * (b[0] - a[0]);
    dst[1] = a[1] + t[1] * (b[1] - a[1]);
    dst[2] = a[2] + t[2] * (b[2] - a[2]);

    return dst;
  }

  /**
   * Return max values of two vectors.
   * Given vectors a and b returns
   * [max(a[0], b[0]), max(a[1], b[1]), max(a[2], b[2])].
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The max components vector.
   * @memberOf module:twgl/v3
   */
  function max(a, b, dst) {
    dst = dst || new VecType(3);

    dst[0] = Math.max(a[0], b[0]);
    dst[1] = Math.max(a[1], b[1]);
    dst[2] = Math.max(a[2], b[2]);

    return dst;
  }

  /**
   * Return min values of two vectors.
   * Given vectors a and b returns
   * [min(a[0], b[0]), min(a[1], b[1]), min(a[2], b[2])].
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The min components vector.
   * @memberOf module:twgl/v3
   */
  function min(a, b, dst) {
    dst = dst || new VecType(3);

    dst[0] = Math.min(a[0], b[0]);
    dst[1] = Math.min(a[1], b[1]);
    dst[2] = Math.min(a[2], b[2]);

    return dst;
  }

  /**
   * Multiplies a vector by a scalar.
   * @param {module:twgl/v3.Vec3} v The vector.
   * @param {number} k The scalar.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The scaled vector.
   * @memberOf module:twgl/v3
   */
  function mulScalar(v, k, dst) {
    dst = dst || new VecType(3);

    dst[0] = v[0] * k;
    dst[1] = v[1] * k;
    dst[2] = v[2] * k;

    return dst;
  }

  /**
   * Divides a vector by a scalar.
   * @param {module:twgl/v3.Vec3} v The vector.
   * @param {number} k The scalar.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The scaled vector.
   * @memberOf module:twgl/v3
   */
  function divScalar(v, k, dst) {
    dst = dst || new VecType(3);

    dst[0] = v[0] / k;
    dst[1] = v[1] / k;
    dst[2] = v[2] / k;

    return dst;
  }

  /**
   * Computes the cross product of two vectors; assumes both vectors have
   * three entries.
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The vector of a cross b.
   * @memberOf module:twgl/v3
   */
  function cross(a, b, dst) {
    dst = dst || new VecType(3);

    const t1 = a[2] * b[0] - a[0] * b[2];
    const t2 = a[0] * b[1] - a[1] * b[0];
    dst[0] = a[1] * b[2] - a[2] * b[1];
    dst[1] = t1;
    dst[2] = t2;

    return dst;
  }

  /**
   * Computes the dot product of two vectors; assumes both vectors have
   * three entries.
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @return {number} dot product
   * @memberOf module:twgl/v3
   */
  function dot(a, b) {
    return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
  }

  /**
   * Computes the length of vector
   * @param {module:twgl/v3.Vec3} v vector.
   * @return {number} length of vector.
   * @memberOf module:twgl/v3
   */
  function length$1(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  /**
   * Computes the square of the length of vector
   * @param {module:twgl/v3.Vec3} v vector.
   * @return {number} square of the length of vector.
   * @memberOf module:twgl/v3
   */
  function lengthSq(v) {
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  }

  /**
   * Computes the distance between 2 points
   * @param {module:twgl/v3.Vec3} a vector.
   * @param {module:twgl/v3.Vec3} b vector.
   * @return {number} distance between a and b
   * @memberOf module:twgl/v3
   */
  function distance(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Computes the square of the distance between 2 points
   * @param {module:twgl/v3.Vec3} a vector.
   * @param {module:twgl/v3.Vec3} b vector.
   * @return {number} square of the distance between a and b
   * @memberOf module:twgl/v3
   */
  function distanceSq(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Divides a vector by its Euclidean length and returns the quotient.
   * @param {module:twgl/v3.Vec3} a The vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The normalized vector.
   * @memberOf module:twgl/v3
   */
  function normalize(a, dst) {
    dst = dst || new VecType(3);

    const lenSq = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    const len = Math.sqrt(lenSq);
    if (len > 0.00001) {
      dst[0] = a[0] / len;
      dst[1] = a[1] / len;
      dst[2] = a[2] / len;
    } else {
      dst[0] = 0;
      dst[1] = 0;
      dst[2] = 0;
    }

    return dst;
  }

  /**
   * Negates a vector.
   * @param {module:twgl/v3.Vec3} v The vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} -v.
   * @memberOf module:twgl/v3
   */
  function negate(v, dst) {
    dst = dst || new VecType(3);

    dst[0] = -v[0];
    dst[1] = -v[1];
    dst[2] = -v[2];

    return dst;
  }

  /**
   * Copies a vector.
   * @param {module:twgl/v3.Vec3} v The vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} A copy of v.
   * @memberOf module:twgl/v3
   */
  function copy(v, dst) {
    dst = dst || new VecType(3);

    dst[0] = v[0];
    dst[1] = v[1];
    dst[2] = v[2];

    return dst;
  }

  /**
   * Multiplies a vector by another vector (component-wise); assumes a and
   * b have the same length.
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The vector of products of entries of a and
   *     b.
   * @memberOf module:twgl/v3
   */
  function multiply(a, b, dst) {
    dst = dst || new VecType(3);

    dst[0] = a[0] * b[0];
    dst[1] = a[1] * b[1];
    dst[2] = a[2] * b[2];

    return dst;
  }

  /**
   * Divides a vector by another vector (component-wise); assumes a and
   * b have the same length.
   * @param {module:twgl/v3.Vec3} a Operand vector.
   * @param {module:twgl/v3.Vec3} b Operand vector.
   * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
   * @return {module:twgl/v3.Vec3} The vector of quotients of entries of a and
   *     b.
   * @memberOf module:twgl/v3
   */
  function divide(a, b, dst) {
    dst = dst || new VecType(3);

    dst[0] = a[0] / b[0];
    dst[1] = a[1] / b[1];
    dst[2] = a[2] / b[2];

    return dst;
  }

  var v3 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    add: add,
    copy: copy,
    create: create,
    cross: cross,
    distance: distance,
    distanceSq: distanceSq,
    divide: divide,
    divScalar: divScalar,
    dot: dot,
    lerp: lerp,
    lerpV: lerpV,
    length: length$1,
    lengthSq: lengthSq,
    max: max,
    min: min,
    mulScalar: mulScalar,
    multiply: multiply,
    negate: negate,
    normalize: normalize,
    setDefaultType: setDefaultType,
    subtract: subtract
  });

  // Collection of meta controllers

  const { length, add: add$1, mulScalar: mulScalar$1 } = v3;

  const zoom = write(0.75);

  // raw translate commands
  const translate = read([0, 0, 0], (set) => {
    const b_key = [0, 0, 0];
    // frame stuff has to be fast :/
    frame.listen(() => {
      const { w, a, s, d, q, e } = keys.get();

      b_key[0] = 0;
      b_key[1] = 0;
      b_key[2] = 0;

      if (w) b_key[1] -= 1;
      if (s) b_key[1] += 1;
      if (a) b_key[0] -= 1;
      if (d) b_key[0] += 1;
      if (q) b_key[2] += 1;
      if (e) b_key[2] -= 1;

      if (length(b_key) === 0) return

      set(b_key);
    });
  });

  let scroll_velocity = [0, 0, 0];

  const scroll$1 = transformer((data) => data.map((i) => Math.round(i)));

  scroll$1.set([0, 0, 0]);

  tick.listen(() => {
    if (Math.abs(length(scroll_velocity)) < 1) return

    scroll$1.set(add$1(
      scroll$1.get(),
      scroll_velocity
    ).map((n) => Math.round(n)));

    scroll_velocity = mulScalar$1(
      scroll_velocity,
      0.25
    );
  });

  scroll.listen((vel) => {
    scroll_velocity = add$1(scroll_velocity, vel);
  });

  const focus = write(``);

  var input = /*#__PURE__*/Object.freeze({
    __proto__: null,
    zoom: zoom,
    translate: translate,
    scroll: scroll$1,
    focus: focus
  });

  let use_search = ``;

  const path = transformer((path_new) => {
    window.history.pushState({ page: 1 }, ``, `${use_search}${path_new}`);
    if (Array.isArray(path_new)) {
      return path_new
    }

    const path_split = path_new.split(`/`);
    if (window.location.pathname === path_new) {
      return path_split
    }

    return path_split
  });

  window.addEventListener(`popstate`, (e) => {
    e.preventDefault();
    e.stopPropagation();
    update();
  });

  const update = () => {
    if (window.location.search) {
      use_search = `?`;
      path.set(decodeURI(window.location.search.slice(1)));
    } else {
      path.set(decodeURI(window.location.pathname.slice(1)));
    }
  };

  update();

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var FileSaver_min = createCommonjsModule(function (module, exports) {
  (function(a,b){b();})(commonjsGlobal,function(){function b(a,b){return "undefined"==typeof b?b={autoBom:!1}:"object"!=typeof b&&(console.warn("Deprecated: Expected third argument to be a object"),b={autoBom:!b}),b.autoBom&&/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a.type)?new Blob(["\uFEFF",a],{type:a.type}):a}function c(b,c,d){var e=new XMLHttpRequest;e.open("GET",b),e.responseType="blob",e.onload=function(){a(e.response,c,d);},e.onerror=function(){console.error("could not download file");},e.send();}function d(a){var b=new XMLHttpRequest;b.open("HEAD",a,!1);try{b.send();}catch(a){}return 200<=b.status&&299>=b.status}function e(a){try{a.dispatchEvent(new MouseEvent("click"));}catch(c){var b=document.createEvent("MouseEvents");b.initMouseEvent("click",!0,!0,window,0,0,0,80,20,!1,!1,!1,!1,0,null),a.dispatchEvent(b);}}var f="object"==typeof window&&window.window===window?window:"object"==typeof self&&self.self===self?self:"object"==typeof commonjsGlobal&&commonjsGlobal.global===commonjsGlobal?commonjsGlobal:void 0,a=f.saveAs||("object"!=typeof window||window!==f?function(){}:"download"in HTMLAnchorElement.prototype?function(b,g,h){var i=f.URL||f.webkitURL,j=document.createElement("a");g=g||b.name||"download",j.download=g,j.rel="noopener","string"==typeof b?(j.href=b,j.origin===location.origin?e(j):d(j.href)?c(b,g,h):e(j,j.target="_blank")):(j.href=i.createObjectURL(b),setTimeout(function(){i.revokeObjectURL(j.href);},4E4),setTimeout(function(){e(j);},0));}:"msSaveOrOpenBlob"in navigator?function(f,g,h){if(g=g||f.name||"download","string"!=typeof f)navigator.msSaveOrOpenBlob(b(f,h),g);else if(d(f))c(f,g,h);else{var i=document.createElement("a");i.href=f,i.target="_blank",setTimeout(function(){e(i);});}}:function(a,b,d,e){if(e=e||open("","_blank"),e&&(e.document.title=e.document.body.innerText="downloading..."),"string"==typeof a)return c(a,b,d);var g="application/octet-stream"===a.type,h=/constructor/i.test(f.HTMLElement)||f.safari,i=/CriOS\/[\d]+/.test(navigator.userAgent);if((i||g&&h)&&"object"==typeof FileReader){var j=new FileReader;j.onloadend=function(){var a=j.result;a=i?a:a.replace(/^data:[^;]*;/,"data:attachment/file;"),e?e.location.href=a:location=a,e=null;},j.readAsDataURL(a);}else{var k=f.URL||f.webkitURL,l=k.createObjectURL(a);e?e.location=l:location.href=l,e=null,setTimeout(function(){k.revokeObjectURL(l);},4E4);}});f.saveAs=a.saveAs=a,(module.exports=a);});


  });

  const SIZE = 16;
  const SPACING = 0;
  const COLUMNS = TILE_COLUMNS.get();
  const COUNT = TILE_COUNT.get();

  const ready = new Promise((resolve) => {
    const tiles = new Image();
    tiles.src = `/sheets/default_2.png`;

    tiles.onload = () => {
      const canvas = document.createElement(`canvas`);
      canvas.width = tiles.width;
      canvas.height = tiles.height;

      const ctx = canvas.getContext(`2d`);
      ctx.drawImage(tiles, 0, 0);

      resolve({ ctx, canvas });
    };
  });

  const repo = new Map();

  const num_random = (min, max) =>
    Math.floor(Math.random() * (Math.abs(min) + Math.abs(max)) - Math.abs(min));

  var Tile = async ({
    width,
    height,
    data,
    random = false
  }) => {
    const { canvas } = await ready;

    const key = `${width}:${height}:${data}`;

    if (!random && repo.has(key)) {
      return repo.get(key)
    }

    const data_canvas = document.createElement(`canvas`);
    const data_ctx = data_canvas.getContext(`2d`);

    data_canvas.width = SIZE * width;
    data_canvas.height = SIZE * height;

    if (random) {
      let t_x, t_y;
      let s_x, s_y;

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          t_x = x * SIZE;
          t_y = y * SIZE;

          s_x = num_random(0, COLUMNS) * (SIZE + SPACING);
          s_y = num_random(0, COUNT / COLUMNS) * (SIZE + SPACING);

          data_ctx.drawImage(
            canvas,
            s_x, s_y, SIZE, SIZE,
            t_x, t_y, SIZE, SIZE
          );
        }
      }
    } else if (data.length > 0) {
      let x, y;
      data.split(` `).forEach((loc, i) => {
        x = i % width;
        y = Math.floor(i / width);

        const idx = parseInt(loc, 10);
        const o_x = idx % COLUMNS;
        const o_y = Math.floor(idx / COLUMNS);

        const t_x = x * SIZE;
        const t_y = y * SIZE;

        const s_x = o_x * (SIZE + SPACING);
        const s_y = o_y * (SIZE + SPACING);

        data_ctx.drawImage(
          canvas,
          s_x, s_y, SIZE, SIZE,
          t_x, t_y, SIZE, SIZE
        );
      });
    }

    const result = data_canvas.toDataURL(`image/png`);
    if (!random) {
      repo.set(key, result);
    }

    return result
  };

  const load = (img) => {
    try {
      const r = exif.load(img);
      return JSON.parse(r[`0th`][exif.ImageIFD.Make])
    } catch (ex) {
      return false
    }
  };

  const saved = write(false);
  const save = async (weave) => {
    const obj = {
      "0th": {
        [exif.ImageIFD.Make]: JSON.stringify(weave),
        [exif.ImageIFD.Software]: `isekai`
      },
      Exif: {},
      GPS: {}
    };

    FileSaver_min.saveAs(exif.insert(exif.dump(obj), await image(weave.name.get())), `${weave.name.get()}.jpg`);
    saved.set(weave.name);
  };

  const img_load = (data) => new Promise(async (resolve) => {
    const image = new Image();
    image.src = await Tile(data);
    image.onload = () => resolve(image);
  });

  const garden = img_load({
    width: 4,
    height: 4,
    data: [
      `18 19 19 20`,
      `50 0 0 52`,
      `50 0 0 52`,
      `82 83 83 84`
    ].join(` `)
  });

  const image = async (name) => {
    const tn = tile(`/${name}`);

    const img_tile = img_load({
      width: 1,
      height: 1,
      data: tn
    });

    const canvas = document.createElement(`canvas`);
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext(`2d`);
    ctx.imageSmoothingEnabled = false;
    ctx.filter = `sepia(1) hue-rotate(90deg)`;

    ctx.drawImage(await garden, 0, 0, 64, 64, 0, 0, 64, 64);
    ctx.drawImage(await img_tile, 0, 0, 16, 16, 16, 16, 32, 32);

    return canvas.toDataURL(`image/jpeg`, 0.95)
  };

  const github = async ($path, autorun = false) => {
    const url = `https://raw.githubusercontent.com/${$path[0]}/${$path[1]}/master/${$path[2]}.jpg`;

    const reader = new FileReader();
    const blob = await fetch(url)
      .then((r) => r.blob());

    reader.readAsDataURL(blob);

    return new Promise((resolve, reject) => {
      reader.addEventListener(`load`, () => {
        const data = load(reader.result);
        if (!data) return reject(new Error(404))

        Wheel.spawn({
          [data.name]: data
        });

        const w = Wheel.get(data.name);

        w.update({
          INFO: {
            knot: `stitch`,
            value: {
              from: $path.join(`/`),
              url: `https://github.com/${$path[0]}/${$path[1]}/blob/master/${$path[2]}.jpg`
            }
          }
        });

        if (autorun) {
          Wheel.start(data.name);
        }

        resolve(data.name);
      });
    })
  };

  const VERSION = 1;
  const TIME_AGO = IDBKeyRange.upperBound(Date.now() - 1000 * 60);
  let db;

  const loaded = write(false);
  const data = new Promise((resolve) => {
    const req = window.indexedDB.open(`turbo`, VERSION);

    req.onupgradeneeded = async (e) => {
      db = e.target.result;
      db.createObjectStore(`wheel`, { keyPath: `name` });

      resolve(db);
    };

    req.onsuccess = (e) => {
      db = e.target.result;

      resolve(db);
    };
  });

  const query = ({
    store = `wheel`,
    action = `get`,
    args = [],
    foronly = `readwrite`
  } = false) => new Promise((resolve, reject) => {
    data.then(() => {
      const t = db.transaction([store], foronly);
      t.onerror = reject;
      t.objectStore(store)[action](...args).onsuccess = (e) => resolve(e.target.result);
    });
  });

  const save$1 = async () => {
    const wheel = Wheel.toJSON();

    wheel.date = Date.now();

    // update current
    await query({
      action: `put`,
      args: [wheel],
      foronly: `readwrite`
    });
  };

  window.query = query;

  const savewatch = async ($name) => {
    loaded.set(false);

    const result = await query({
      action: `get`,
      args: [$name]
    }).catch((e) => console.warn(`DB`, e.target.error));

    if (result) {
      const { weaves, running } = result;
      // protect system
      delete weaves[Wheel.SYSTEM];

      Wheel.name.set($name);
      Wheel.spawn(weaves);

      Object.keys(running).forEach((id) => {
        if (id === Wheel.SYSTEM) return
        if (!Wheel.get(id)) return
        Wheel.start(id);
      });
    }

    loaded.set(true);

    const cancel = tick.listen((t) => {
      if (
        t % 10 !== 0 ||
        db === undefined ||
        !loaded.get()
      ) return

      save$1();
    });

    return () => {
      Wheel.clear();
      name.set(`loading`);
      cancel();
    }
  };

  // init()

  let watch = false;
  path.listen(async ($path) => {
    // your watch has ended
    if (watch) watch();

    if ($path.length === 1) {
      Wheel.name.set($path[0]);
      watch = savewatch($path[0]);
    }

    if ($path.length === 3) {
      await loaded;

      Wheel.name.set(`loading`);

      await github($path, true);

      Wheel.name.set($path.join(`/`));
      watch = savewatch($path.join(`/`));
    }
  });

  const tie = (items) =>
    Object.entries(items)
      .reduce((result, [key, value]) => ({
        ...result,
        [key]: {
          name: key,
          knot: `stitch`,
          value
        }
      }), {});

  var system = Weave({
    name: `sys`,
    id: `sys`,
    knots: tie({
      mouse,
      time,
      screen,
      input,
      key: key$1,
      flag,
      camera: camera$1
    })
  });

  function noop() { }
  function assign(tar, src) {
      // @ts-ignore
      for (const k in src)
          tar[k] = src[k];
      return tar;
  }
  function is_promise(value) {
      return value && typeof value === 'object' && typeof value.then === 'function';
  }
  function add_location(element, file, line, column, char) {
      element.__svelte_meta = {
          loc: { file, line, column, char }
      };
  }
  function run(fn) {
      return fn();
  }
  function blank_object() {
      return Object.create(null);
  }
  function run_all(fns) {
      fns.forEach(run);
  }
  function is_function(thing) {
      return typeof thing === 'function';
  }
  function safe_not_equal(a, b) {
      return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
  }
  function validate_store(store, name) {
      if (!store || typeof store.subscribe !== 'function') {
          throw new Error(`'${name}' is not a store with a 'subscribe' method`);
      }
  }
  function subscribe(store, callback) {
      const unsub = store.subscribe(callback);
      return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
  }
  function component_subscribe(component, store, callback) {
      component.$$.on_destroy.push(subscribe(store, callback));
  }

  function append(target, node) {
      target.appendChild(node);
  }
  function insert(target, node, anchor) {
      target.insertBefore(node, anchor || null);
  }
  function detach(node) {
      node.parentNode.removeChild(node);
  }
  function destroy_each(iterations, detaching) {
      for (let i = 0; i < iterations.length; i += 1) {
          if (iterations[i])
              iterations[i].d(detaching);
      }
  }
  function element(name) {
      return document.createElement(name);
  }
  function text(data) {
      return document.createTextNode(data);
  }
  function space() {
      return text(' ');
  }
  function empty() {
      return text('');
  }
  function listen(node, event, handler, options) {
      node.addEventListener(event, handler, options);
      return () => node.removeEventListener(event, handler, options);
  }
  function attr(node, attribute, value) {
      if (value == null)
          node.removeAttribute(attribute);
      else if (node.getAttribute(attribute) !== value)
          node.setAttribute(attribute, value);
  }
  function children(element) {
      return Array.from(element.childNodes);
  }
  function set_input_value(input, value) {
      if (value != null || input.value) {
          input.value = value;
      }
  }
  function set_style(node, key, value, important) {
      node.style.setProperty(key, value, important ? 'important' : '');
  }
  function toggle_class(element, name, toggle) {
      element.classList[toggle ? 'add' : 'remove'](name);
  }
  function custom_event(type, detail) {
      const e = document.createEvent('CustomEvent');
      e.initCustomEvent(type, false, false, detail);
      return e;
  }

  let current_component;
  function set_current_component(component) {
      current_component = component;
  }
  function get_current_component() {
      if (!current_component)
          throw new Error(`Function called outside component initialization`);
      return current_component;
  }

  const dirty_components = [];
  const binding_callbacks = [];
  const render_callbacks = [];
  const flush_callbacks = [];
  const resolved_promise = Promise.resolve();
  let update_scheduled = false;
  function schedule_update() {
      if (!update_scheduled) {
          update_scheduled = true;
          resolved_promise.then(flush);
      }
  }
  function add_render_callback(fn) {
      render_callbacks.push(fn);
  }
  function flush() {
      const seen_callbacks = new Set();
      do {
          // first, call beforeUpdate functions
          // and update components
          while (dirty_components.length) {
              const component = dirty_components.shift();
              set_current_component(component);
              update$1(component.$$);
          }
          while (binding_callbacks.length)
              binding_callbacks.pop()();
          // then, once components are updated, call
          // afterUpdate functions. This may cause
          // subsequent updates...
          for (let i = 0; i < render_callbacks.length; i += 1) {
              const callback = render_callbacks[i];
              if (!seen_callbacks.has(callback)) {
                  callback();
                  // ...so guard against infinite loops
                  seen_callbacks.add(callback);
              }
          }
          render_callbacks.length = 0;
      } while (dirty_components.length);
      while (flush_callbacks.length) {
          flush_callbacks.pop()();
      }
      update_scheduled = false;
  }
  function update$1($$) {
      if ($$.fragment !== null) {
          $$.update($$.dirty);
          run_all($$.before_update);
          $$.fragment && $$.fragment.p($$.dirty, $$.ctx);
          $$.dirty = null;
          $$.after_update.forEach(add_render_callback);
      }
  }
  const outroing = new Set();
  let outros;
  function group_outros() {
      outros = {
          r: 0,
          c: [],
          p: outros // parent group
      };
  }
  function check_outros() {
      if (!outros.r) {
          run_all(outros.c);
      }
      outros = outros.p;
  }
  function transition_in(block, local) {
      if (block && block.i) {
          outroing.delete(block);
          block.i(local);
      }
  }
  function transition_out(block, local, detach, callback) {
      if (block && block.o) {
          if (outroing.has(block))
              return;
          outroing.add(block);
          outros.c.push(() => {
              outroing.delete(block);
              if (callback) {
                  if (detach)
                      block.d(1);
                  callback();
              }
          });
          block.o(local);
      }
  }

  function handle_promise(promise, info) {
      const token = info.token = {};
      function update(type, index, key, value) {
          if (info.token !== token)
              return;
          info.resolved = key && { [key]: value };
          const child_ctx = assign(assign({}, info.ctx), info.resolved);
          const block = type && (info.current = type)(child_ctx);
          let needs_flush = false;
          if (info.block) {
              if (info.blocks) {
                  info.blocks.forEach((block, i) => {
                      if (i !== index && block) {
                          group_outros();
                          transition_out(block, 1, 1, () => {
                              info.blocks[i] = null;
                          });
                          check_outros();
                      }
                  });
              }
              else {
                  info.block.d(1);
              }
              block.c();
              transition_in(block, 1);
              block.m(info.mount(), info.anchor);
              needs_flush = true;
          }
          info.block = block;
          if (info.blocks)
              info.blocks[index] = block;
          if (needs_flush) {
              flush();
          }
      }
      if (is_promise(promise)) {
          const current_component = get_current_component();
          promise.then(value => {
              set_current_component(current_component);
              update(info.then, 1, info.value, value);
              set_current_component(null);
          }, error => {
              set_current_component(current_component);
              update(info.catch, 2, info.error, error);
              set_current_component(null);
          });
          // if we previously had a then/catch block, destroy it
          if (info.current !== info.pending) {
              update(info.pending, 0);
              return true;
          }
      }
      else {
          if (info.current !== info.then) {
              update(info.then, 1, info.value, promise);
              return true;
          }
          info.resolved = { [info.value]: promise };
      }
  }

  const globals = (typeof window !== 'undefined' ? window : global);
  function create_component(block) {
      block && block.c();
  }
  function mount_component(component, target, anchor) {
      const { fragment, on_mount, on_destroy, after_update } = component.$$;
      fragment && fragment.m(target, anchor);
      // onMount happens before the initial afterUpdate
      add_render_callback(() => {
          const new_on_destroy = on_mount.map(run).filter(is_function);
          if (on_destroy) {
              on_destroy.push(...new_on_destroy);
          }
          else {
              // Edge case - component was destroyed immediately,
              // most likely as a result of a binding initialising
              run_all(new_on_destroy);
          }
          component.$$.on_mount = [];
      });
      after_update.forEach(add_render_callback);
  }
  function destroy_component(component, detaching) {
      const $$ = component.$$;
      if ($$.fragment !== null) {
          run_all($$.on_destroy);
          $$.fragment && $$.fragment.d(detaching);
          // TODO null out other refs, including component.$$ (but need to
          // preserve final state?)
          $$.on_destroy = $$.fragment = null;
          $$.ctx = {};
      }
  }
  function make_dirty(component, key) {
      if (!component.$$.dirty) {
          dirty_components.push(component);
          schedule_update();
          component.$$.dirty = blank_object();
      }
      component.$$.dirty[key] = true;
  }
  function init(component, options, instance, create_fragment, not_equal, props) {
      const parent_component = current_component;
      set_current_component(component);
      const prop_values = options.props || {};
      const $$ = component.$$ = {
          fragment: null,
          ctx: null,
          // state
          props,
          update: noop,
          not_equal,
          bound: blank_object(),
          // lifecycle
          on_mount: [],
          on_destroy: [],
          before_update: [],
          after_update: [],
          context: new Map(parent_component ? parent_component.$$.context : []),
          // everything else
          callbacks: blank_object(),
          dirty: null
      };
      let ready = false;
      $$.ctx = instance
          ? instance(component, prop_values, (key, ret, value = ret) => {
              if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                  if ($$.bound[key])
                      $$.bound[key](value);
                  if (ready)
                      make_dirty(component, key);
              }
              return ret;
          })
          : prop_values;
      $$.update();
      ready = true;
      run_all($$.before_update);
      // `false` as a special case of no DOM component
      $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
      if (options.target) {
          if (options.hydrate) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              $$.fragment && $$.fragment.l(children(options.target));
          }
          else {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              $$.fragment && $$.fragment.c();
          }
          if (options.intro)
              transition_in(component.$$.fragment);
          mount_component(component, options.target, options.anchor);
          flush();
      }
      set_current_component(parent_component);
  }
  class SvelteComponent {
      $destroy() {
          destroy_component(this, 1);
          this.$destroy = noop;
      }
      $on(type, callback) {
          const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
          callbacks.push(callback);
          return () => {
              const index = callbacks.indexOf(callback);
              if (index !== -1)
                  callbacks.splice(index, 1);
          };
      }
      $set() {
          // overridden by instance, if it has props
      }
  }

  function dispatch_dev(type, detail) {
      document.dispatchEvent(custom_event(type, detail));
  }
  function append_dev(target, node) {
      dispatch_dev("SvelteDOMInsert", { target, node });
      append(target, node);
  }
  function insert_dev(target, node, anchor) {
      dispatch_dev("SvelteDOMInsert", { target, node, anchor });
      insert(target, node, anchor);
  }
  function detach_dev(node) {
      dispatch_dev("SvelteDOMRemove", { node });
      detach(node);
  }
  function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
      const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
      if (has_prevent_default)
          modifiers.push('preventDefault');
      if (has_stop_propagation)
          modifiers.push('stopPropagation');
      dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
      const dispose = listen(node, event, handler, options);
      return () => {
          dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
          dispose();
      };
  }
  function attr_dev(node, attribute, value) {
      attr(node, attribute, value);
      if (value == null)
          dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
      else
          dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
  }
  function set_data_dev(text, data) {
      data = '' + data;
      if (text.data === data)
          return;
      dispatch_dev("SvelteDOMSetData", { node: text, data });
      text.data = data;
  }
  class SvelteComponentDev extends SvelteComponent {
      constructor(options) {
          if (!options || (!options.target && !options.$$inline)) {
              throw new Error(`'target' is a required option`);
          }
          super();
      }
      $destroy() {
          super.$destroy();
          this.$destroy = () => {
              console.warn(`Component was already destroyed`); // eslint-disable-line no-console
          };
      }
  }

  /* src/ui/explore/Omni.svelte generated by Svelte v3.14.1 */
  const file = "src/ui/explore/Omni.svelte";

  function create_fragment(ctx) {
  	let input;
  	let dispose;

  	const block = {
  		c: function create() {
  			input = element("input");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "class", "omni svelte-1cku1nd");
  			set_style(input, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			attr_dev(input, "placeholder", ctx.tru_placeholder);
  			add_location(input, file, 52, 0, 987);

  			dispose = [
  				listen_dev(input, "input", ctx.input_input_handler),
  				listen_dev(input, "keydown", ctx.keydown_handler, false, false, false),
  				listen_dev(input, "blur", ctx.execute, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, input, anchor);
  			set_input_value(input, ctx.omni);
  		},
  		p: function update(changed, ctx) {
  			if (changed.$THEME_BORDER) {
  				set_style(input, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			}

  			if (changed.tru_placeholder) {
  				attr_dev(input, "placeholder", ctx.tru_placeholder);
  			}

  			if (changed.omni && input.value !== ctx.omni) {
  				set_input_value(input, ctx.omni);
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(input);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance($$self, $$props, $$invalidate) {
  	let $tick;
  	let $THEME_BORDER;
  	validate_store(tick, "tick");
  	component_subscribe($$self, tick, $$value => $$invalidate("$tick", $tick = $$value));
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));

  	let { command = () => {
  		
  	} } = $$props;

  	let omni = ``;
  	let { system = false } = $$props;
  	const place_default = system ? `!` : `! > + -`;
  	let placeholder = place_default;

  	const calc_offset = ($t, $p) => {
  		if ($p.length < 20) return placeholder;
  		const offset = Math.floor($t / 2) % $p.length;
  		return $p.slice(-offset) + $p.slice(0, -offset);
  	};

  	const commands = {
  		"!": () => {
  			if (system) {
  				$$invalidate("placeholder", placeholder = `SYSTEM CAN ONLY FILTER!!! `);
  				return;
  			}

  			$$invalidate("placeholder", placeholder = `[ADD]+Name [MOVE]~Name/Name [DELETE]-Name`);
  		},
  		undefined: () => {
  			$$invalidate("placeholder", placeholder = place_default);
  		}
  	};

  	const execute = () => {
  		const data = [omni[0], ...omni.slice(1).split(`/`)];
  		$$invalidate("omni", omni = ``);

  		if (system) {
  			return commands[`!`]();
  		}

  		if (commands[data[0]]) commands[data[0]](data);

  		command(data, ph => {
  			$$invalidate("placeholder", placeholder = ph);
  		});
  	};

  	const writable_props = ["command", "system"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Omni> was created with unknown prop '${key}'`);
  	});

  	function input_input_handler() {
  		omni = this.value;
  		$$invalidate("omni", omni);
  	}

  	const keydown_handler = e => {
  		if (e.which !== 13) return;
  		execute();
  	};

  	$$self.$set = $$props => {
  		if ("command" in $$props) $$invalidate("command", command = $$props.command);
  		if ("system" in $$props) $$invalidate("system", system = $$props.system);
  	};

  	$$self.$capture_state = () => {
  		return {
  			command,
  			omni,
  			system,
  			placeholder,
  			tru_placeholder,
  			$tick,
  			$THEME_BORDER
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("command" in $$props) $$invalidate("command", command = $$props.command);
  		if ("omni" in $$props) $$invalidate("omni", omni = $$props.omni);
  		if ("system" in $$props) $$invalidate("system", system = $$props.system);
  		if ("placeholder" in $$props) $$invalidate("placeholder", placeholder = $$props.placeholder);
  		if ("tru_placeholder" in $$props) $$invalidate("tru_placeholder", tru_placeholder = $$props.tru_placeholder);
  		if ("$tick" in $$props) tick.set($tick = $$props.$tick);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
  	};

  	let tru_placeholder;

  	$$self.$$.update = (changed = { $tick: 1, placeholder: 1 }) => {
  		if (changed.$tick || changed.placeholder) {
  			 $$invalidate("tru_placeholder", tru_placeholder = calc_offset($tick, placeholder));
  		}
  	};

  	return {
  		command,
  		omni,
  		system,
  		execute,
  		tru_placeholder,
  		$THEME_BORDER,
  		input_input_handler,
  		keydown_handler
  	};
  }

  class Omni extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance, create_fragment, safe_not_equal, { command: 0, system: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Omni",
  			options,
  			id: create_fragment.name
  		});
  	}

  	get command() {
  		throw new Error("<Omni>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set command(value) {
  		throw new Error("<Omni>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get system() {
  		throw new Error("<Omni>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set system(value) {
  		throw new Error("<Omni>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/image/Tile.svelte generated by Svelte v3.14.1 */
  const file$1 = "src/ui/image/Tile.svelte";

  // (1:0) <script> import { tile }
  function create_catch_block(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_catch_block.name,
  		type: "catch",
  		source: "(1:0) <script> import { tile }",
  		ctx
  	});

  	return block;
  }

  // (24:28)  <img     class="tileset"     alt="tileset image"     {src}
  function create_then_block(ctx) {
  	let img;
  	let img_src_value;

  	const block = {
  		c: function create() {
  			img = element("img");
  			attr_dev(img, "class", "tileset svelte-1ifhj4a");
  			attr_dev(img, "alt", "tileset image");
  			if (img.src !== (img_src_value = ctx.src)) attr_dev(img, "src", img_src_value);
  			add_location(img, file$1, 24, 0, 353);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, img, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.image_src && img.src !== (img_src_value = ctx.src)) {
  				attr_dev(img, "src", img_src_value);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(img);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_then_block.name,
  		type: "then",
  		source: "(24:28)  <img     class=\\\"tileset\\\"     alt=\\\"tileset image\\\"     {src}",
  		ctx
  	});

  	return block;
  }

  // (1:0) <script> import { tile }
  function create_pending_block(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_pending_block.name,
  		type: "pending",
  		source: "(1:0) <script> import { tile }",
  		ctx
  	});

  	return block;
  }

  function create_fragment$1(ctx) {
  	let await_block_anchor;
  	let promise;

  	let info = {
  		ctx,
  		current: null,
  		token: null,
  		pending: create_pending_block,
  		then: create_then_block,
  		catch: create_catch_block,
  		value: "src",
  		error: "null"
  	};

  	handle_promise(promise = ctx.image_src, info);

  	const block = {
  		c: function create() {
  			await_block_anchor = empty();
  			info.block.c();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, await_block_anchor, anchor);
  			info.block.m(target, info.anchor = anchor);
  			info.mount = () => await_block_anchor.parentNode;
  			info.anchor = await_block_anchor;
  		},
  		p: function update(changed, new_ctx) {
  			ctx = new_ctx;
  			info.ctx = ctx;

  			if (changed.image_src && promise !== (promise = ctx.image_src) && handle_promise(promise, info)) ; else {
  				info.block.p(changed, assign(assign({}, ctx), info.resolved)); // nothing
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(await_block_anchor);
  			info.block.d(detaching);
  			info.token = null;
  			info = null;
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$1.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$1($$self, $$props, $$invalidate) {
  	let { data = `` } = $$props;
  	let { width = 10 } = $$props;
  	let { height = 7 } = $$props;
  	let { random = false } = $$props;
  	let { text = false } = $$props;
  	const writable_props = ["data", "width", "height", "random", "text"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tile> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("data" in $$props) $$invalidate("data", data = $$props.data);
  		if ("width" in $$props) $$invalidate("width", width = $$props.width);
  		if ("height" in $$props) $$invalidate("height", height = $$props.height);
  		if ("random" in $$props) $$invalidate("random", random = $$props.random);
  		if ("text" in $$props) $$invalidate("text", text = $$props.text);
  	};

  	$$self.$capture_state = () => {
  		return {
  			data,
  			width,
  			height,
  			random,
  			text,
  			tru_data,
  			image_src
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("data" in $$props) $$invalidate("data", data = $$props.data);
  		if ("width" in $$props) $$invalidate("width", width = $$props.width);
  		if ("height" in $$props) $$invalidate("height", height = $$props.height);
  		if ("random" in $$props) $$invalidate("random", random = $$props.random);
  		if ("text" in $$props) $$invalidate("text", text = $$props.text);
  		if ("tru_data" in $$props) $$invalidate("tru_data", tru_data = $$props.tru_data);
  		if ("image_src" in $$props) $$invalidate("image_src", image_src = $$props.image_src);
  	};

  	let tru_data;
  	let image_src;

  	$$self.$$.update = (changed = { text: 1, data: 1, width: 1, height: 1, tru_data: 1, random: 1 }) => {
  		if (changed.text || changed.data) {
  			 $$invalidate("tru_data", tru_data = text ? tile(text) : data);
  		}

  		if (changed.width || changed.height || changed.tru_data || changed.random) {
  			 $$invalidate("image_src", image_src = Tile({ width, height, data: tru_data, random }));
  		}
  	};

  	return {
  		data,
  		width,
  		height,
  		random,
  		text,
  		image_src
  	};
  }

  class Tile_1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
  			data: 0,
  			width: 0,
  			height: 0,
  			random: 0,
  			text: 0
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Tile_1",
  			options,
  			id: create_fragment$1.name
  		});
  	}

  	get data() {
  		throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set data(value) {
  		throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get width() {
  		throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set width(value) {
  		throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get height() {
  		throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set height(value) {
  		throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get random() {
  		throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set random(value) {
  		throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get text() {
  		throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set text(value) {
  		throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/Postage.svelte generated by Svelte v3.14.1 */
  const file$2 = "src/ui/weave/Postage.svelte";

  function create_fragment$2(ctx) {
  	let div;
  	let current;

  	const tile = new Tile_1({
  			props: { width: 1, height: 1, text: ctx.address },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div = element("div");
  			create_component(tile.$$.fragment);
  			attr_dev(div, "class", "postage svelte-s1jubj");
  			toggle_class(div, "running", ctx.running);
  			toggle_class(div, "rezed", ctx.rezed);
  			toggle_class(div, "system", ctx.system);
  			add_location(div, file$2, 23, 0, 408);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			mount_component(tile, div, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const tile_changes = {};
  			if (changed.address) tile_changes.text = ctx.address;
  			tile.$set(tile_changes);

  			if (changed.running) {
  				toggle_class(div, "running", ctx.running);
  			}

  			if (changed.rezed) {
  				toggle_class(div, "rezed", ctx.rezed);
  			}

  			if (changed.system) {
  				toggle_class(div, "system", ctx.system);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(tile.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(tile.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			destroy_component(tile);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$2.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$2($$self, $$props, $$invalidate) {
  	let $runnings,
  		$$unsubscribe_runnings = noop,
  		$$subscribe_runnings = () => ($$unsubscribe_runnings(), $$unsubscribe_runnings = subscribe(runnings, $$value => $$invalidate("$runnings", $runnings = $$value)), runnings);

  	let $names,
  		$$unsubscribe_names = noop,
  		$$subscribe_names = () => ($$unsubscribe_names(), $$unsubscribe_names = subscribe(names, $$value => $$invalidate("$names", $names = $$value)), names);

  	let $r,
  		$$unsubscribe_r = noop,
  		$$subscribe_r = () => ($$unsubscribe_r(), $$unsubscribe_r = subscribe(r, $$value => $$invalidate("$r", $r = $$value)), r);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_runnings());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_names());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_r());
  	let { address = `` } = $$props;
  	const [,w_id, k_id] = address.split(`/`);
  	const writable_props = ["address"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Postage> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  	};

  	$$self.$capture_state = () => {
  		return {
  			address,
  			runnings,
  			weave,
  			names,
  			r,
  			running,
  			$runnings,
  			knot,
  			$names,
  			id,
  			system,
  			rezed,
  			$r
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  		if ("runnings" in $$props) $$subscribe_runnings($$invalidate("runnings", runnings = $$props.runnings));
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("names" in $$props) $$subscribe_names($$invalidate("names", names = $$props.names));
  		if ("r" in $$props) $$subscribe_r($$invalidate("r", r = $$props.r));
  		if ("running" in $$props) $$invalidate("running", running = $$props.running);
  		if ("$runnings" in $$props) runnings.set($runnings = $$props.$runnings);
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("$names" in $$props) names.set($names = $$props.$names);
  		if ("id" in $$props) $$invalidate("id", id = $$props.id);
  		if ("system" in $$props) $$invalidate("system", system = $$props.system);
  		if ("rezed" in $$props) $$invalidate("rezed", rezed = $$props.rezed);
  		if ("$r" in $$props) r.set($r = $$props.$r);
  	};

  	let runnings;
  	let weave;
  	let names;
  	let r;
  	let running;
  	let knot;
  	let id;
  	let system;
  	let rezed;

  	$$self.$$.update = (changed = { weave: 1, $runnings: 1, $names: 1, knot: 1, $r: 1, id: 1 }) => {
  		if (changed.weave) {
  			 $$subscribe_names($$invalidate("names", names = weave.names));
  		}

  		if (changed.weave) {
  			 $$subscribe_r($$invalidate("r", r = weave.rezed));
  		}

  		if (changed.$runnings) {
  			 $$invalidate("running", running = $runnings[w_id] === true);
  		}

  		if (changed.$names) {
  			 $$invalidate("knot", knot = $names[k_id]);
  		}

  		if (changed.knot) {
  			 $$invalidate("id", id = knot ? knot.id.get() : ``);
  		}

  		if (changed.$r || changed.id) {
  			 $$invalidate("rezed", rezed = $r[id]);
  		}
  	};

  	 $$subscribe_runnings($$invalidate("runnings", runnings = Wheel.running));
  	 $$invalidate("weave", weave = Wheel.get(w_id) || Wheel.get(Wheel.SYSTEM));
  	 $$invalidate("system", system = w_id === Wheel.SYSTEM);

  	return {
  		address,
  		runnings,
  		names,
  		r,
  		running,
  		system,
  		rezed
  	};
  }

  class Postage extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$2, create_fragment$2, safe_not_equal, { address: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Postage",
  			options,
  			id: create_fragment$2.name
  		});
  	}

  	get address() {
  		throw new Error("<Postage>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set address(value) {
  		throw new Error("<Postage>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var color$1 = (node, txt_init) => {
    const handler = {
      update: (txt) => {
        const bg = Color(THEME_BG.get());
        const col = Color(color(JSON.stringify(txt)))
          .blend(bg, 0.8);

        node.style.backgroundColor = col
          .toCSS();
      }
    };

    handler.update(txt_init);
    return handler
  };

  const dark = (node, txt) => {
    const update = () => {
      node.style.backgroundColor = Color(color(JSON.stringify(txt)))
        .blend(Color(THEME_BG.get()), 0.8)
        .darkenByRatio(0.5);
    };

    update();

    return {
      update
    }
  };

  /* src/ui/weave/Picker.svelte generated by Svelte v3.14.1 */
  const file$3 = "src/ui/weave/Picker.svelte";

  // (66:0) {#if nameit}
  function create_if_block(ctx) {
  	let div4;
  	let h2;
  	let t1;
  	let div0;
  	let promise;
  	let t2;
  	let input;
  	let t3;
  	let div3;
  	let div1;
  	let t5;
  	let div2;
  	let color_action;
  	let dispose;

  	let info = {
  		ctx,
  		current: null,
  		token: null,
  		pending: create_pending_block$1,
  		then: create_then_block$1,
  		catch: create_catch_block$1,
  		value: "src",
  		error: "null"
  	};

  	handle_promise(promise = image(ctx.name), info);

  	const block = {
  		c: function create() {
  			div4 = element("div");
  			h2 = element("h2");
  			h2.textContent = "Name It!";
  			t1 = space();
  			div0 = element("div");
  			info.block.c();
  			t2 = space();
  			input = element("input");
  			t3 = space();
  			div3 = element("div");
  			div1 = element("div");
  			div1.textContent = "Cancel";
  			t5 = space();
  			div2 = element("div");
  			div2.textContent = "Plant";
  			add_location(h2, file$3, 70, 2, 1213);
  			attr_dev(div0, "class", "spirit svelte-qn01e5");
  			add_location(div0, file$3, 72, 2, 1234);
  			attr_dev(input, "class", "nameit svelte-qn01e5");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "placeholder", "Name it");
  			add_location(input, file$3, 78, 2, 1362);
  			attr_dev(div1, "class", "false svelte-qn01e5");
  			add_location(div1, file$3, 89, 4, 1567);
  			attr_dev(div2, "class", "true svelte-qn01e5");
  			add_location(div2, file$3, 90, 4, 1639);
  			attr_dev(div3, "class", "controls svelte-qn01e5");
  			add_location(div3, file$3, 88, 2, 1540);
  			attr_dev(div4, "class", "nameprompt svelte-qn01e5");
  			add_location(div4, file$3, 66, 0, 1158);

  			dispose = [
  				listen_dev(input, "input", ctx.input_input_handler),
  				listen_dev(input, "keydown", ctx.keydown_handler, false, false, false),
  				listen_dev(div1, "click", ctx.click_handler, false, false, false),
  				listen_dev(div2, "click", ctx.play_it, false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div4, anchor);
  			append_dev(div4, h2);
  			append_dev(div4, t1);
  			append_dev(div4, div0);
  			info.block.m(div0, info.anchor = null);
  			info.mount = () => div0;
  			info.anchor = null;
  			append_dev(div4, t2);
  			append_dev(div4, input);
  			set_input_value(input, ctx.name);
  			append_dev(div4, t3);
  			append_dev(div4, div3);
  			append_dev(div3, div1);
  			append_dev(div3, t5);
  			append_dev(div3, div2);
  			color_action = color$1.call(null, div4, `/${ctx.name}`) || ({});
  		},
  		p: function update(changed, new_ctx) {
  			ctx = new_ctx;
  			info.ctx = ctx;

  			if (changed.name && promise !== (promise = image(ctx.name)) && handle_promise(promise, info)) ; else {
  				info.block.p(changed, assign(assign({}, ctx), info.resolved)); // nothing
  			}

  			if (changed.name && input.value !== ctx.name) {
  				set_input_value(input, ctx.name);
  			}

  			if (is_function(color_action.update) && changed.name) color_action.update.call(null, `/${ctx.name}`);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div4);
  			info.block.d();
  			info.token = null;
  			info = null;
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block.name,
  		type: "if",
  		source: "(66:0) {#if nameit}",
  		ctx
  	});

  	return block;
  }

  // (1:0) <script> import { load, image }
  function create_catch_block$1(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_catch_block$1.name,
  		type: "catch",
  		source: "(1:0) <script> import { load, image }",
  		ctx
  	});

  	return block;
  }

  // (74:33)        <img  class="flex" {src}
  function create_then_block$1(ctx) {
  	let img;
  	let img_src_value;

  	const block = {
  		c: function create() {
  			img = element("img");
  			attr_dev(img, "class", "flex svelte-qn01e5");
  			if (img.src !== (img_src_value = ctx.src)) attr_dev(img, "src", img_src_value);
  			attr_dev(img, "alt", "fileicon");
  			add_location(img, file$3, 74, 6, 1295);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, img, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.name && img.src !== (img_src_value = ctx.src)) {
  				attr_dev(img, "src", img_src_value);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(img);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_then_block$1.name,
  		type: "then",
  		source: "(74:33)        <img  class=\\\"flex\\\" {src}",
  		ctx
  	});

  	return block;
  }

  // (1:0) <script> import { load, image }
  function create_pending_block$1(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_pending_block$1.name,
  		type: "pending",
  		source: "(1:0) <script> import { load, image }",
  		ctx
  	});

  	return block;
  }

  function create_fragment$3(ctx) {
  	let t0;
  	let div;
  	let t1;
  	let input;
  	let dispose;
  	let if_block = ctx.nameit && create_if_block(ctx);

  	const block = {
  		c: function create() {
  			if (if_block) if_block.c();
  			t0 = space();
  			div = element("div");
  			t1 = space();
  			input = element("input");
  			attr_dev(div, "class", "picker svelte-qn01e5");
  			add_location(div, file$3, 95, 0, 1711);
  			attr_dev(input, "type", "file");
  			attr_dev(input, "class", "file svelte-qn01e5");
  			input.multiple = "multiple";
  			add_location(input, file$3, 103, 0, 1811);

  			dispose = [
  				listen_dev(div, "drop", ctx.drop, false, false, false),
  				listen_dev(div, "dragover", ctx.over(true), false, false, false),
  				listen_dev(div, "dragleave", ctx.over(false), false, false, false),
  				listen_dev(input, "change", ctx.change_handler, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, t0, anchor);
  			insert_dev(target, div, anchor);
  			insert_dev(target, t1, anchor);
  			insert_dev(target, input, anchor);
  			ctx.input_binding(input);
  		},
  		p: function update(changed, ctx) {
  			if (ctx.nameit) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  				} else {
  					if_block = create_if_block(ctx);
  					if_block.c();
  					if_block.m(t0.parentNode, t0);
  				}
  			} else if (if_block) {
  				if_block.d(1);
  				if_block = null;
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(t0);
  			if (detaching) detach_dev(div);
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(input);
  			ctx.input_binding(null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$3.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$3($$self, $$props, $$invalidate) {
  	let last = {};
  	let files;
  	let nameit = false;

  	const drop = e => {
  		dragover = false;
  		const files = e.dataTransfer.files;

  		for (let i = 0; i < files.length; i++) {
  			const reader = new FileReader();

  			reader.onloadend = e => {
  				last = files[i];
  				$$invalidate("nameit", nameit = load(e.target.result));
  				if (!nameit) return;
  				$$invalidate("name", name = `${nameit.name}`);
  			};

  			reader.readAsDataURL(files[i]);
  		}

  		e.preventDefault();
  		e.stopPropagation();
  	};

  	let dragover;

  	const over = whether => e => {
  		e.dataTransfer.dropEffect = `copy`;
  		dragover = whether;
  		e.preventDefault();
  		e.stopPropagation();
  	};

  	const play_it = () => {
  		delete nameit.id;
  		Wheel.spawn({ [name]: nameit });
  		const weave = Wheel.get(name);

  		weave.update({
  			INFO: {
  				knot: `stitch`,
  				value: {
  					from: last.name,
  					"save last": last.lastModified,
  					size: last.size
  				}
  			}
  		});

  		$$invalidate("nameit", nameit = false);
  	};

  	let name;

  	function input_input_handler() {
  		name = this.value;
  		$$invalidate("name", name);
  	}

  	const keydown_handler = e => {
  		if (e.which !== 13) return;
  		play_it();
  	};

  	const click_handler = () => {
  		$$invalidate("nameit", nameit = false);
  	};

  	function input_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate("files", files = $$value);
  		});
  	}

  	const change_handler = e => {
  		console.log(e.dataTransfer, e.target);
  	};

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		if ("last" in $$props) last = $$props.last;
  		if ("files" in $$props) $$invalidate("files", files = $$props.files);
  		if ("nameit" in $$props) $$invalidate("nameit", nameit = $$props.nameit);
  		if ("dragover" in $$props) dragover = $$props.dragover;
  		if ("name" in $$props) $$invalidate("name", name = $$props.name);
  		if ("arr_knots" in $$props) arr_knots = $$props.arr_knots;
  	};

  	let arr_knots;
  	 arr_knots = Object.entries(knots);

  	return {
  		files,
  		nameit,
  		drop,
  		over,
  		play_it,
  		name,
  		input_input_handler,
  		keydown_handler,
  		click_handler,
  		input_binding,
  		change_handler
  	};
  }

  class Picker extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Picker",
  			options,
  			id: create_fragment$3.name
  		});
  	}
  }

  /* src/ui/weave/MainScreen.svelte generated by Svelte v3.14.1 */
  const file$4 = "src/ui/weave/MainScreen.svelte";

  function create_fragment$4(ctx) {
  	let div;
  	let insert_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			div = element("div");
  			attr_dev(div, "class", "main svelte-ipuen4");
  			toggle_class(div, "full", ctx.full);
  			add_location(div, file$4, 32, 0, 546);
  			dispose = listen_dev(div, "click", ctx.toggle, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			insert_action = ctx.insert.call(null, div) || ({});
  		},
  		p: function update(changed, ctx) {
  			if (changed.full) {
  				toggle_class(div, "full", ctx.full);
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (insert_action && is_function(insert_action.destroy)) insert_action.destroy();
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$4.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$4($$self, $$props, $$invalidate) {
  	let { full = false } = $$props;

  	const toggle = () => {
  		$$invalidate("full", full = !full);
  	};

  	const insert = node => ({
  		destroy: main.subscribe(canvas => {
  			if (!canvas || !canvas.style) return;
  			canvas.style.flex = 1;

  			while (node.firstChild) {
  				node.removeChild(node.firstChild);
  			}

  			node.appendChild(canvas);
  		})
  	});

  	const writable_props = ["full"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MainScreen> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("full" in $$props) $$invalidate("full", full = $$props.full);
  	};

  	$$self.$capture_state = () => {
  		return { full };
  	};

  	$$self.$inject_state = $$props => {
  		if ("full" in $$props) $$invalidate("full", full = $$props.full);
  	};

  	return { full, toggle, insert };
  }

  class MainScreen extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$4, create_fragment$4, safe_not_equal, { full: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "MainScreen",
  			options,
  			id: create_fragment$4.name
  		});
  	}

  	get full() {
  		throw new Error("<MainScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set full(value) {
  		throw new Error("<MainScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/editor/SpriteEditor.svelte generated by Svelte v3.14.1 */
  const file$5 = "src/ui/editor/SpriteEditor.svelte";

  // (37:0) {#if editing}
  function create_if_block_1(ctx) {
  	let div1;
  	let div0;
  	let div1_style_value;
  	let dispose;

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			div0 = element("div");
  			attr_dev(div0, "class", "cursor svelte-1f9yy4b");
  			set_style(div0, "transform", "translate(" + ctx.x + "px," + ctx.y + "px)");
  			add_location(div0, file$5, 51, 4, 1085);
  			attr_dev(div1, "class", "edit svelte-1f9yy4b");

  			attr_dev(div1, "style", div1_style_value = [
  				`background-image: url('${ctx.$SPRITES}');`,
  				`background-color: ${ctx.$THEME_BG};`,
  				`border: 1rem solid ${ctx.$THEME_BORDER};`
  			].join(``));

  			add_location(div1, file$5, 37, 2, 771);

  			dispose = [
  				listen_dev(div1, "click", ctx.click_handler, false, false, false),
  				listen_dev(div1, "mousemove", ctx.track, false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			append_dev(div1, div0);
  		},
  		p: function update(changed, ctx) {
  			if (changed.x || changed.y) {
  				set_style(div0, "transform", "translate(" + ctx.x + "px," + ctx.y + "px)");
  			}

  			if ((changed.$SPRITES || changed.$THEME_BG || changed.$THEME_BORDER) && div1_style_value !== (div1_style_value = [
  				`background-image: url('${ctx.$SPRITES}');`,
  				`background-color: ${ctx.$THEME_BG};`,
  				`border: 1rem solid ${ctx.$THEME_BORDER};`
  			].join(``))) {
  				attr_dev(div1, "style", div1_style_value);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div1);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1.name,
  		type: "if",
  		source: "(37:0) {#if editing}",
  		ctx
  	});

  	return block;
  }

  // (67:2) {#if value}
  function create_if_block$1(ctx) {
  	let current;

  	const tile = new Tile_1({
  			props: {
  				width: 1,
  				height: 1,
  				data: JSON.stringify(ctx.$value)
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(tile.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(tile, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const tile_changes = {};
  			if (changed.$value) tile_changes.data = JSON.stringify(ctx.$value);
  			tile.$set(tile_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(tile.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(tile.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(tile, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$1.name,
  		type: "if",
  		source: "(67:2) {#if value}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$5(ctx) {
  	let t;
  	let div;
  	let current;
  	let dispose;
  	let if_block0 = ctx.editing && create_if_block_1(ctx);
  	let if_block1 = ctx.value && create_if_block$1(ctx);

  	const block = {
  		c: function create() {
  			if (if_block0) if_block0.c();
  			t = space();
  			div = element("div");
  			if (if_block1) if_block1.c();
  			attr_dev(div, "class", "tile svelte-1f9yy4b");
  			add_location(div, file$5, 58, 0, 1216);

  			dispose = [
  				listen_dev(window, "click", ctx.blur, false, false, false),
  				listen_dev(div, "click", ctx.click_handler_1, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if (if_block0) if_block0.m(target, anchor);
  			insert_dev(target, t, anchor);
  			insert_dev(target, div, anchor);
  			if (if_block1) if_block1.m(div, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (ctx.editing) {
  				if (if_block0) {
  					if_block0.p(changed, ctx);
  				} else {
  					if_block0 = create_if_block_1(ctx);
  					if_block0.c();
  					if_block0.m(t.parentNode, t);
  				}
  			} else if (if_block0) {
  				if_block0.d(1);
  				if_block0 = null;
  			}

  			if (ctx.value) {
  				if (if_block1) {
  					if_block1.p(changed, ctx);
  					transition_in(if_block1, 1);
  				} else {
  					if_block1 = create_if_block$1(ctx);
  					if_block1.c();
  					transition_in(if_block1, 1);
  					if_block1.m(div, null);
  				}
  			} else if (if_block1) {
  				group_outros();

  				transition_out(if_block1, 1, 1, () => {
  					if_block1 = null;
  				});

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block1);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block1);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (if_block0) if_block0.d(detaching);
  			if (detaching) detach_dev(t);
  			if (detaching) detach_dev(div);
  			if (if_block1) if_block1.d();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$5.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$5($$self, $$props, $$invalidate) {
  	let $TILE_COLUMNS;
  	let $SPRITES;
  	let $THEME_BG;
  	let $THEME_BORDER;

  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	validate_store(TILE_COLUMNS, "TILE_COLUMNS");
  	component_subscribe($$self, TILE_COLUMNS, $$value => $$invalidate("$TILE_COLUMNS", $TILE_COLUMNS = $$value));
  	validate_store(SPRITES, "SPRITES");
  	component_subscribe($$self, SPRITES, $$value => $$invalidate("$SPRITES", $SPRITES = $$value));
  	validate_store(THEME_BG, "THEME_BG");
  	component_subscribe($$self, THEME_BG, $$value => $$invalidate("$THEME_BG", $THEME_BG = $$value));
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	let { value } = $$props;
  	validate_store(value, "value");
  	$$subscribe_value();
  	let { editing = false } = $$props;
  	let x = 0;
  	let y = 0;

  	const to_grid = (num, ratio) => {
  		const v = Math.round((num - ratio) / ratio);
  		return Math.max(0, Math.min(v, $TILE_COLUMNS - 1));
  	};

  	const track = e => {
  		const ratio = e.target.clientWidth / $TILE_COLUMNS;
  		$$invalidate("x", x = to_grid(e.layerX, ratio) * ratio);
  		$$invalidate("y", y = to_grid(e.layerY, ratio) * ratio);
  	};

  	const select = e => {
  		const ratio = e.target.clientWidth / $TILE_COLUMNS;
  		value.set(to_grid(e.layerX, ratio) + to_grid(e.layerY, ratio) * $TILE_COLUMNS);
  		$$invalidate("editing", editing = false);
  	};

  	const blur = () => {
  		if (editing) {
  			$$invalidate("editing", editing = false);
  		}
  	};

  	const writable_props = ["value", "editing"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SpriteEditor> was created with unknown prop '${key}'`);
  	});

  	const click_handler = e => {
  		e.preventDefault();
  		e.stopPropagation();
  		select(e);
  	};

  	const click_handler_1 = e => {
  		e.preventDefault();
  		e.stopPropagation();
  		$$invalidate("editing", editing = !editing);
  	};

  	$$self.$set = $$props => {
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("editing" in $$props) $$invalidate("editing", editing = $$props.editing);
  	};

  	$$self.$capture_state = () => {
  		return {
  			value,
  			editing,
  			x,
  			y,
  			$TILE_COLUMNS,
  			$SPRITES,
  			$THEME_BG,
  			$THEME_BORDER,
  			$value
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("editing" in $$props) $$invalidate("editing", editing = $$props.editing);
  		if ("x" in $$props) $$invalidate("x", x = $$props.x);
  		if ("y" in $$props) $$invalidate("y", y = $$props.y);
  		if ("$TILE_COLUMNS" in $$props) TILE_COLUMNS.set($TILE_COLUMNS = $$props.$TILE_COLUMNS);
  		if ("$SPRITES" in $$props) SPRITES.set($SPRITES = $$props.$SPRITES);
  		if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
  		if ("$value" in $$props) value.set($value = $$props.$value);
  	};

  	return {
  		value,
  		editing,
  		x,
  		y,
  		track,
  		select,
  		blur,
  		$SPRITES,
  		$THEME_BG,
  		$THEME_BORDER,
  		$value,
  		click_handler,
  		click_handler_1
  	};
  }

  class SpriteEditor extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$5, create_fragment$5, safe_not_equal, { value: 0, editing: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "SpriteEditor",
  			options,
  			id: create_fragment$5.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.value === undefined && !("value" in props)) {
  			console.warn("<SpriteEditor> was created without expected prop 'value'");
  		}
  	}

  	get value() {
  		throw new Error("<SpriteEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set value(value) {
  		throw new Error("<SpriteEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get editing() {
  		throw new Error("<SpriteEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set editing(value) {
  		throw new Error("<SpriteEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  // a textual representation of a WEAVE chain

  const knots$1 = {
    stream: (k) => JSON.stringify(k.value.get()),
    math: (k) => k.math.get().trim(),
    mail: (k) => k.whom.get().trim(),
    default: (k) => k.knot.get(),
    stitch: (k) => `./${k.name.get()}`,
    sprite: (k) => `@${k.value.get()}`
  };

  const knots_is = {
    sprite: (data) => {
      return data[0] === `@`
    },
    mail: (data) => {
      const ms = data.match(Wheel.REG_ID);
      if (!ms || ms.length !== 1) return false
      if (ms[0] !== data) return false
      return true
    },
    stream: (data) => {
      try {
        JSON.parse(data);
        return true
      } catch (ex) {
        return false
      }
    }
  };

  const knots_create = {
    math: (data) => ({
      knot: `math`,
      math: data
    }),
    mail: (data) => ({
      knot: `mail`,
      whom: data
    }),
    stream: (data) => ({
      knot: `stream`,
      value: JSON.parse(data)
    }),
    sprite: (data) => {
      let i = parseInt(data.slice(1));

      if (isNaN(i)) {
        i = 66;
      }

      return {
        knot: `sprite`,
        value: i
      }
    }
  };

  const what_is = (data) => {
    const entries = Object.entries(knots_is);
    for (let i = 0; i < entries.length; i++) {
      const [type, fn] = entries[i];
      if (fn(data)) return type
    }

    return `math`
  };

  const knot_create = (data) => {
    const what = what_is(data);
    return knots_create[what](data)
  };

  const translate$1 = (k, weave) => {
    if (k[0] === `#`) return k

    const knot = weave.knots.get()[k];
    if (!knot) return `stitch`

    const type = knot.knot.get();

    return knots$1[type]
      ? knots$1[type](knot)
      : type
  };

  const compile = (code, weave, address) => {
    const parts = code
      .replace(/[\r\n]/g, ``)
      .split(`=>`)
      .reverse();

    const threads_update = weave.threads.get();
    const knots = weave.knots.get();

    weave.chain(address).forEach((id) => {
      delete knots[id];
      delete threads_update[id];
    });

    weave.knots.set(knots);

    let connection = address;

    // lets create these knots
    parts.forEach((part) => {
      part = part.trim();

      if (part === ``) return

      const w_data = knot_create(part);

      const k = weave.add(w_data);

      threads_update[k.id.get()] = connection;
      connection = k.id.get();
    });

    weave.threads.set(
      threads_update
    );

    weave.validate();
    const n = weave.name.get();
    if (Wheel.running.get()[n]) {
      Wheel.restart(n);
    }
  };

  const format = (txt) => {
    txt = txt.split(`;`);

    txt = txt
      .map((i, k) => {
        i = i.trim();
        if (k !== txt.length - 1) {
          i += `;`;
        }
        if (k === txt.length - 2) {
          i += `\r\n`;
        }
        return i
      })
      .join(`\r\n`);

    txt = txt
      .split(`=>`)
      .join(`\r\n\r\n=>`);

    return txt
  };

  const condense = (link, weave) => {
    const t = translate$1(link, weave).split(`;`);
    const v = t.pop().trim();

    return t.length > 0
      ? `#${t.length} ${v}`
      : v
  };

  /* src/ui/editor/ThreadEditor.svelte generated by Svelte v3.14.1 */
  const file$6 = "src/ui/editor/ThreadEditor.svelte";

  function create_fragment$6(ctx) {
  	let textarea;
  	let textarea_style_value;
  	let focus_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			textarea = element("textarea");
  			attr_dev(textarea, "spellcheck", "false");
  			attr_dev(textarea, "class", "edit svelte-1yl1lc6");
  			attr_dev(textarea, "type", "text");
  			attr_dev(textarea, "style", textarea_style_value = `background-color: ${ctx.$THEME_BG}; border:0.5rem solid ${ctx.$THEME_BORDER};`);
  			add_location(textarea, file$6, 19, 0, 310);

  			dispose = [
  				listen_dev(textarea, "input", ctx.textarea_input_handler),
  				listen_dev(textarea, "click", click_handler, false, false, false),
  				listen_dev(textarea, "keydown", ctx.keydown_handler, false, false, false),
  				listen_dev(textarea, "blur", ctx.blur_handler, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, textarea, anchor);
  			set_input_value(textarea, ctx.code);
  			focus_action = ctx.focus.call(null, textarea) || ({});
  		},
  		p: function update(changed, ctx) {
  			if ((changed.$THEME_BG || changed.$THEME_BORDER) && textarea_style_value !== (textarea_style_value = `background-color: ${ctx.$THEME_BG}; border:0.5rem solid ${ctx.$THEME_BORDER};`)) {
  				attr_dev(textarea, "style", textarea_style_value);
  			}

  			if (changed.code) {
  				set_input_value(textarea, ctx.code);
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(textarea);
  			if (focus_action && is_function(focus_action.destroy)) focus_action.destroy();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$6.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  const click_handler = e => e.stopPropagation();

  function instance$6($$self, $$props, $$invalidate) {
  	let $THEME_BG;
  	let $THEME_BORDER;
  	validate_store(THEME_BG, "THEME_BG");
  	component_subscribe($$self, THEME_BG, $$value => $$invalidate("$THEME_BG", $THEME_BG = $$value));
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	let { code } = $$props;
  	let { weave } = $$props;
  	let { address } = $$props;

  	let { ondone = () => {
  		
  	} } = $$props;

  	const focus = node => node.focus();

  	const execute = () => {
  		ondone();
  		compile(code, weave, address);
  	};

  	const writable_props = ["code", "weave", "address", "ondone"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ThreadEditor> was created with unknown prop '${key}'`);
  	});

  	function textarea_input_handler() {
  		code = this.value;
  		$$invalidate("code", code);
  	}

  	const keydown_handler = e => {
  		if (e.ctrlKey && e.which === 13) {
  			execute();
  			e.preventDefault();
  			e.stopPropagation();
  		}
  	};

  	const blur_handler = e => {
  		execute();
  	};

  	$$self.$set = $$props => {
  		if ("code" in $$props) $$invalidate("code", code = $$props.code);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  		if ("ondone" in $$props) $$invalidate("ondone", ondone = $$props.ondone);
  	};

  	$$self.$capture_state = () => {
  		return {
  			code,
  			weave,
  			address,
  			ondone,
  			$THEME_BG,
  			$THEME_BORDER
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("code" in $$props) $$invalidate("code", code = $$props.code);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  		if ("ondone" in $$props) $$invalidate("ondone", ondone = $$props.ondone);
  		if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
  	};

  	return {
  		code,
  		weave,
  		address,
  		ondone,
  		focus,
  		execute,
  		$THEME_BG,
  		$THEME_BORDER,
  		textarea_input_handler,
  		keydown_handler,
  		blur_handler
  	};
  }

  class ThreadEditor extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$6, create_fragment$6, safe_not_equal, { code: 0, weave: 0, address: 0, ondone: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "ThreadEditor",
  			options,
  			id: create_fragment$6.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.code === undefined && !("code" in props)) {
  			console.warn("<ThreadEditor> was created without expected prop 'code'");
  		}

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<ThreadEditor> was created without expected prop 'weave'");
  		}

  		if (ctx.address === undefined && !("address" in props)) {
  			console.warn("<ThreadEditor> was created without expected prop 'address'");
  		}
  	}

  	get code() {
  		throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set code(value) {
  		throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get weave() {
  		throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get address() {
  		throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set address(value) {
  		throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get ondone() {
  		throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set ondone(value) {
  		throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/thread/Knot.svelte generated by Svelte v3.14.1 */
  const file$7 = "src/ui/thread/Knot.svelte";

  // (19:0) {:else}
  function create_else_block(ctx) {
  	let div;
  	let t_value = condense(ctx.id, ctx.weave) + "";
  	let t;

  	const block = {
  		c: function create() {
  			div = element("div");
  			t = text(t_value);
  			attr_dev(div, "class", "pad svelte-5iz8dj");
  			add_location(div, file$7, 19, 2, 340);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			append_dev(div, t);
  		},
  		p: function update(changed, ctx) {
  			if ((changed.id || changed.weave) && t_value !== (t_value = condense(ctx.id, ctx.weave) + "")) set_data_dev(t, t_value);
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block.name,
  		type: "else",
  		source: "(19:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (17:0) {#if knot_view[$type]}
  function create_if_block$2(ctx) {
  	let switch_instance_anchor;
  	let current;
  	var switch_value = ctx.knot_view[ctx.$type];

  	function switch_props(ctx) {
  		return {
  			props: { value: ctx.k.value },
  			$$inline: true
  		};
  	}

  	if (switch_value) {
  		var switch_instance = new switch_value(switch_props(ctx));
  	}

  	const block = {
  		c: function create() {
  			if (switch_instance) create_component(switch_instance.$$.fragment);
  			switch_instance_anchor = empty();
  		},
  		m: function mount(target, anchor) {
  			if (switch_instance) {
  				mount_component(switch_instance, target, anchor);
  			}

  			insert_dev(target, switch_instance_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const switch_instance_changes = {};
  			if (changed.k) switch_instance_changes.value = ctx.k.value;

  			if (switch_value !== (switch_value = ctx.knot_view[ctx.$type])) {
  				if (switch_instance) {
  					group_outros();
  					const old_component = switch_instance;

  					transition_out(old_component.$$.fragment, 1, 0, () => {
  						destroy_component(old_component, 1);
  					});

  					check_outros();
  				}

  				if (switch_value) {
  					switch_instance = new switch_value(switch_props(ctx));
  					create_component(switch_instance.$$.fragment);
  					transition_in(switch_instance.$$.fragment, 1);
  					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
  				} else {
  					switch_instance = null;
  				}
  			} else if (switch_value) {
  				switch_instance.$set(switch_instance_changes);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(switch_instance_anchor);
  			if (switch_instance) destroy_component(switch_instance, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$2.name,
  		type: "if",
  		source: "(17:0) {#if knot_view[$type]}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$7(ctx) {
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block$2, create_else_block];
  	const if_blocks = [];

  	function select_block_type(changed, ctx) {
  		if (ctx.knot_view[ctx.$type]) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type(null, ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type(changed, ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(changed, ctx);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(if_block_anchor.parentNode, if_block_anchor);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$7.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$7($$self, $$props, $$invalidate) {
  	let $type,
  		$$unsubscribe_type = noop,
  		$$subscribe_type = () => ($$unsubscribe_type(), $$unsubscribe_type = subscribe(type, $$value => $$invalidate("$type", $type = $$value)), type);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_type());
  	let { id } = $$props;
  	let { weave } = $$props;
  	const knot_view = { sprite: SpriteEditor };
  	const writable_props = ["id", "weave"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Knot> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("id" in $$props) $$invalidate("id", id = $$props.id);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  	};

  	$$self.$capture_state = () => {
  		return { id, weave, k, type, $type };
  	};

  	$$self.$inject_state = $$props => {
  		if ("id" in $$props) $$invalidate("id", id = $$props.id);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("k" in $$props) $$invalidate("k", k = $$props.k);
  		if ("type" in $$props) $$subscribe_type($$invalidate("type", type = $$props.type));
  		if ("$type" in $$props) type.set($type = $$props.$type);
  	};

  	let k;
  	let type;

  	$$self.$$.update = (changed = { weave: 1, id: 1, k: 1 }) => {
  		if (changed.weave || changed.id) {
  			 $$invalidate("k", k = weave.get_id(id));
  		}

  		if (changed.k) {
  			 $$subscribe_type($$invalidate("type", type = k.knot));
  		}
  	};

  	return { id, weave, knot_view, k, type, $type };
  }

  class Knot$1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$7, create_fragment$7, safe_not_equal, { id: 0, weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Knot",
  			options,
  			id: create_fragment$7.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.id === undefined && !("id" in props)) {
  			console.warn("<Knot> was created without expected prop 'id'");
  		}

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Knot> was created without expected prop 'weave'");
  		}
  	}

  	get id() {
  		throw new Error("<Knot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set id(value) {
  		throw new Error("<Knot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get weave() {
  		throw new Error("<Knot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Knot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/explore/Thread.svelte generated by Svelte v3.14.1 */
  const file$8 = "src/ui/explore/Thread.svelte";

  function get_each_context(ctx, list, i) {
  	const child_ctx = Object.create(ctx);
  	child_ctx.link = list[i];
  	return child_ctx;
  }

  // (53:0) {#if editing}
  function create_if_block_1$1(ctx) {
  	let current;

  	const threadeditor = new ThreadEditor({
  			props: {
  				code: ctx.edit,
  				ondone: ctx.execute,
  				weave: ctx.weave,
  				address: ctx.address
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(threadeditor.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(threadeditor, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const threadeditor_changes = {};
  			if (changed.edit) threadeditor_changes.code = ctx.edit;
  			if (changed.weave) threadeditor_changes.weave = ctx.weave;
  			if (changed.address) threadeditor_changes.address = ctx.address;
  			threadeditor.$set(threadeditor_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(threadeditor.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(threadeditor.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(threadeditor, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1$1.name,
  		type: "if",
  		source: "(53:0) {#if editing}",
  		ctx
  	});

  	return block;
  }

  // (70:4) {:else}
  function create_else_block$1(ctx) {
  	let div;
  	let t;
  	let color_action;
  	let current;

  	const knot = new Knot$1({
  			props: { weave: ctx.weave, id: ctx.link },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div = element("div");
  			create_component(knot.$$.fragment);
  			t = space();
  			attr_dev(div, "class", "thread svelte-ecbq6y");
  			attr_dev(div, "style", ctx.style);
  			toggle_class(div, "active", ctx.$feed[`${ctx.weave.name.get()}/${ctx.link}`] > ctx.time_cut);
  			add_location(div, file$8, 70, 4, 1506);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			mount_component(knot, div, null);
  			append_dev(div, t);
  			color_action = color$1.call(null, div, condense(ctx.link, ctx.weave)) || ({});
  			current = true;
  		},
  		p: function update(changed, new_ctx) {
  			ctx = new_ctx;
  			const knot_changes = {};
  			if (changed.weave) knot_changes.weave = ctx.weave;
  			if (changed.tru_thread) knot_changes.id = ctx.link;
  			knot.$set(knot_changes);

  			if (!current || changed.style) {
  				attr_dev(div, "style", ctx.style);
  			}

  			if (is_function(color_action.update) && (changed.tru_thread || changed.weave)) color_action.update.call(null, condense(ctx.link, ctx.weave));

  			if (changed.$feed || changed.weave || changed.tru_thread || changed.time_cut) {
  				toggle_class(div, "active", ctx.$feed[`${ctx.weave.name.get()}/${ctx.link}`] > ctx.time_cut);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(knot.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(knot.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			destroy_component(knot);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$1.name,
  		type: "else",
  		source: "(70:4) {:else}",
  		ctx
  	});

  	return block;
  }

  // (62:4) {#if link[0] === `#`}
  function create_if_block$3(ctx) {
  	let div;
  	let t0_value = ctx.link + "";
  	let t0;
  	let t1;

  	const block = {
  		c: function create() {
  			div = element("div");
  			t0 = text(t0_value);
  			t1 = space();
  			attr_dev(div, "class", "thread svelte-ecbq6y");
  			attr_dev(div, "style", ctx.style);
  			toggle_class(div, "active", ctx.chain.some(ctx.func));
  			add_location(div, file$8, 62, 6, 1317);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			append_dev(div, t0);
  			append_dev(div, t1);
  		},
  		p: function update(changed, ctx) {
  			if (changed.tru_thread && t0_value !== (t0_value = ctx.link + "")) set_data_dev(t0, t0_value);

  			if (changed.style) {
  				attr_dev(div, "style", ctx.style);
  			}

  			if (changed.chain || changed.$feed || changed.weave || changed.time_cut) {
  				toggle_class(div, "active", ctx.chain.some(ctx.func));
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$3.name,
  		type: "if",
  		source: "(62:4) {#if link[0] === `#`}",
  		ctx
  	});

  	return block;
  }

  // (61:2) {#each tru_thread as link}
  function create_each_block(ctx) {
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block$3, create_else_block$1];
  	const if_blocks = [];

  	function select_block_type(changed, ctx) {
  		if (ctx.link[0] === `#`) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type(null, ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		m: function mount(target, anchor) {
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type(changed, ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(changed, ctx);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(if_block_anchor.parentNode, if_block_anchor);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block.name,
  		type: "each",
  		source: "(61:2) {#each tru_thread as link}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$8(ctx) {
  	let t0;
  	let div0;
  	let t1;
  	let div1;
  	let current;
  	let dispose;
  	let if_block = ctx.editing && create_if_block_1$1(ctx);
  	let each_value = ctx.tru_thread;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
  	}

  	const out = i => transition_out(each_blocks[i], 1, 1, () => {
  		each_blocks[i] = null;
  	});

  	const block = {
  		c: function create() {
  			if (if_block) if_block.c();
  			t0 = space();
  			div0 = element("div");

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			t1 = space();
  			div1 = element("div");
  			attr_dev(div0, "class", "spot svelte-ecbq6y");
  			add_location(div0, file$8, 56, 0, 1213);
  			attr_dev(div1, "class", "cap svelte-ecbq6y");
  			add_location(div1, file$8, 83, 0, 1734);

  			dispose = [
  				listen_dev(div0, "click", ctx.do_edit, false, false, false),
  				listen_dev(div1, "click", ctx.do_edit, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, t0, anchor);
  			insert_dev(target, div0, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div0, null);
  			}

  			insert_dev(target, t1, anchor);
  			insert_dev(target, div1, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (ctx.editing) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block_1$1(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(t0.parentNode, t0);
  				}
  			} else if (if_block) {
  				group_outros();

  				transition_out(if_block, 1, 1, () => {
  					if_block = null;
  				});

  				check_outros();
  			}

  			if (changed.tru_thread || changed.style || changed.chain || changed.$feed || changed.weave || changed.time_cut || changed.condense) {
  				each_value = ctx.tru_thread;
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  						transition_in(each_blocks[i], 1);
  					} else {
  						each_blocks[i] = create_each_block(child_ctx);
  						each_blocks[i].c();
  						transition_in(each_blocks[i], 1);
  						each_blocks[i].m(div0, null);
  					}
  				}

  				group_outros();

  				for (i = each_value.length; i < each_blocks.length; i += 1) {
  					out(i);
  				}

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);

  			for (let i = 0; i < each_value.length; i += 1) {
  				transition_in(each_blocks[i]);
  			}

  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			each_blocks = each_blocks.filter(Boolean);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				transition_out(each_blocks[i]);
  			}

  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(t0);
  			if (detaching) detach_dev(div0);
  			destroy_each(each_blocks, detaching);
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(div1);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$8.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$8($$self, $$props, $$invalidate) {
  	let $threads,
  		$$unsubscribe_threads = noop,
  		$$subscribe_threads = () => ($$unsubscribe_threads(), $$unsubscribe_threads = subscribe(threads, $$value => $$invalidate("$threads", $threads = $$value)), threads);

  	let $tick;
  	let $THEME_BORDER;
  	let $THEME_BG;

  	let $feed,
  		$$unsubscribe_feed = noop,
  		$$subscribe_feed = () => ($$unsubscribe_feed(), $$unsubscribe_feed = subscribe(feed, $$value => $$invalidate("$feed", $feed = $$value)), feed);

  	validate_store(tick, "tick");
  	component_subscribe($$self, tick, $$value => $$invalidate("$tick", $tick = $$value));
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	validate_store(THEME_BG, "THEME_BG");
  	component_subscribe($$self, THEME_BG, $$value => $$invalidate("$THEME_BG", $THEME_BG = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_threads());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_feed());
  	let { channel } = $$props;
  	let { stitch } = $$props;
  	let { weave } = $$props;
  	let editing = false;
  	let edit = ``;

  	const execute = () => {
  		if (!editing) return;
  		$$invalidate("editing", editing = false);
  	};

  	const do_edit = e => {
  		e.preventDefault();
  		e.stopPropagation();
  		if (weave.name.get() === Wheel.SYSTEM) return;
  		if (editing) return;
  		$$invalidate("editing", editing = true);
  		$$invalidate("edit", edit = format(weave.chain(address).slice(0, -1).map(i => translate$1(i, weave)).join(` => `)));
  	};

  	const writable_props = ["channel", "stitch", "weave"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Thread> was created with unknown prop '${key}'`);
  	});

  	const func = item => $feed[`${weave.name.get()}/${item}`] > time_cut;

  	$$self.$set = $$props => {
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  	};

  	$$self.$capture_state = () => {
  		return {
  			channel,
  			stitch,
  			weave,
  			editing,
  			edit,
  			feed,
  			address,
  			threads,
  			chain,
  			$threads,
  			boxes,
  			time_cut,
  			$tick,
  			tru_thread,
  			style,
  			$THEME_BORDER,
  			$THEME_BG,
  			$feed
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("editing" in $$props) $$invalidate("editing", editing = $$props.editing);
  		if ("edit" in $$props) $$invalidate("edit", edit = $$props.edit);
  		if ("feed" in $$props) $$subscribe_feed($$invalidate("feed", feed = $$props.feed));
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  		if ("threads" in $$props) $$subscribe_threads($$invalidate("threads", threads = $$props.threads));
  		if ("chain" in $$props) $$invalidate("chain", chain = $$props.chain);
  		if ("$threads" in $$props) threads.set($threads = $$props.$threads);
  		if ("boxes" in $$props) boxes = $$props.boxes;
  		if ("time_cut" in $$props) $$invalidate("time_cut", time_cut = $$props.time_cut);
  		if ("$tick" in $$props) tick.set($tick = $$props.$tick);
  		if ("tru_thread" in $$props) $$invalidate("tru_thread", tru_thread = $$props.tru_thread);
  		if ("style" in $$props) $$invalidate("style", style = $$props.style);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
  		if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
  		if ("$feed" in $$props) feed.set($feed = $$props.$feed);
  	};

  	let feed;
  	let address;
  	let threads;
  	let chain;
  	let boxes;
  	let time_cut;
  	let tru_thread;
  	let style;

  	$$self.$$.update = (changed = { stitch: 1, channel: 1, weave: 1, $threads: 1, address: 1, chain: 1, $tick: 1, $THEME_BORDER: 1, $THEME_BG: 1 }) => {
  		if (changed.stitch || changed.channel) {
  			 $$invalidate("address", address = `${stitch.id.get()}/${channel[0]}`);
  		}

  		if (changed.weave) {
  			 $$subscribe_threads($$invalidate("threads", threads = weave.threads));
  		}

  		if (changed.$threads || changed.weave || changed.address) {
  			 $$invalidate("chain", chain = $threads && weave.chain(address).slice(0, -1));
  		}

  		if (changed.chain || changed.weave) {
  			 boxes = chain.map(i => translate$1(i, weave)).join(` => `);
  		}

  		if (changed.$tick) {
  			 $$invalidate("time_cut", time_cut = $tick && Date.now() - 1000);
  		}

  		if (changed.chain) {
  			 $$invalidate("tru_thread", tru_thread = chain);
  		}

  		if (changed.$THEME_BORDER || changed.$THEME_BG) {
  			 $$invalidate("style", style = [
  				`border: 0.25rem solid ${$THEME_BORDER};`,
  				`background-color: ${$THEME_BG};`
  			].join(``));
  		}
  	};

  	 $$subscribe_feed($$invalidate("feed", feed = Wheel.feed));

  	return {
  		channel,
  		stitch,
  		weave,
  		editing,
  		edit,
  		execute,
  		do_edit,
  		feed,
  		address,
  		threads,
  		chain,
  		time_cut,
  		tru_thread,
  		style,
  		$feed,
  		func
  	};
  }

  class Thread extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$8, create_fragment$8, safe_not_equal, { channel: 0, stitch: 0, weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Thread",
  			options,
  			id: create_fragment$8.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.channel === undefined && !("channel" in props)) {
  			console.warn("<Thread> was created without expected prop 'channel'");
  		}

  		if (ctx.stitch === undefined && !("stitch" in props)) {
  			console.warn("<Thread> was created without expected prop 'stitch'");
  		}

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Thread> was created without expected prop 'weave'");
  		}
  	}

  	get channel() {
  		throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set channel(value) {
  		throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get stitch() {
  		throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set stitch(value) {
  		throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get weave() {
  		throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/explore/Channel.svelte generated by Svelte v3.14.1 */
  const file$9 = "src/ui/explore/Channel.svelte";

  // (60:0) {:else}
  function create_else_block_1(ctx) {
  	let input;
  	let focusd_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			input = element("input");
  			attr_dev(input, "class", "edit svelte-hnppq9");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "placeholder", "JSON PLZ");
  			add_location(input, file$9, 60, 2, 997);

  			dispose = [
  				listen_dev(input, "input", ctx.input_input_handler),
  				listen_dev(input, "keydown", ctx.keydown_handler, false, false, false),
  				listen_dev(input, "blur", ctx.blur_handler, false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, input, anchor);
  			set_input_value(input, ctx.val);
  			focusd_action = ctx.focusd.call(null, input) || ({});
  		},
  		p: function update(changed, ctx) {
  			if (changed.val && input.value !== ctx.val) {
  				set_input_value(input, ctx.val);
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(input);
  			if (focusd_action && is_function(focusd_action.destroy)) focusd_action.destroy();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block_1.name,
  		type: "else",
  		source: "(60:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (46:0) {#if !editing}
  function create_if_block$4(ctx) {
  	let div;
  	let t0;
  	let t1;
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block_1$2, create_else_block$2];
  	const if_blocks = [];

  	function select_block_type_1(changed, ctx) {
  		if (ctx.key === `sprite`) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type_1(null, ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			div = element("div");
  			t0 = text(ctx.key);
  			t1 = space();
  			if_block.c();
  			if_block_anchor = empty();
  			attr_dev(div, "class", "key svelte-hnppq9");
  			add_location(div, file$9, 46, 2, 804);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			append_dev(div, t0);
  			insert_dev(target, t1, anchor);
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (!current || changed.key) set_data_dev(t0, ctx.key);
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type_1(changed, ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(changed, ctx);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(if_block_anchor.parentNode, if_block_anchor);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (detaching) detach_dev(t1);
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$4.name,
  		type: "if",
  		source: "(46:0) {#if !editing}",
  		ctx
  	});

  	return block;
  }

  // (53:2) {:else}
  function create_else_block$2(ctx) {
  	let div;
  	let t_value = JSON.stringify(ctx.$value) + "";
  	let t;

  	const block = {
  		c: function create() {
  			div = element("div");
  			t = text(t_value);
  			attr_dev(div, "class", "value svelte-hnppq9");
  			add_location(div, file$9, 53, 2, 908);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			append_dev(div, t);
  		},
  		p: function update(changed, ctx) {
  			if (changed.$value && t_value !== (t_value = JSON.stringify(ctx.$value) + "")) set_data_dev(t, t_value);
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$2.name,
  		type: "else",
  		source: "(53:2) {:else}",
  		ctx
  	});

  	return block;
  }

  // (51:2) {#if key === `sprite`}
  function create_if_block_1$2(ctx) {
  	let current;

  	const spriteeditor = new SpriteEditor({
  			props: { value: ctx.value },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(spriteeditor.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(spriteeditor, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const spriteeditor_changes = {};
  			if (changed.value) spriteeditor_changes.value = ctx.value;
  			spriteeditor.$set(spriteeditor_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(spriteeditor.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(spriteeditor.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(spriteeditor, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1$2.name,
  		type: "if",
  		source: "(51:2) {#if key === `sprite`}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$9(ctx) {
  	let div;
  	let t;
  	let current_block_type_index;
  	let if_block;
  	let div_class_value;
  	let color_action;
  	let current;
  	let dispose;

  	const thread = new Thread({
  			props: {
  				channel: ctx.channel,
  				stitch: ctx.stitch,
  				weave: ctx.weave
  			},
  			$$inline: true
  		});

  	const if_block_creators = [create_if_block$4, create_else_block_1];
  	const if_blocks = [];

  	function select_block_type(changed, ctx) {
  		if (!ctx.editing) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type(null, ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			div = element("div");
  			create_component(thread.$$.fragment);
  			t = space();
  			if_block.c();
  			attr_dev(div, "class", div_class_value = "channel " + ctx.side + " svelte-hnppq9");
  			attr_dev(div, "style", ctx.$THEME_STYLE);
  			add_location(div, file$9, 35, 0, 584);
  			dispose = listen_dev(div, "click", ctx.click_handler, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			mount_component(thread, div, null);
  			append_dev(div, t);
  			if_blocks[current_block_type_index].m(div, null);
  			color_action = color$1.call(null, div, ctx.stitch.name.get()) || ({});
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const thread_changes = {};
  			if (changed.channel) thread_changes.channel = ctx.channel;
  			if (changed.stitch) thread_changes.stitch = ctx.stitch;
  			if (changed.weave) thread_changes.weave = ctx.weave;
  			thread.$set(thread_changes);
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type(changed, ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(changed, ctx);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(div, null);
  			}

  			if (!current || changed.side && div_class_value !== (div_class_value = "channel " + ctx.side + " svelte-hnppq9")) {
  				attr_dev(div, "class", div_class_value);
  			}

  			if (!current || changed.$THEME_STYLE) {
  				attr_dev(div, "style", ctx.$THEME_STYLE);
  			}

  			if (is_function(color_action.update) && changed.stitch) color_action.update.call(null, ctx.stitch.name.get());
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(thread.$$.fragment, local);
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(thread.$$.fragment, local);
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			destroy_component(thread);
  			if_blocks[current_block_type_index].d();
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$9.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$9($$self, $$props, $$invalidate) {
  	let $THEME_STYLE;

  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	validate_store(THEME_STYLE, "THEME_STYLE");
  	component_subscribe($$self, THEME_STYLE, $$value => $$invalidate("$THEME_STYLE", $THEME_STYLE = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	let { stitch } = $$props;
  	let { weave } = $$props;
  	let { channel } = $$props;
  	let { side = `in` } = $$props;
  	let { focus = false } = $$props;

  	let { executed = () => {
  		
  	} } = $$props;

  	let val = ``;

  	const execute = () => {
  		$$invalidate("editing", editing = false);

  		try {
  			value.set(JSON.parse(val));
  		} catch(ex) {
  			
  		}

  		$$invalidate("val", val = ``);
  		executed();
  	};

  	const focusd = node => {
  		node.focus();
  	};

  	const writable_props = ["stitch", "weave", "channel", "side", "focus", "executed"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Channel> was created with unknown prop '${key}'`);
  	});

  	function input_input_handler() {
  		val = this.value;
  		$$invalidate("val", val);
  	}

  	const keydown_handler = ({ which }) => {
  		if (which !== 13) return;
  		execute();
  	};

  	const blur_handler = () => {
  		execute();
  	};

  	const click_handler = () => {
  		$$invalidate("editing", editing = true);
  		$$invalidate("val", val = JSON.stringify($value));
  	};

  	$$self.$set = $$props => {
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("side" in $$props) $$invalidate("side", side = $$props.side);
  		if ("focus" in $$props) $$invalidate("focus", focus = $$props.focus);
  		if ("executed" in $$props) $$invalidate("executed", executed = $$props.executed);
  	};

  	$$self.$capture_state = () => {
  		return {
  			stitch,
  			weave,
  			channel,
  			side,
  			focus,
  			executed,
  			val,
  			key,
  			value,
  			editing,
  			$THEME_STYLE,
  			$value
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("side" in $$props) $$invalidate("side", side = $$props.side);
  		if ("focus" in $$props) $$invalidate("focus", focus = $$props.focus);
  		if ("executed" in $$props) $$invalidate("executed", executed = $$props.executed);
  		if ("val" in $$props) $$invalidate("val", val = $$props.val);
  		if ("key" in $$props) $$invalidate("key", key = $$props.key);
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("editing" in $$props) $$invalidate("editing", editing = $$props.editing);
  		if ("$THEME_STYLE" in $$props) THEME_STYLE.set($THEME_STYLE = $$props.$THEME_STYLE);
  		if ("$value" in $$props) value.set($value = $$props.$value);
  	};

  	let key;
  	let value;
  	let editing;

  	$$self.$$.update = (changed = { channel: 1, focus: 1 }) => {
  		if (changed.channel) {
  			 $$invalidate("key", [key, value] = channel, key, $$subscribe_value($$invalidate("value", value)));
  		}

  		if (changed.focus) {
  			 $$invalidate("editing", editing = focus);
  		}
  	};

  	return {
  		stitch,
  		weave,
  		channel,
  		side,
  		focus,
  		executed,
  		val,
  		execute,
  		focusd,
  		key,
  		value,
  		editing,
  		$THEME_STYLE,
  		$value,
  		input_input_handler,
  		keydown_handler,
  		blur_handler,
  		click_handler
  	};
  }

  class Channel extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
  			stitch: 0,
  			weave: 0,
  			channel: 0,
  			side: 0,
  			focus: 0,
  			executed: 0
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Channel",
  			options,
  			id: create_fragment$9.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.stitch === undefined && !("stitch" in props)) {
  			console.warn("<Channel> was created without expected prop 'stitch'");
  		}

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Channel> was created without expected prop 'weave'");
  		}

  		if (ctx.channel === undefined && !("channel" in props)) {
  			console.warn("<Channel> was created without expected prop 'channel'");
  		}
  	}

  	get stitch() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set stitch(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get weave() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get channel() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set channel(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get side() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set side(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get focus() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set focus(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get executed() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set executed(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/explore/Stitch.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1 } = globals;
  const file$a = "src/ui/explore/Stitch.svelte";

  function get_each_context$1(ctx, list, i) {
  	const child_ctx = Object_1.create(ctx);
  	child_ctx.channel = list[i];
  	return child_ctx;
  }

  // (53:0) {#if open}
  function create_if_block$5(ctx) {
  	let div;
  	let current;
  	let each_value = ctx.chans;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
  	}

  	const out = i => transition_out(each_blocks[i], 1, 1, () => {
  		each_blocks[i] = null;
  	});

  	const block = {
  		c: function create() {
  			div = element("div");

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div, "class", "chans svelte-13qotmq");
  			add_location(div, file$a, 53, 2, 991);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.filter || changed.chans || changed.stitch || changed.weave) {
  				each_value = ctx.chans;
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context$1(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  						transition_in(each_blocks[i], 1);
  					} else {
  						each_blocks[i] = create_each_block$1(child_ctx);
  						each_blocks[i].c();
  						transition_in(each_blocks[i], 1);
  						each_blocks[i].m(div, null);
  					}
  				}

  				group_outros();

  				for (i = each_value.length; i < each_blocks.length; i += 1) {
  					out(i);
  				}

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;

  			for (let i = 0; i < each_value.length; i += 1) {
  				transition_in(each_blocks[i]);
  			}

  			current = true;
  		},
  		o: function outro(local) {
  			each_blocks = each_blocks.filter(Boolean);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				transition_out(each_blocks[i]);
  			}

  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			destroy_each(each_blocks, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$5.name,
  		type: "if",
  		source: "(53:0) {#if open}",
  		ctx
  	});

  	return block;
  }

  // (56:4) {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}
  function create_if_block_1$3(ctx) {
  	let current;

  	const channel = new Channel({
  			props: {
  				channel: ctx.channel,
  				stitch: ctx.stitch,
  				weave: ctx.weave
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(channel.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(channel, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const channel_changes = {};
  			if (changed.chans) channel_changes.channel = ctx.channel;
  			if (changed.stitch) channel_changes.stitch = ctx.stitch;
  			if (changed.weave) channel_changes.weave = ctx.weave;
  			channel.$set(channel_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(channel.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(channel.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(channel, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1$3.name,
  		type: "if",
  		source: "(56:4) {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}",
  		ctx
  	});

  	return block;
  }

  // (55:2) {#each chans as channel}
  function create_each_block$1(ctx) {
  	let show_if = ctx.filter.length === 0 || ctx.channel.name.indexOf(ctx.filter[0]) !== -1;
  	let if_block_anchor;
  	let current;
  	let if_block = show_if && create_if_block_1$3(ctx);

  	const block = {
  		c: function create() {
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  		},
  		m: function mount(target, anchor) {
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.filter || changed.chans) show_if = ctx.filter.length === 0 || ctx.channel.name.indexOf(ctx.filter[0]) !== -1;

  			if (show_if) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block_1$3(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(if_block_anchor.parentNode, if_block_anchor);
  				}
  			} else if (if_block) {
  				group_outros();

  				transition_out(if_block, 1, 1, () => {
  					if_block = null;
  				});

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block$1.name,
  		type: "each",
  		source: "(55:2) {#each chans as channel}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$a(ctx) {
  	let div2;
  	let div0;
  	let t0;
  	let t1;
  	let div1;
  	let color_action;
  	let t2;
  	let if_block_anchor;
  	let current;
  	let dispose;

  	const postage = new Postage({
  			props: { address: `/${ctx.$w_name}/${ctx.$name}` },
  			$$inline: true
  		});

  	let if_block = ctx.open && create_if_block$5(ctx);

  	const block = {
  		c: function create() {
  			div2 = element("div");
  			div0 = element("div");
  			t0 = text(ctx.$name);
  			t1 = space();
  			div1 = element("div");
  			create_component(postage.$$.fragment);
  			t2 = space();
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  			attr_dev(div0, "class", "name svelte-13qotmq");
  			add_location(div0, file$a, 42, 2, 831);
  			attr_dev(div1, "class", "postage svelte-13qotmq");
  			add_location(div1, file$a, 46, 2, 872);
  			attr_dev(div2, "class", "stitch svelte-13qotmq");
  			set_style(div2, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			toggle_class(div2, "open", ctx.open);
  			add_location(div2, file$a, 36, 0, 723);
  			dispose = listen_dev(div1, "click", ctx.toggle, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div2, anchor);
  			append_dev(div2, div0);
  			append_dev(div0, t0);
  			append_dev(div2, t1);
  			append_dev(div2, div1);
  			mount_component(postage, div1, null);
  			color_action = color$1.call(null, div2, ctx.$name) || ({});
  			insert_dev(target, t2, anchor);
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (!current || changed.$name) set_data_dev(t0, ctx.$name);
  			const postage_changes = {};
  			if (changed.$w_name || changed.$name) postage_changes.address = `/${ctx.$w_name}/${ctx.$name}`;
  			postage.$set(postage_changes);

  			if (!current || changed.$THEME_BORDER) {
  				set_style(div2, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			}

  			if (is_function(color_action.update) && changed.$name) color_action.update.call(null, ctx.$name);

  			if (changed.open) {
  				toggle_class(div2, "open", ctx.open);
  			}

  			if (ctx.open) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block$5(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(if_block_anchor.parentNode, if_block_anchor);
  				}
  			} else if (if_block) {
  				group_outros();

  				transition_out(if_block, 1, 1, () => {
  					if_block = null;
  				});

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(postage.$$.fragment, local);
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(postage.$$.fragment, local);
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div2);
  			destroy_component(postage);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			if (detaching) detach_dev(t2);
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$a.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$a($$self, $$props, $$invalidate) {
  	let $WEAVE_EXPLORE_OPEN;

  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	let $rezed,
  		$$unsubscribe_rezed = noop,
  		$$subscribe_rezed = () => ($$unsubscribe_rezed(), $$unsubscribe_rezed = subscribe(rezed, $$value => $$invalidate("$rezed", $rezed = $$value)), rezed);

  	let $name,
  		$$unsubscribe_name = noop,
  		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

  	let $THEME_BORDER;

  	let $w_name,
  		$$unsubscribe_w_name = noop,
  		$$subscribe_w_name = () => ($$unsubscribe_w_name(), $$unsubscribe_w_name = subscribe(w_name, $$value => $$invalidate("$w_name", $w_name = $$value)), w_name);

  	validate_store(WEAVE_EXPLORE_OPEN, "WEAVE_EXPLORE_OPEN");
  	component_subscribe($$self, WEAVE_EXPLORE_OPEN, $$value => $$invalidate("$WEAVE_EXPLORE_OPEN", $WEAVE_EXPLORE_OPEN = $$value));
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_rezed());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_w_name());
  	let { filter = [] } = $$props;
  	let { stitch } = $$props;
  	let { open = $WEAVE_EXPLORE_OPEN } = $$props;
  	let { weave } = $$props;

  	const toggle = e => {
  		e.preventDefault();
  		e.stopPropagation();
  		const r = $rezed;

  		if (r[stitch.id.get()]) {
  			delete r[stitch.id.get()];
  		} else {
  			r[stitch.id.get()] = true;
  		}

  		rezed.set(r);
  	};

  	const writable_props = ["filter", "stitch", "open", "weave"];

  	Object_1.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Stitch> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  	};

  	$$self.$capture_state = () => {
  		return {
  			filter,
  			stitch,
  			open,
  			weave,
  			$WEAVE_EXPLORE_OPEN,
  			w_name,
  			name,
  			rezed,
  			value,
  			chans,
  			$value,
  			$rezed,
  			$name,
  			$THEME_BORDER,
  			$w_name
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("$WEAVE_EXPLORE_OPEN" in $$props) WEAVE_EXPLORE_OPEN.set($WEAVE_EXPLORE_OPEN = $$props.$WEAVE_EXPLORE_OPEN);
  		if ("w_name" in $$props) $$subscribe_w_name($$invalidate("w_name", w_name = $$props.w_name));
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("rezed" in $$props) $$subscribe_rezed($$invalidate("rezed", rezed = $$props.rezed));
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("chans" in $$props) $$invalidate("chans", chans = $$props.chans);
  		if ("$value" in $$props) value.set($value = $$props.$value);
  		if ("$rezed" in $$props) rezed.set($rezed = $$props.$rezed);
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
  		if ("$w_name" in $$props) w_name.set($w_name = $$props.$w_name);
  	};

  	let w_name;
  	let name;
  	let rezed;
  	let value;
  	let chans;

  	$$self.$$.update = (changed = { weave: 1, stitch: 1, $value: 1 }) => {
  		if (changed.weave) {
  			 $$subscribe_w_name($$invalidate("w_name", w_name = weave.name));
  		}

  		if (changed.stitch) {
  			 $$subscribe_name($$invalidate("name", name = stitch.name));
  		}

  		if (changed.weave) {
  			 $$subscribe_rezed($$invalidate("rezed", rezed = weave.rezed));
  		}

  		if (changed.stitch) {
  			 $$subscribe_value($$invalidate("value", value = stitch.value));
  		}

  		if (changed.$value) {
  			 $$invalidate("chans", chans = Object.entries($value).sort(([a], [b]) => {
  				if (a > b) return 1;
  				if (b > a) return -1;
  				return 0;
  			}));
  		}
  	};

  	return {
  		filter,
  		stitch,
  		open,
  		weave,
  		toggle,
  		w_name,
  		name,
  		rezed,
  		value,
  		chans,
  		$name,
  		$THEME_BORDER,
  		$w_name
  	};
  }

  class Stitch extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$a, create_fragment$a, safe_not_equal, { filter: 0, stitch: 0, open: 0, weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Stitch",
  			options,
  			id: create_fragment$a.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.stitch === undefined && !("stitch" in props)) {
  			console.warn("<Stitch> was created without expected prop 'stitch'");
  		}

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Stitch> was created without expected prop 'weave'");
  		}
  	}

  	get filter() {
  		throw new Error("<Stitch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set filter(value) {
  		throw new Error("<Stitch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get stitch() {
  		throw new Error("<Stitch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set stitch(value) {
  		throw new Error("<Stitch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get open() {
  		throw new Error("<Stitch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set open(value) {
  		throw new Error("<Stitch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get weave() {
  		throw new Error("<Stitch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Stitch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/Controls.svelte generated by Svelte v3.14.1 */
  const file$b = "src/ui/weave/Controls.svelte";

  // (42:2) {#if $name !== Wheel.SYSTEM}
  function create_if_block$6(ctx) {
  	let div;
  	let promise;
  	let dispose;

  	let info = {
  		ctx,
  		current: null,
  		token: null,
  		pending: create_pending_block$2,
  		then: create_then_block$2,
  		catch: create_catch_block$2,
  		value: "src",
  		error: "null"
  	};

  	handle_promise(promise = image(ctx.weave.name.get()), info);

  	const block = {
  		c: function create() {
  			div = element("div");
  			info.block.c();
  			attr_dev(div, "class", "save svelte-cj6feq");
  			add_location(div, file$b, 42, 2, 757);
  			dispose = listen_dev(div, "click", ctx.save_it, false, false, false);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			info.block.m(div, info.anchor = null);
  			info.mount = () => div;
  			info.anchor = null;
  		},
  		p: function update(changed, new_ctx) {
  			ctx = new_ctx;
  			info.ctx = ctx;

  			if (changed.weave && promise !== (promise = image(ctx.weave.name.get())) && handle_promise(promise, info)) ; else {
  				info.block.p(changed, assign(assign({}, ctx), info.resolved)); // nothing
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			info.block.d();
  			info.token = null;
  			info = null;
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$6.name,
  		type: "if",
  		source: "(42:2) {#if $name !== Wheel.SYSTEM}",
  		ctx
  	});

  	return block;
  }

  // (1:0) <script> import { save, image }
  function create_catch_block$2(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_catch_block$2.name,
  		type: "catch",
  		source: "(1:0) <script> import { save, image }",
  		ctx
  	});

  	return block;
  }

  // (47:45)        <img {src}
  function create_then_block$2(ctx) {
  	let img;
  	let img_src_value;

  	const block = {
  		c: function create() {
  			img = element("img");
  			if (img.src !== (img_src_value = ctx.src)) attr_dev(img, "src", img_src_value);
  			attr_dev(img, "alt", "save");
  			attr_dev(img, "class", "svelte-cj6feq");
  			add_location(img, file$b, 47, 6, 858);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, img, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.weave && img.src !== (img_src_value = ctx.src)) {
  				attr_dev(img, "src", img_src_value);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(img);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_then_block$2.name,
  		type: "then",
  		source: "(47:45)        <img {src}",
  		ctx
  	});

  	return block;
  }

  // (1:0) <script> import { save, image }
  function create_pending_block$2(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_pending_block$2.name,
  		type: "pending",
  		source: "(1:0) <script> import { save, image }",
  		ctx
  	});

  	return block;
  }

  function create_fragment$b(ctx) {
  	let div1;
  	let div0;
  	let t;
  	let current;
  	let dispose;

  	const postage = new Postage({
  			props: { address: `/${ctx.$name}` },
  			$$inline: true
  		});

  	let if_block = ctx.$name !== Wheel.SYSTEM && create_if_block$6(ctx);

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			div0 = element("div");
  			create_component(postage.$$.fragment);
  			t = space();
  			if (if_block) if_block.c();
  			attr_dev(div0, "class", "postage svelte-cj6feq");
  			add_location(div0, file$b, 36, 1, 627);
  			attr_dev(div1, "class", "controls svelte-cj6feq");
  			add_location(div1, file$b, 33, 0, 600);
  			dispose = listen_dev(div0, "click", ctx.toggle, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			append_dev(div1, div0);
  			mount_component(postage, div0, null);
  			append_dev(div1, t);
  			if (if_block) if_block.m(div1, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const postage_changes = {};
  			if (changed.$name) postage_changes.address = `/${ctx.$name}`;
  			postage.$set(postage_changes);

  			if (ctx.$name !== Wheel.SYSTEM) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  				} else {
  					if_block = create_if_block$6(ctx);
  					if_block.c();
  					if_block.m(div1, null);
  				}
  			} else if (if_block) {
  				if_block.d(1);
  				if_block = null;
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(postage.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(postage.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div1);
  			destroy_component(postage);
  			if (if_block) if_block.d();
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$b.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$b($$self, $$props, $$invalidate) {
  	let $running,
  		$$unsubscribe_running = noop,
  		$$subscribe_running = () => ($$unsubscribe_running(), $$unsubscribe_running = subscribe(running, $$value => $$invalidate("$running", $running = $$value)), running);

  	let $name,
  		$$unsubscribe_name = noop,
  		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

  	let $THEME_BORDER;
  	let $THEME_BG;
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	validate_store(THEME_BG, "THEME_BG");
  	component_subscribe($$self, THEME_BG, $$value => $$invalidate("$THEME_BG", $THEME_BG = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_running());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	let { weave } = $$props;

  	const toggle = e => {
  		e.stopPropagation();
  		e.preventDefault();

  		if (runs) {
  			Wheel.stop($name);
  		} else {
  			Wheel.start($name);
  		}

  		runs = !runs;
  	};

  	const save_it = e => {
  		e.preventDefault();
  		e.stopPropagation();
  		save(weave);
  	};

  	const writable_props = ["weave"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Controls> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  	};

  	$$self.$capture_state = () => {
  		return {
  			weave,
  			name,
  			running,
  			runs,
  			$running,
  			$name,
  			style,
  			$THEME_BORDER,
  			$THEME_BG
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("running" in $$props) $$subscribe_running($$invalidate("running", running = $$props.running));
  		if ("runs" in $$props) runs = $$props.runs;
  		if ("$running" in $$props) running.set($running = $$props.$running);
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("style" in $$props) style = $$props.style;
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
  		if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
  	};

  	let name;
  	let running;
  	let runs;
  	let style;

  	$$self.$$.update = (changed = { weave: 1, $running: 1, $THEME_BORDER: 1, $THEME_BG: 1 }) => {
  		if (changed.weave) {
  			 $$subscribe_name($$invalidate("name", name = weave.name));
  		}

  		if (changed.$running || changed.weave) {
  			 runs = $running[weave.name.get()];
  		}

  		if (changed.$THEME_BORDER || changed.$THEME_BG) {
  			 style = `border: 0.25rem solid ${$THEME_BORDER}; background-color: ${$THEME_BG};`;
  		}
  	};

  	 $$subscribe_running($$invalidate("running", running = Wheel.running));

  	return {
  		weave,
  		toggle,
  		save_it,
  		name,
  		running,
  		$name
  	};
  }

  class Controls extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$b, create_fragment$b, safe_not_equal, { weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Controls",
  			options,
  			id: create_fragment$b.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Controls> was created without expected prop 'weave'");
  		}
  	}

  	get weave() {
  		throw new Error("<Controls>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Controls>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/explore/Weave.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$1 } = globals;
  const file$c = "src/ui/explore/Weave.svelte";

  function get_each_context$2(ctx, list, i) {
  	const child_ctx = Object_1$1.create(ctx);
  	child_ctx.s_name = list[i][0];
  	child_ctx.stitch = list[i][1];
  	return child_ctx;
  }

  // (90:0) {#if open}
  function create_if_block$7(ctx) {
  	let div;
  	let t;
  	let current;

  	const omni = new Omni({
  			props: {
  				command: ctx.command,
  				system: ctx.$name === Wheel.SYSTEM
  			},
  			$$inline: true
  		});

  	let each_value = ctx.stitches;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
  	}

  	const out = i => transition_out(each_blocks[i], 1, 1, () => {
  		each_blocks[i] = null;
  	});

  	const block = {
  		c: function create() {
  			div = element("div");
  			create_component(omni.$$.fragment);
  			t = space();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div, "class", "stitches");
  			add_location(div, file$c, 90, 2, 1618);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			mount_component(omni, div, null);
  			append_dev(div, t);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const omni_changes = {};
  			if (changed.$name) omni_changes.system = ctx.$name === Wheel.SYSTEM;
  			omni.$set(omni_changes);

  			if (changed.filter || changed.stitches || changed.weave) {
  				each_value = ctx.stitches;
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context$2(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  						transition_in(each_blocks[i], 1);
  					} else {
  						each_blocks[i] = create_each_block$2(child_ctx);
  						each_blocks[i].c();
  						transition_in(each_blocks[i], 1);
  						each_blocks[i].m(div, null);
  					}
  				}

  				group_outros();

  				for (i = each_value.length; i < each_blocks.length; i += 1) {
  					out(i);
  				}

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(omni.$$.fragment, local);

  			for (let i = 0; i < each_value.length; i += 1) {
  				transition_in(each_blocks[i]);
  			}

  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(omni.$$.fragment, local);
  			each_blocks = each_blocks.filter(Boolean);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				transition_out(each_blocks[i]);
  			}

  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			destroy_component(omni);
  			destroy_each(each_blocks, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$7.name,
  		type: "if",
  		source: "(90:0) {#if open}",
  		ctx
  	});

  	return block;
  }

  // (96:6) {#if         filter.length === 0 ||         s_name.indexOf(filter[0]) !== -1       }
  function create_if_block_1$4(ctx) {
  	let current;

  	const stitch = new Stitch({
  			props: {
  				stitch: ctx.stitch,
  				filter: ctx.filter.slice(1),
  				weave: ctx.weave
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(stitch.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(stitch, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const stitch_changes = {};
  			if (changed.stitches) stitch_changes.stitch = ctx.stitch;
  			if (changed.filter) stitch_changes.filter = ctx.filter.slice(1);
  			if (changed.weave) stitch_changes.weave = ctx.weave;
  			stitch.$set(stitch_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(stitch.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(stitch.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(stitch, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1$4.name,
  		type: "if",
  		source: "(96:6) {#if         filter.length === 0 ||         s_name.indexOf(filter[0]) !== -1       }",
  		ctx
  	});

  	return block;
  }

  // (95:4) {#each stitches as [s_name,stitch]}
  function create_each_block$2(ctx) {
  	let show_if = ctx.filter.length === 0 || ctx.s_name.indexOf(ctx.filter[0]) !== -1;
  	let if_block_anchor;
  	let current;
  	let if_block = show_if && create_if_block_1$4(ctx);

  	const block = {
  		c: function create() {
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  		},
  		m: function mount(target, anchor) {
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.filter || changed.stitches) show_if = ctx.filter.length === 0 || ctx.s_name.indexOf(ctx.filter[0]) !== -1;

  			if (show_if) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block_1$4(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(if_block_anchor.parentNode, if_block_anchor);
  				}
  			} else if (if_block) {
  				group_outros();

  				transition_out(if_block, 1, 1, () => {
  					if_block = null;
  				});

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block$2.name,
  		type: "each",
  		source: "(95:4) {#each stitches as [s_name,stitch]}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$c(ctx) {
  	let div1;
  	let t0;
  	let div0;
  	let t1;
  	let dark_action;
  	let t2;
  	let if_block_anchor;
  	let current;
  	let dispose;

  	const controls = new Controls({
  			props: { weave: ctx.weave },
  			$$inline: true
  		});

  	let if_block = ctx.open && create_if_block$7(ctx);

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			create_component(controls.$$.fragment);
  			t0 = space();
  			div0 = element("div");
  			t1 = text(ctx.$name);
  			t2 = space();
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  			attr_dev(div0, "class", "namezor svelte-4hv3b3");
  			add_location(div0, file$c, 84, 2, 1554);
  			attr_dev(div1, "class", "weave svelte-4hv3b3");
  			attr_dev(div1, "style", ctx.$THEME_STYLE);
  			toggle_class(div1, "open", ctx.open);
  			add_location(div1, file$c, 74, 0, 1409);
  			dispose = listen_dev(div1, "click", ctx.click_handler, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			mount_component(controls, div1, null);
  			append_dev(div1, t0);
  			append_dev(div1, div0);
  			append_dev(div0, t1);
  			dark_action = dark.call(null, div1, ctx.$name) || ({});
  			insert_dev(target, t2, anchor);
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const controls_changes = {};
  			if (changed.weave) controls_changes.weave = ctx.weave;
  			controls.$set(controls_changes);
  			if (!current || changed.$name) set_data_dev(t1, ctx.$name);

  			if (!current || changed.$THEME_STYLE) {
  				attr_dev(div1, "style", ctx.$THEME_STYLE);
  			}

  			if (is_function(dark_action.update) && changed.$name) dark_action.update.call(null, ctx.$name);

  			if (changed.open) {
  				toggle_class(div1, "open", ctx.open);
  			}

  			if (ctx.open) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block$7(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(if_block_anchor.parentNode, if_block_anchor);
  				}
  			} else if (if_block) {
  				group_outros();

  				transition_out(if_block, 1, 1, () => {
  					if_block = null;
  				});

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(controls.$$.fragment, local);
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(controls.$$.fragment, local);
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div1);
  			destroy_component(controls);
  			if (dark_action && is_function(dark_action.destroy)) dark_action.destroy();
  			if (detaching) detach_dev(t2);
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$c.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$c($$self, $$props, $$invalidate) {
  	let $WEAVE_EXPLORE_OPEN;

  	let $names,
  		$$unsubscribe_names = noop,
  		$$subscribe_names = () => ($$unsubscribe_names(), $$unsubscribe_names = subscribe(names, $$value => $$invalidate("$names", $names = $$value)), names);

  	let $name,
  		$$unsubscribe_name = noop,
  		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

  	let $THEME_STYLE;
  	validate_store(WEAVE_EXPLORE_OPEN, "WEAVE_EXPLORE_OPEN");
  	component_subscribe($$self, WEAVE_EXPLORE_OPEN, $$value => $$invalidate("$WEAVE_EXPLORE_OPEN", $WEAVE_EXPLORE_OPEN = $$value));
  	validate_store(THEME_STYLE, "THEME_STYLE");
  	component_subscribe($$self, THEME_STYLE, $$value => $$invalidate("$THEME_STYLE", $THEME_STYLE = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_names());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	let { weave } = $$props;
  	let { filter = [] } = $$props;
  	let { open = $WEAVE_EXPLORE_OPEN } = $$props;

  	const command = ([command, detail, detail2], msg) => {
  		switch (command) {
  			case `>`:
  				const knot = $names[detail];
  				if (!knot) return msg(`Couldn't find ${detail}`);
  				if ($names[detail2]) return msg(`${detail2} already exists`);
  				knot.knot.name.set(detail2);
  				return;
  			case `~`:
  				const k = $names[detail];
  				if (!k) return;
  				k.name.set(detail2);
  				break;
  			case `+`:
  				if (detail2) {
  					return weave.update({
  						[detail]: { knot: `stitch`, value: { [detail2]: `` } }
  					});
  				}
  				weave.add({ knot: `stitch`, name: detail });
  				break;
  			case `-`:
  				if (detail2) {
  					const s = weave.get_name(detail);
  					if (!s) return;
  					s.value.remove(detail2);
  					return;
  				}
  				weave.remove_name(detail);
  		}
  	};

  	const writable_props = ["weave", "filter", "open"];

  	Object_1$1.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Weave> was created with unknown prop '${key}'`);
  	});

  	const click_handler = () => {
  		$$invalidate("open", open = !open);
  	};

  	$$self.$set = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  	};

  	$$self.$capture_state = () => {
  		return {
  			weave,
  			filter,
  			open,
  			name,
  			names,
  			$WEAVE_EXPLORE_OPEN,
  			stitches,
  			$names,
  			knots,
  			$name,
  			$THEME_STYLE
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("names" in $$props) $$subscribe_names($$invalidate("names", names = $$props.names));
  		if ("$WEAVE_EXPLORE_OPEN" in $$props) WEAVE_EXPLORE_OPEN.set($WEAVE_EXPLORE_OPEN = $$props.$WEAVE_EXPLORE_OPEN);
  		if ("stitches" in $$props) $$invalidate("stitches", stitches = $$props.stitches);
  		if ("$names" in $$props) names.set($names = $$props.$names);
  		if ("knots" in $$props) knots = $$props.knots;
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$THEME_STYLE" in $$props) THEME_STYLE.set($THEME_STYLE = $$props.$THEME_STYLE);
  	};

  	let name;
  	let names;
  	let stitches;
  	let knots;

  	$$self.$$.update = (changed = { weave: 1, $names: 1 }) => {
  		if (changed.weave) {
  			 $$subscribe_name($$invalidate("name", name = weave.name));
  		}

  		if (changed.weave) {
  			 $$subscribe_names($$invalidate("names", names = weave.names));
  		}

  		if (changed.$names) {
  			 $$invalidate("stitches", stitches = Object.entries($names).sort(([a], [b]) => {
  				if (a > b) return 1;
  				if (b > a) return -1;
  				return 0;
  			}));
  		}

  		if (changed.weave) {
  			 knots = weave.knots;
  		}
  	};

  	return {
  		weave,
  		filter,
  		open,
  		command,
  		name,
  		names,
  		stitches,
  		$name,
  		$THEME_STYLE,
  		click_handler
  	};
  }

  class Weave$1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$c, create_fragment$c, safe_not_equal, { weave: 0, filter: 0, open: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Weave",
  			options,
  			id: create_fragment$c.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Weave> was created without expected prop 'weave'");
  		}
  	}

  	get weave() {
  		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get filter() {
  		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set filter(value) {
  		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get open() {
  		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set open(value) {
  		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/Explore.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$2 } = globals;
  const file$d = "src/ui/weave/Explore.svelte";

  function get_each_context_1(ctx, list, i) {
  	const child_ctx = Object_1$2.create(ctx);
  	child_ctx.weave = list[i];
  	return child_ctx;
  }

  function get_each_context$3(ctx, list, i) {
  	const child_ctx = Object_1$2.create(ctx);
  	child_ctx.side = list[i];
  	return child_ctx;
  }

  // (74:4) {#if       filter === `` ||       weave.name.get().indexOf(parts[0]) !== -1     }
  function create_if_block$8(ctx) {
  	let current;

  	const weave = new Weave$1({
  			props: {
  				weave: ctx.weave,
  				filter: ctx.parts.slice(1),
  				open: ctx.weave.name.get() !== Wheel.SYSTEM
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(weave.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(weave, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const weave_changes = {};
  			if (changed.ws) weave_changes.weave = ctx.weave;
  			if (changed.parts) weave_changes.filter = ctx.parts.slice(1);
  			if (changed.ws) weave_changes.open = ctx.weave.name.get() !== Wheel.SYSTEM;
  			weave.$set(weave_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(weave.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(weave.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(weave, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$8.name,
  		type: "if",
  		source: "(74:4) {#if       filter === `` ||       weave.name.get().indexOf(parts[0]) !== -1     }",
  		ctx
  	});

  	return block;
  }

  // (73:2) {#each ws as weave}
  function create_each_block_1(ctx) {
  	let show_if = ctx.filter === `` || ctx.weave.name.get().indexOf(ctx.parts[0]) !== -1;
  	let if_block_anchor;
  	let current;
  	let if_block = show_if && create_if_block$8(ctx);

  	const block = {
  		c: function create() {
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  		},
  		m: function mount(target, anchor) {
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.filter || changed.ws || changed.parts) show_if = ctx.filter === `` || ctx.weave.name.get().indexOf(ctx.parts[0]) !== -1;

  			if (show_if) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block$8(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(if_block_anchor.parentNode, if_block_anchor);
  				}
  			} else if (if_block) {
  				group_outros();

  				transition_out(if_block, 1, 1, () => {
  					if_block = null;
  				});

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block_1.name,
  		type: "each",
  		source: "(73:2) {#each ws as weave}",
  		ctx
  	});

  	return block;
  }

  // (56:0) {#each sides as side}
  function create_each_block$3(ctx) {
  	let div4;
  	let div3;
  	let div0;
  	let t0;
  	let t1;
  	let div1;
  	let t2;
  	let div2;
  	let t3;
  	let div4_class_value;
  	let current;

  	const omni = new Omni({
  			props: { command: ctx.command },
  			$$inline: true
  		});

  	let each_value_1 = ctx.ws;
  	let each_blocks = [];

  	for (let i = 0; i < each_value_1.length; i += 1) {
  		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
  	}

  	const out = i => transition_out(each_blocks[i], 1, 1, () => {
  		each_blocks[i] = null;
  	});

  	const block = {
  		c: function create() {
  			div4 = element("div");
  			div3 = element("div");
  			div0 = element("div");
  			t0 = text("[ I S E K A I ]");
  			t1 = space();
  			div1 = element("div");
  			create_component(omni.$$.fragment);
  			t2 = space();
  			div2 = element("div");

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			t3 = space();
  			attr_dev(div0, "class", "logo svelte-1hz8bol");
  			attr_dev(div0, "style", ctx.$THEME_STYLE);
  			add_location(div0, file$d, 62, 2, 1283);
  			attr_dev(div1, "class", "events svelte-1hz8bol");
  			add_location(div1, file$d, 67, 2, 1358);
  			attr_dev(div2, "class", "weaves svelte-1hz8bol");
  			add_location(div2, file$d, 71, 2, 1414);
  			attr_dev(div3, "class", "partial svelte-1hz8bol");
  			add_location(div3, file$d, 61, 2, 1259);
  			attr_dev(div4, "class", div4_class_value = "explore " + ctx.side + " svelte-1hz8bol");
  			set_style(div4, "color", ctx.$THEME_COLOR);
  			toggle_class(div4, "hidden", ctx.hidden);
  			add_location(div4, file$d, 56, 0, 1177);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div4, anchor);
  			append_dev(div4, div3);
  			append_dev(div3, div0);
  			append_dev(div0, t0);
  			append_dev(div3, t1);
  			append_dev(div3, div1);
  			mount_component(omni, div1, null);
  			append_dev(div3, t2);
  			append_dev(div3, div2);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div2, null);
  			}

  			append_dev(div4, t3);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (!current || changed.$THEME_STYLE) {
  				attr_dev(div0, "style", ctx.$THEME_STYLE);
  			}

  			if (changed.filter || changed.ws || changed.parts || changed.Wheel) {
  				each_value_1 = ctx.ws;
  				let i;

  				for (i = 0; i < each_value_1.length; i += 1) {
  					const child_ctx = get_each_context_1(ctx, each_value_1, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  						transition_in(each_blocks[i], 1);
  					} else {
  						each_blocks[i] = create_each_block_1(child_ctx);
  						each_blocks[i].c();
  						transition_in(each_blocks[i], 1);
  						each_blocks[i].m(div2, null);
  					}
  				}

  				group_outros();

  				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
  					out(i);
  				}

  				check_outros();
  			}

  			if (!current || changed.$THEME_COLOR) {
  				set_style(div4, "color", ctx.$THEME_COLOR);
  			}

  			if (changed.hidden) {
  				toggle_class(div4, "hidden", ctx.hidden);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(omni.$$.fragment, local);

  			for (let i = 0; i < each_value_1.length; i += 1) {
  				transition_in(each_blocks[i]);
  			}

  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(omni.$$.fragment, local);
  			each_blocks = each_blocks.filter(Boolean);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				transition_out(each_blocks[i]);
  			}

  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div4);
  			destroy_component(omni);
  			destroy_each(each_blocks, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block$3.name,
  		type: "each",
  		source: "(56:0) {#each sides as side}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$d(ctx) {
  	let t0;
  	let t1;
  	let each_1_anchor;
  	let current;
  	const mainscreen = new MainScreen({ $$inline: true });
  	const picker = new Picker({ $$inline: true });
  	let each_value = ctx.sides;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
  	}

  	const out = i => transition_out(each_blocks[i], 1, 1, () => {
  		each_blocks[i] = null;
  	});

  	const block = {
  		c: function create() {
  			create_component(mainscreen.$$.fragment);
  			t0 = space();
  			create_component(picker.$$.fragment);
  			t1 = space();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			each_1_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			mount_component(mainscreen, target, anchor);
  			insert_dev(target, t0, anchor);
  			mount_component(picker, target, anchor);
  			insert_dev(target, t1, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(target, anchor);
  			}

  			insert_dev(target, each_1_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.sides || changed.$THEME_COLOR || changed.hidden || changed.ws || changed.filter || changed.parts || changed.Wheel || changed.command || changed.$THEME_STYLE) {
  				each_value = ctx.sides;
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context$3(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  						transition_in(each_blocks[i], 1);
  					} else {
  						each_blocks[i] = create_each_block$3(child_ctx);
  						each_blocks[i].c();
  						transition_in(each_blocks[i], 1);
  						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
  					}
  				}

  				group_outros();

  				for (i = each_value.length; i < each_blocks.length; i += 1) {
  					out(i);
  				}

  				check_outros();
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(mainscreen.$$.fragment, local);
  			transition_in(picker.$$.fragment, local);

  			for (let i = 0; i < each_value.length; i += 1) {
  				transition_in(each_blocks[i]);
  			}

  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(mainscreen.$$.fragment, local);
  			transition_out(picker.$$.fragment, local);
  			each_blocks = each_blocks.filter(Boolean);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				transition_out(each_blocks[i]);
  			}

  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(mainscreen, detaching);
  			if (detaching) detach_dev(t0);
  			destroy_component(picker, detaching);
  			if (detaching) detach_dev(t1);
  			destroy_each(each_blocks, detaching);
  			if (detaching) detach_dev(each_1_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$d.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$d($$self, $$props, $$invalidate) {
  	let $weaves,
  		$$unsubscribe_weaves = noop,
  		$$subscribe_weaves = () => ($$unsubscribe_weaves(), $$unsubscribe_weaves = subscribe(weaves, $$value => $$invalidate("$weaves", $weaves = $$value)), weaves);

  	let $THEME_COLOR;
  	let $THEME_STYLE;
  	validate_store(THEME_COLOR, "THEME_COLOR");
  	component_subscribe($$self, THEME_COLOR, $$value => $$invalidate("$THEME_COLOR", $THEME_COLOR = $$value));
  	validate_store(THEME_STYLE, "THEME_STYLE");
  	component_subscribe($$self, THEME_STYLE, $$value => $$invalidate("$THEME_STYLE", $THEME_STYLE = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_weaves());

  	key.listen(char => {
  		if (char !== `\``) return;
  		$$invalidate("hidden", hidden = !hidden);
  	});

  	let filter = ``;
  	let { hidden = false } = $$props;

  	const command = ([action, ...details], msg) => {
  		switch (action) {
  			case `-`:
  				Wheel.del({ [details[0]]: true });
  				$$invalidate("filter", filter = ``);
  				return;
  			case `+`:
  				if (details.length === 1) {
  					Wheel.spawn({ [details[0]]: {} });
  				}
  				if (details.length === 3) {
  					github(details).then(name => {
  						msg(`Added ${name} from Github. `);
  					}).catch(ex => {
  						msg(`Couldn't add ${details.join(`/`)}. `);
  					});
  				}
  				$$invalidate("filter", filter = ``);
  		}
  	};

  	const sides = [`in`];
  	const writable_props = ["hidden"];

  	Object_1$2.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Explore> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("hidden" in $$props) $$invalidate("hidden", hidden = $$props.hidden);
  	};

  	$$self.$capture_state = () => {
  		return {
  			filter,
  			hidden,
  			weaves,
  			ws,
  			$weaves,
  			parts,
  			$THEME_COLOR,
  			$THEME_STYLE
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("hidden" in $$props) $$invalidate("hidden", hidden = $$props.hidden);
  		if ("weaves" in $$props) $$subscribe_weaves($$invalidate("weaves", weaves = $$props.weaves));
  		if ("ws" in $$props) $$invalidate("ws", ws = $$props.ws);
  		if ("$weaves" in $$props) weaves.set($weaves = $$props.$weaves);
  		if ("parts" in $$props) $$invalidate("parts", parts = $$props.parts);
  		if ("$THEME_COLOR" in $$props) THEME_COLOR.set($THEME_COLOR = $$props.$THEME_COLOR);
  		if ("$THEME_STYLE" in $$props) THEME_STYLE.set($THEME_STYLE = $$props.$THEME_STYLE);
  	};

  	let weaves;
  	let ws;
  	let parts;

  	$$self.$$.update = (changed = { $weaves: 1, filter: 1 }) => {
  		if (changed.$weaves) {
  			 $$invalidate("ws", ws = Object.values($weaves));
  		}

  		if (changed.filter) {
  			 $$invalidate("parts", parts = filter[0] === `-` || filter[0] === `+`
  			? [``, ``]
  			: filter.split(`/`));
  		}
  	};

  	 $$subscribe_weaves($$invalidate("weaves", weaves = Wheel.weaves));

  	return {
  		filter,
  		hidden,
  		command,
  		sides,
  		weaves,
  		ws,
  		parts,
  		$THEME_COLOR,
  		$THEME_STYLE
  	};
  }

  class Explore extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$d, create_fragment$d, safe_not_equal, { hidden: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Explore",
  			options,
  			id: create_fragment$d.name
  		});
  	}

  	get hidden() {
  		throw new Error("<Explore>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set hidden(value) {
  		throw new Error("<Explore>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/app/app.svelte generated by Svelte v3.14.1 */

  function create_fragment$e(ctx) {
  	let current;
  	const explore = new Explore({ $$inline: true });

  	const block = {
  		c: function create() {
  			create_component(explore.$$.fragment);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			mount_component(explore, target, anchor);
  			current = true;
  		},
  		p: noop,
  		i: function intro(local) {
  			if (current) return;
  			transition_in(explore.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(explore.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(explore, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$e.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  class App extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, null, create_fragment$e, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "App",
  			options,
  			id: create_fragment$e.name
  		});
  	}
  }

  const ws = Wheel.weaves.get();
  ws[Wheel.SYSTEM] = system;

  const app = new App({
    target: document.body,
    props: {
      name: `stage`
    }
  });

  return app;

}(Color, cuid, exprEval, twgl, EXT.piexifjs));
//# sourceMappingURL=bundle.js.map
