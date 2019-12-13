var app = (function (Color, uuid, expr, twgl) {
  'use strict';

  Color = Color && Color.hasOwnProperty('default') ? Color['default'] : Color;
  uuid = uuid && uuid.hasOwnProperty('default') ? uuid['default'] : uuid;
  expr = expr && expr.hasOwnProperty('default') ? expr['default'] : expr;

  const writable = (val) => {
    const subs = new Set();

    const w = {
      get: () => val,
      poke: () => {
        w.set(w.get());
        return w
      },
      set: (val_new) => {
        val = val_new;
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

  const THEME_BG = write(`#271905`);
  const THEME_GLOW = write(`green`);

  const THEME_BORDER = read(``, (set) =>
    THEME_BG.listen(($THEME_BG) => set(Color($THEME_BG)
      .darkenByRatio(0.5)
      .toCSS()
    ))
  );

  const THEME_STYLE = read(``, (set) => {
    let $THEME_BG = ``;
    let $THEME_BORDER = ``;

    const update = () => set(`background-color: ${$THEME_BG}; border: 0.25rem solid ${$THEME_BORDER};`);

    THEME_BORDER.listen(($val) => {
      $THEME_BORDER = $val;
      update();
    });
    THEME_BG.listen(($val) => {
      $THEME_BG = $val;
      update();
    });
  });

  var flag = /*#__PURE__*/Object.freeze({
    __proto__: null,
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

  const parser = new expr.Parser({
    in: true,
    assignment: true
  });

  parser.functions.stop = function () {
    throw new Error(`math stop`)
  };

  const math = (formula) => {
    const p = parser.parse(formula);

    return (variables) => p.evaluate(variables)
  };

  // math m = /sys/mouse/position; i = ./something/position; i[0] + m[0]

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
      const s = weave.to_address(weave.chain(id, true).pop());
      new Set(matches).forEach((item) => {
        const shh = item[0] === `$`;
        const gette = item
          .replace(`.`, s)
          .replace(`~`, `/${weave.name.get()}`)
          .replace(`$`, ``)
          .trim();

        const k = Wheel.get(gette);
        const name = gette.replace(whitespace, ``).replace(re_var, ``);

        if (!k) {
          vs[name] = {
            k: {
              toJSON: () => null
            },
            shh: true
          };
          return
        }

        expression = expression.replace(
          new RegExp(escape(item), `g`),
          name
        );
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

      set(m.value.get());

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
      knot: read(`weave`),

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

    w.get_knot = (id) => w.knots.get()[id];
    w.to_address = (id_path) => {
      const [knot] = id_path.split(`/`);

      const k = w.get_knot(knot);
      if (!k || !k.name) return `/sys/void`

      return `/${w.name.get()}/${k.name.get()}`
    };
    w.remove_name = (name) => {
      const k = w.names.get()[name];
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
      throw new Error(`CaN NoT StArT or StOp /${SYSTEM}`)
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
      // lives
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

  const restart = (name) => {
    Wheel.stop(name);
    Wheel.start(name);
  };

  const bump = (what) => JSON.parse(JSON.stringify(what));

  const toJSON = () => ({
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
    get: get,
    exists: exists,
    spawn: spawn,
    start: start,
    stop: stop,
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

  var test_frag = "precision mediump float;uniform vec2 resolution;uniform float time;void main(){vec2 uv=gl_FragCoord.xy/resolution;float color=0.0;color+=sin(uv.x*cos(time/3.0)*60.0)+cos(uv.y*cos(time/2.80)*10.0);color+=sin(uv.y*sin(time/2.0)*40.0)+cos(uv.x*sin(time/1.70)*40.0);color+=sin(uv.x*sin(time/1.0)*10.0)+sin(uv.y*sin(time/3.50)*80.0);color*=sin(time/10.0)*0.5;gl_FragColor=vec4(vec3(color*0.5,sin(color+time/2.5)*0.75,color),1.0);}";

  var test_vert = "attribute vec4 position;void main(){gl_Position=position;}";

  var sprite_frag = "precision highp float;uniform sampler2D u_map;varying vec2 v_sprite;varying vec4 v_color;void main(){gl_FragColor=v_color;}";

  var sprite_vert = "precision highp float;uniform mat4 u_view_projection;uniform float u_sprite_columns;attribute vec4 translate;attribute float sprite;attribute vec4 color;attribute vec2 position;varying vec4 v_color;varying vec2 v_sprite;void main(){v_color=color;v_sprite=vec2(0.0,0.0);mat4 mv=u_view_projection;vec3 pos=vec3(position*translate.w,0.0)+translate.xzy;gl_Position=mv*vec4(pos,1.0);gl_Position-=vec4((gl_Position.xy)*gl_Position.z,0.0,0.0);}";

  const breaker = (a) => a.map(i => `\r\n${i}`);

  const test = read(breaker([
    test_vert,
    test_frag
  ]));

  const sprite = read(breaker([
    sprite_vert,
    sprite_frag
  ]));

  const validate = ({ set }) => (val) => {
    if (!Array.isArray(val)) return
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
        src: `/sheets/default_2.png`,
        mag: gl.NEAREST,
        min: gl.LINEAR
      }
    });

    const program_info = twgl.createProgramInfo(
      gl,
      sprite.get()
    );

    const random = (min, max) => min + Math.random() * (max - min);
    const set_random = (count, min = 0) => {
      const result = [];
      for (let i = 0; i < count; i++) {
        if (i % 4 === 0) {
          result.push(1);
        } else {
          result.push(random(0, 0.5));
        }
      }
      return result
    };
    const count = 8 * 8 * 8;
    const pos_ordered = () => {
      const s = Math.cbrt(count);
      const arr = [...Array(count * 3)].fill(0);
      const half = s / 2;

      for (let x = 0; x < s; x++) {
        for (let y = 0; y < s; y++) {
          for (let z = 0; z < s; z++) {
            for (let a = 0; a < s; a++) {
              const idx = (x + y * s + z * s * s + a * s * s * s) * 4;
              arr[idx] = (x - half);
              arr[idx + 1] = (y - half);
              arr[idx + 2] = (z - half);
              arr[idx + 3] = 0.5;
            }
          }
        }
      }
      return arr
    };

    const set_count = () => [...Array(count)]
      .map((_, idx) => idx);

    const verts = twgl.primitives.createXYQuadVertices(1);
    const buffer = {
      ...Object.fromEntries(Object.entries(verts).map(
        ([key, val]) => {
          val.divisor = 0;
          return [key, val]
        }
      )),
      translate: {
        divisor: 1,
        data: pos_ordered(),
        numComponents: 4
      },
      sprite: {
        numComponents: 1,
        data: set_count(),
        divisor: 1
      },
      color: {
        numComponents: 4,
        data: set_random(4 * count),
        divisor: 1
      }
    };

    console.log(buffer);
    const snapshot = () => {
      const uniforms = {};

      return {
        buffer,
        uniforms
      }
    };

    canvas.snap = write(snapshot());
    const view = m4.identity();
    const view_projection = m4.identity();

    // lifecycle on knot
    canvas.cancel = frame.subscribe(([time, t]) => {
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
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

      const { buffer, uniforms } = snapshot();
      canvas.snap.set({
        buffer,
        uniforms
      });

      const u = {
        ...uniforms,
        u_map: textures.map,
        u_time: t * 0.001,
        u_sprite_size: 1,
        u_sprite_columns: 32,
        u_view_projection: view_projection
      };

      try {
        const buffer_info = twgl.createBufferInfoFromArrays(
          gl,
          buffer
        );

        const vertex_info = twgl.createVertexArrayInfo(gl, program_info, buffer_info);

        gl.useProgram(program_info.program);
        twgl.setBuffersAndAttributes(gl, program_info, vertex_info);
        twgl.setUniforms(program_info, u);

        twgl.drawObjectList(gl, [{
          programInfo: program_info,
          vertexArrayInfo: vertex_info,
          uniforms: u,
          instanceCount: count
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

  const up$1 = read(``, (set) =>
    window.addEventListener(`keyup`, (e) => {
      if (
        e.target.tagName === `INPUT` ||
        e.target.tagName === `TEXTAREA`
      ) {
        return
      }

      e.preventDefault();

      set(e.key.toLowerCase());
    })
  );

  const down = read(``, (set) =>
    window.addEventListener(`keydown`, (e) => {
      if (
        e.target.tagName === `INPUT` ||
        e.target.tagName === `TEXTAREA`
      ) {
        return
      }

      e.preventDefault();

      set(e.key.toLowerCase());
    })
  );

  const keys = read({}, (set) => {
    const value = {};

    down.listen((char) => {
      value[char] = true;
      set(value);
    });

    up$1.listen((char) => {
      delete value[char];
      set(value);
    });
  });

  var key = /*#__PURE__*/Object.freeze({
    __proto__: null,
    up: up$1,
    down: down,
    keys: keys
  });

  const add = (...vecs) => vecs.reduce((result, vec) =>
    twgl.v3.add(result, vec)
  , [0, 0, 0]);

  const minus = twgl.v3.subtract;
  const lerp = twgl.v3.lerp;
  const length = twgl.v3.length;
  const divide_scalar = twgl.v3.divScalar;
  const divide = twgl.v3.divide;
  const multiply = twgl.v3.multiply;
  const multiply_scalar = twgl.v3.mulScalar;
  const distance = twgl.v3.distance;
  const negate = twgl.v3.negate;

  // Collection of meta controllers

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

      if (w) b_key[1] += 1;
      if (s) b_key[1] -= 1;
      if (a) b_key[0] -= 1;
      if (d) b_key[0] += 1;
      if (q) b_key[2] += 1;
      if (e) b_key[2] -= 1;

      if (length(b_key) === 0) return

      set(b_key);
    });

    // Mouse.scroll.listen((value_new) => {
    //   buffer = add(buffer, value_new)
    // })
  });

  let scroll_velocity = [0, 0, 0];

  const scroll$1 = transformer((data) => data.map((i) => Math.round(i)));

  scroll$1.set([0, 0, 0]);

  tick.listen(() => {
    if (Math.abs(length(scroll_velocity)) < 1) return

    scroll$1.set(add(
      scroll$1.get(),
      scroll_velocity
    ).map((n) => Math.round(n)));

    scroll_velocity = multiply_scalar(
      scroll_velocity,
      0.25
    );
  });

  translate.listen((t) => {
    scroll_velocity = add(
      scroll_velocity,
      multiply_scalar(
        t,
        INPUT_SCROLL_STRENGTH.get()
      )
    );
  });

  let zoom_velocity = 0;

  scroll.listen(([, t]) => {
    zoom_velocity += t;
  });

  tick.listen(() => {
    if (Math.abs(zoom_velocity) < 0.01) return
    zoom.set(
      Math.max(
        Math.round(
          (zoom.get() + zoom_velocity * INPUT_ZOOM_STRENGTH.get()) * 100
        ) / 100
        , INPUT_ZOOM_MIN.get())
    );
    zoom_velocity *= 0.5;
  });

  const focus = write(``);

  var input = /*#__PURE__*/Object.freeze({
    __proto__: null,
    zoom: zoom,
    translate: translate,
    scroll: scroll$1,
    focus: focus
  });

  const path = transformer((path_new) => {
    if (Array.isArray(path_new)) {
      return path_new
    }

    const path_split = path_new.split(`/`);
    if (window.location.pathname === path_new) {
      return path_split
    }

    // window.history.pushState({ page: 1 }, ``, `/${path_new}`)

    return path_split
  });

  if (window.location.search) {
    path.set(decodeURI(window.location.search.slice(1)));
  } else {
    path.set(decodeURI(window.location.pathname.slice(1)));
  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var piexif = createCommonjsModule(function (module, exports) {
  /* piexifjs

  The MIT License (MIT)

  Copyright (c) 2014, 2015 hMatoba(https://github.com/hMatoba)

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  */

  (function () {
      var that = {};
      that.version = "1.0.4";

      that.remove = function (jpeg) {
          var b64 = false;
          if (jpeg.slice(0, 2) == "\xff\xd8") ; else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
              jpeg = atob(jpeg.split(",")[1]);
              b64 = true;
          } else {
              throw new Error("Given data is not jpeg.");
          }
          
          var segments = splitIntoSegments(jpeg);
          var newSegments = segments.filter(function(seg){
            return  !(seg.slice(0, 2) == "\xff\xe1" &&
                     seg.slice(4, 10) == "Exif\x00\x00"); 
          });
          
          var new_data = newSegments.join("");
          if (b64) {
              new_data = "data:image/jpeg;base64," + btoa(new_data);
          }

          return new_data;
      };


      that.insert = function (exif, jpeg) {
          var b64 = false;
          if (exif.slice(0, 6) != "\x45\x78\x69\x66\x00\x00") {
              throw new Error("Given data is not exif.");
          }
          if (jpeg.slice(0, 2) == "\xff\xd8") ; else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
              jpeg = atob(jpeg.split(",")[1]);
              b64 = true;
          } else {
              throw new Error("Given data is not jpeg.");
          }

          var exifStr = "\xff\xe1" + pack(">H", [exif.length + 2]) + exif;
          var segments = splitIntoSegments(jpeg);
          var new_data = mergeSegments(segments, exifStr);
          if (b64) {
              new_data = "data:image/jpeg;base64," + btoa(new_data);
          }

          return new_data;
      };


      that.load = function (data) {
          var input_data;
          if (typeof (data) == "string") {
              if (data.slice(0, 2) == "\xff\xd8") {
                  input_data = data;
              } else if (data.slice(0, 23) == "data:image/jpeg;base64," || data.slice(0, 22) == "data:image/jpg;base64,") {
                  input_data = atob(data.split(",")[1]);
              } else if (data.slice(0, 4) == "Exif") {
                  input_data = data.slice(6);
              } else {
                  throw new Error("'load' gots invalid file data.");
              }
          } else {
              throw new Error("'load' gots invalid type argument.");
          }
          var exif_dict = {
              "0th": {},
              "Exif": {},
              "GPS": {},
              "Interop": {},
              "1st": {},
              "thumbnail": null
          };
          var exifReader = new ExifReader(input_data);
          if (exifReader.tiftag === null) {
              return exif_dict;
          }

          if (exifReader.tiftag.slice(0, 2) == "\x49\x49") {
              exifReader.endian_mark = "<";
          } else {
              exifReader.endian_mark = ">";
          }

          var pointer = unpack(exifReader.endian_mark + "L",
              exifReader.tiftag.slice(4, 8))[0];
          exif_dict["0th"] = exifReader.get_ifd(pointer, "0th");

          var first_ifd_pointer = exif_dict["0th"]["first_ifd_pointer"];
          delete exif_dict["0th"]["first_ifd_pointer"];

          if (34665 in exif_dict["0th"]) {
              pointer = exif_dict["0th"][34665];
              exif_dict["Exif"] = exifReader.get_ifd(pointer, "Exif");
          }
          if (34853 in exif_dict["0th"]) {
              pointer = exif_dict["0th"][34853];
              exif_dict["GPS"] = exifReader.get_ifd(pointer, "GPS");
          }
          if (40965 in exif_dict["Exif"]) {
              pointer = exif_dict["Exif"][40965];
              exif_dict["Interop"] = exifReader.get_ifd(pointer, "Interop");
          }
          if (first_ifd_pointer != "\x00\x00\x00\x00") {
              pointer = unpack(exifReader.endian_mark + "L",
                  first_ifd_pointer)[0];
              exif_dict["1st"] = exifReader.get_ifd(pointer, "1st");
              if ((513 in exif_dict["1st"]) && (514 in exif_dict["1st"])) {
                  var end = exif_dict["1st"][513] + exif_dict["1st"][514];
                  var thumb = exifReader.tiftag.slice(exif_dict["1st"][513], end);
                  exif_dict["thumbnail"] = thumb;
              }
          }

          return exif_dict;
      };


      that.dump = function (exif_dict_original) {
          var TIFF_HEADER_LENGTH = 8;

          var exif_dict = copy(exif_dict_original);
          var header = "Exif\x00\x00\x4d\x4d\x00\x2a\x00\x00\x00\x08";
          var exif_is = false;
          var gps_is = false;
          var interop_is = false;
          var first_is = false;

          var zeroth_ifd,
              exif_ifd,
              interop_ifd,
              gps_ifd,
              first_ifd;
          
          if ("0th" in exif_dict) {
              zeroth_ifd = exif_dict["0th"];
          } else {
              zeroth_ifd = {};
          }
          
          if ((("Exif" in exif_dict) && (Object.keys(exif_dict["Exif"]).length)) ||
              (("Interop" in exif_dict) && (Object.keys(exif_dict["Interop"]).length))) {
              zeroth_ifd[34665] = 1;
              exif_is = true;
              exif_ifd = exif_dict["Exif"];
              if (("Interop" in exif_dict) && Object.keys(exif_dict["Interop"]).length) {
                  exif_ifd[40965] = 1;
                  interop_is = true;
                  interop_ifd = exif_dict["Interop"];
              } else if (Object.keys(exif_ifd).indexOf(that.ExifIFD.InteroperabilityTag.toString()) > -1) {
                  delete exif_ifd[40965];
              }
          } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.ExifTag.toString()) > -1) {
              delete zeroth_ifd[34665];
          }

          if (("GPS" in exif_dict) && (Object.keys(exif_dict["GPS"]).length)) {
              zeroth_ifd[that.ImageIFD.GPSTag] = 1;
              gps_is = true;
              gps_ifd = exif_dict["GPS"];
          } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.GPSTag.toString()) > -1) {
              delete zeroth_ifd[that.ImageIFD.GPSTag];
          }
          
          if (("1st" in exif_dict) &&
              ("thumbnail" in exif_dict) &&
              (exif_dict["thumbnail"] != null)) {
              first_is = true;
              exif_dict["1st"][513] = 1;
              exif_dict["1st"][514] = 1;
              first_ifd = exif_dict["1st"];
          }
          
          var zeroth_set = _dict_to_bytes(zeroth_ifd, "0th", 0);
          var zeroth_length = (zeroth_set[0].length + exif_is * 12 + gps_is * 12 + 4 +
              zeroth_set[1].length);

          var exif_set,
              exif_bytes = "",
              exif_length = 0,
              gps_set,
              gps_bytes = "",
              gps_length = 0,
              interop_set,
              interop_bytes = "",
              interop_length = 0,
              first_set,
              first_bytes = "",
              thumbnail;
          if (exif_is) {
              exif_set = _dict_to_bytes(exif_ifd, "Exif", zeroth_length);
              exif_length = exif_set[0].length + interop_is * 12 + exif_set[1].length;
          }
          if (gps_is) {
              gps_set = _dict_to_bytes(gps_ifd, "GPS", zeroth_length + exif_length);
              gps_bytes = gps_set.join("");
              gps_length = gps_bytes.length;
          }
          if (interop_is) {
              var offset = zeroth_length + exif_length + gps_length;
              interop_set = _dict_to_bytes(interop_ifd, "Interop", offset);
              interop_bytes = interop_set.join("");
              interop_length = interop_bytes.length;
          }
          if (first_is) {
              var offset = zeroth_length + exif_length + gps_length + interop_length;
              first_set = _dict_to_bytes(first_ifd, "1st", offset);
              thumbnail = _get_thumbnail(exif_dict["thumbnail"]);
              if (thumbnail.length > 64000) {
                  throw new Error("Given thumbnail is too large. max 64kB");
              }
          }

          var exif_pointer = "",
              gps_pointer = "",
              interop_pointer = "",
              first_ifd_pointer = "\x00\x00\x00\x00";
          if (exif_is) {
              var pointer_value = TIFF_HEADER_LENGTH + zeroth_length;
              var pointer_str = pack(">L", [pointer_value]);
              var key = 34665;
              var key_str = pack(">H", [key]);
              var type_str = pack(">H", [TYPES["Long"]]);
              var length_str = pack(">L", [1]);
              exif_pointer = key_str + type_str + length_str + pointer_str;
          }
          if (gps_is) {
              var pointer_value = TIFF_HEADER_LENGTH + zeroth_length + exif_length;
              var pointer_str = pack(">L", [pointer_value]);
              var key = 34853;
              var key_str = pack(">H", [key]);
              var type_str = pack(">H", [TYPES["Long"]]);
              var length_str = pack(">L", [1]);
              gps_pointer = key_str + type_str + length_str + pointer_str;
          }
          if (interop_is) {
              var pointer_value = (TIFF_HEADER_LENGTH +
                  zeroth_length + exif_length + gps_length);
              var pointer_str = pack(">L", [pointer_value]);
              var key = 40965;
              var key_str = pack(">H", [key]);
              var type_str = pack(">H", [TYPES["Long"]]);
              var length_str = pack(">L", [1]);
              interop_pointer = key_str + type_str + length_str + pointer_str;
          }
          if (first_is) {
              var pointer_value = (TIFF_HEADER_LENGTH + zeroth_length +
                  exif_length + gps_length + interop_length);
              first_ifd_pointer = pack(">L", [pointer_value]);
              var thumbnail_pointer = (pointer_value + first_set[0].length + 24 +
                  4 + first_set[1].length);
              var thumbnail_p_bytes = ("\x02\x01\x00\x04\x00\x00\x00\x01" +
                  pack(">L", [thumbnail_pointer]));
              var thumbnail_length_bytes = ("\x02\x02\x00\x04\x00\x00\x00\x01" +
                  pack(">L", [thumbnail.length]));
              first_bytes = (first_set[0] + thumbnail_p_bytes +
                  thumbnail_length_bytes + "\x00\x00\x00\x00" +
                  first_set[1] + thumbnail);
          }

          var zeroth_bytes = (zeroth_set[0] + exif_pointer + gps_pointer +
              first_ifd_pointer + zeroth_set[1]);
          if (exif_is) {
              exif_bytes = exif_set[0] + interop_pointer + exif_set[1];
          }

          return (header + zeroth_bytes + exif_bytes + gps_bytes +
              interop_bytes + first_bytes);
      };


      function copy(obj) {
          return JSON.parse(JSON.stringify(obj));
      }


      function _get_thumbnail(jpeg) {
          var segments = splitIntoSegments(jpeg);
          while (("\xff\xe0" <= segments[1].slice(0, 2)) && (segments[1].slice(0, 2) <= "\xff\xef")) {
              segments = [segments[0]].concat(segments.slice(2));
          }
          return segments.join("");
      }


      function _pack_byte(array) {
          return pack(">" + nStr("B", array.length), array);
      }


      function _pack_short(array) {
          return pack(">" + nStr("H", array.length), array);
      }


      function _pack_long(array) {
          return pack(">" + nStr("L", array.length), array);
      }


      function _value_to_bytes(raw_value, value_type, offset) {
          var four_bytes_over = "";
          var value_str = "";
          var length,
              new_value,
              num,
              den;

          if (value_type == "Byte") {
              length = raw_value.length;
              if (length <= 4) {
                  value_str = (_pack_byte(raw_value) +
                      nStr("\x00", 4 - length));
              } else {
                  value_str = pack(">L", [offset]);
                  four_bytes_over = _pack_byte(raw_value);
              }
          } else if (value_type == "Short") {
              length = raw_value.length;
              if (length <= 2) {
                  value_str = (_pack_short(raw_value) +
                      nStr("\x00\x00", 2 - length));
              } else {
                  value_str = pack(">L", [offset]);
                  four_bytes_over = _pack_short(raw_value);
              }
          } else if (value_type == "Long") {
              length = raw_value.length;
              if (length <= 1) {
                  value_str = _pack_long(raw_value);
              } else {
                  value_str = pack(">L", [offset]);
                  four_bytes_over = _pack_long(raw_value);
              }
          } else if (value_type == "Ascii") {
              new_value = raw_value + "\x00";
              length = new_value.length;
              if (length > 4) {
                  value_str = pack(">L", [offset]);
                  four_bytes_over = new_value;
              } else {
                  value_str = new_value + nStr("\x00", 4 - length);
              }
          } else if (value_type == "Rational") {
              if (typeof (raw_value[0]) == "number") {
                  length = 1;
                  num = raw_value[0];
                  den = raw_value[1];
                  new_value = pack(">L", [num]) + pack(">L", [den]);
              } else {
                  length = raw_value.length;
                  new_value = "";
                  for (var n = 0; n < length; n++) {
                      num = raw_value[n][0];
                      den = raw_value[n][1];
                      new_value += (pack(">L", [num]) +
                          pack(">L", [den]));
                  }
              }
              value_str = pack(">L", [offset]);
              four_bytes_over = new_value;
          } else if (value_type == "SRational") {
              if (typeof (raw_value[0]) == "number") {
                  length = 1;
                  num = raw_value[0];
                  den = raw_value[1];
                  new_value = pack(">l", [num]) + pack(">l", [den]);
              } else {
                  length = raw_value.length;
                  new_value = "";
                  for (var n = 0; n < length; n++) {
                      num = raw_value[n][0];
                      den = raw_value[n][1];
                      new_value += (pack(">l", [num]) +
                          pack(">l", [den]));
                  }
              }
              value_str = pack(">L", [offset]);
              four_bytes_over = new_value;
          } else if (value_type == "Undefined") {
              length = raw_value.length;
              if (length > 4) {
                  value_str = pack(">L", [offset]);
                  four_bytes_over = raw_value;
              } else {
                  value_str = raw_value + nStr("\x00", 4 - length);
              }
          }

          var length_str = pack(">L", [length]);

          return [length_str, value_str, four_bytes_over];
      }

      function _dict_to_bytes(ifd_dict, ifd, ifd_offset) {
          var TIFF_HEADER_LENGTH = 8;
          var tag_count = Object.keys(ifd_dict).length;
          var entry_header = pack(">H", [tag_count]);
          var entries_length;
          if (["0th", "1st"].indexOf(ifd) > -1) {
              entries_length = 2 + tag_count * 12 + 4;
          } else {
              entries_length = 2 + tag_count * 12;
          }
          var entries = "";
          var values = "";
          var key;

          for (var key in ifd_dict) {
              if (typeof (key) == "string") {
                  key = parseInt(key);
              }
              if ((ifd == "0th") && ([34665, 34853].indexOf(key) > -1)) {
                  continue;
              } else if ((ifd == "Exif") && (key == 40965)) {
                  continue;
              } else if ((ifd == "1st") && ([513, 514].indexOf(key) > -1)) {
                  continue;
              }

              var raw_value = ifd_dict[key];
              var key_str = pack(">H", [key]);
              var value_type = TAGS[ifd][key]["type"];
              var type_str = pack(">H", [TYPES[value_type]]);

              if (typeof (raw_value) == "number") {
                  raw_value = [raw_value];
              }
              var offset = TIFF_HEADER_LENGTH + entries_length + ifd_offset + values.length;
              var b = _value_to_bytes(raw_value, value_type, offset);
              var length_str = b[0];
              var value_str = b[1];
              var four_bytes_over = b[2];

              entries += key_str + type_str + length_str + value_str;
              values += four_bytes_over;
          }

          return [entry_header + entries, values];
      }



      function ExifReader(data) {
          var segments,
              app1;
          if (data.slice(0, 2) == "\xff\xd8") { // JPEG
              segments = splitIntoSegments(data);
              app1 = getExifSeg(segments);
              if (app1) {
                  this.tiftag = app1.slice(10);
              } else {
                  this.tiftag = null;
              }
          } else if (["\x49\x49", "\x4d\x4d"].indexOf(data.slice(0, 2)) > -1) { // TIFF
              this.tiftag = data;
          } else if (data.slice(0, 4) == "Exif") { // Exif
              this.tiftag = data.slice(6);
          } else {
              throw new Error("Given file is neither JPEG nor TIFF.");
          }
      }

      ExifReader.prototype = {
          get_ifd: function (pointer, ifd_name) {
              var ifd_dict = {};
              var tag_count = unpack(this.endian_mark + "H",
                  this.tiftag.slice(pointer, pointer + 2))[0];
              var offset = pointer + 2;
              var t;
              if (["0th", "1st"].indexOf(ifd_name) > -1) {
                  t = "Image";
              } else {
                  t = ifd_name;
              }

              for (var x = 0; x < tag_count; x++) {
                  pointer = offset + 12 * x;
                  var tag = unpack(this.endian_mark + "H",
                      this.tiftag.slice(pointer, pointer + 2))[0];
                  var value_type = unpack(this.endian_mark + "H",
                      this.tiftag.slice(pointer + 2, pointer + 4))[0];
                  var value_num = unpack(this.endian_mark + "L",
                      this.tiftag.slice(pointer + 4, pointer + 8))[0];
                  var value = this.tiftag.slice(pointer + 8, pointer + 12);

                  var v_set = [value_type, value_num, value];
                  if (tag in TAGS[t]) {
                      ifd_dict[tag] = this.convert_value(v_set);
                  }
              }

              if (ifd_name == "0th") {
                  pointer = offset + 12 * tag_count;
                  ifd_dict["first_ifd_pointer"] = this.tiftag.slice(pointer, pointer + 4);
              }

              return ifd_dict;
          },

          convert_value: function (val) {
              var data = null;
              var t = val[0];
              var length = val[1];
              var value = val[2];
              var pointer;

              if (t == 1) { // BYTE
                  if (length > 4) {
                      pointer = unpack(this.endian_mark + "L", value)[0];
                      data = unpack(this.endian_mark + nStr("B", length),
                          this.tiftag.slice(pointer, pointer + length));
                  } else {
                      data = unpack(this.endian_mark + nStr("B", length), value.slice(0, length));
                  }
              } else if (t == 2) { // ASCII
                  if (length > 4) {
                      pointer = unpack(this.endian_mark + "L", value)[0];
                      data = this.tiftag.slice(pointer, pointer + length - 1);
                  } else {
                      data = value.slice(0, length - 1);
                  }
              } else if (t == 3) { // SHORT
                  if (length > 2) {
                      pointer = unpack(this.endian_mark + "L", value)[0];
                      data = unpack(this.endian_mark + nStr("H", length),
                          this.tiftag.slice(pointer, pointer + length * 2));
                  } else {
                      data = unpack(this.endian_mark + nStr("H", length),
                          value.slice(0, length * 2));
                  }
              } else if (t == 4) { // LONG
                  if (length > 1) {
                      pointer = unpack(this.endian_mark + "L", value)[0];
                      data = unpack(this.endian_mark + nStr("L", length),
                          this.tiftag.slice(pointer, pointer + length * 4));
                  } else {
                      data = unpack(this.endian_mark + nStr("L", length),
                          value);
                  }
              } else if (t == 5) { // RATIONAL
                  pointer = unpack(this.endian_mark + "L", value)[0];
                  if (length > 1) {
                      data = [];
                      for (var x = 0; x < length; x++) {
                          data.push([unpack(this.endian_mark + "L",
                                  this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
                                     unpack(this.endian_mark + "L",
                                  this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
                                     ]);
                      }
                  } else {
                      data = [unpack(this.endian_mark + "L",
                              this.tiftag.slice(pointer, pointer + 4))[0],
                              unpack(this.endian_mark + "L",
                              this.tiftag.slice(pointer + 4, pointer + 8))[0]
                              ];
                  }
              } else if (t == 7) { // UNDEFINED BYTES
                  if (length > 4) {
                      pointer = unpack(this.endian_mark + "L", value)[0];
                      data = this.tiftag.slice(pointer, pointer + length);
                  } else {
                      data = value.slice(0, length);
                  }
              } else if (t == 9) { // SLONG
                  if (length > 1) {
                      pointer = unpack(this.endian_mark + "L", value)[0];
                      data = unpack(this.endian_mark + nStr("l", length),
                          this.tiftag.slice(pointer, pointer + length * 4));
                  } else {
                      data = unpack(this.endian_mark + nStr("l", length),
                          value);
                  }
              } else if (t == 10) { // SRATIONAL
                  pointer = unpack(this.endian_mark + "L", value)[0];
                  if (length > 1) {
                      data = [];
                      for (var x = 0; x < length; x++) {
                          data.push([unpack(this.endian_mark + "l",
                                  this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
                                     unpack(this.endian_mark + "l",
                                  this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
                                    ]);
                      }
                  } else {
                      data = [unpack(this.endian_mark + "l",
                              this.tiftag.slice(pointer, pointer + 4))[0],
                              unpack(this.endian_mark + "l",
                              this.tiftag.slice(pointer + 4, pointer + 8))[0]
                             ];
                  }
              } else {
                  throw new Error("Exif might be wrong. Got incorrect value " +
                      "type to decode. type:" + t);
              }

              if ((data instanceof Array) && (data.length == 1)) {
                  return data[0];
              } else {
                  return data;
              }
          },
      };


      if (typeof window !== "undefined" && typeof window.btoa === "function") {
          var btoa = window.btoa;
      }
      if (typeof btoa === "undefined") {
          var btoa = function (input) {        var output = "";
              var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
              var i = 0;
              var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

              while (i < input.length) {

                  chr1 = input.charCodeAt(i++);
                  chr2 = input.charCodeAt(i++);
                  chr3 = input.charCodeAt(i++);

                  enc1 = chr1 >> 2;
                  enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                  enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                  enc4 = chr3 & 63;

                  if (isNaN(chr2)) {
                      enc3 = enc4 = 64;
                  } else if (isNaN(chr3)) {
                      enc4 = 64;
                  }

                  output = output +
                  keyStr.charAt(enc1) + keyStr.charAt(enc2) +
                  keyStr.charAt(enc3) + keyStr.charAt(enc4);

              }

              return output;
          };
      }
      
      
      if (typeof window !== "undefined" && typeof window.atob === "function") {
          var atob = window.atob;
      }
      if (typeof atob === "undefined") {
          var atob = function (input) {
              var output = "";
              var chr1, chr2, chr3;
              var enc1, enc2, enc3, enc4;
              var i = 0;
              var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

              input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

              while (i < input.length) {

                  enc1 = keyStr.indexOf(input.charAt(i++));
                  enc2 = keyStr.indexOf(input.charAt(i++));
                  enc3 = keyStr.indexOf(input.charAt(i++));
                  enc4 = keyStr.indexOf(input.charAt(i++));

                  chr1 = (enc1 << 2) | (enc2 >> 4);
                  chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                  chr3 = ((enc3 & 3) << 6) | enc4;

                  output = output + String.fromCharCode(chr1);

                  if (enc3 != 64) {
                      output = output + String.fromCharCode(chr2);
                  }
                  if (enc4 != 64) {
                      output = output + String.fromCharCode(chr3);
                  }

              }

              return output;
          };
      }


      function pack(mark, array) {
          if (!(array instanceof Array)) {
              throw new Error("'pack' error. Got invalid type argument.");
          }
          if ((mark.length - 1) != array.length) {
              throw new Error("'pack' error. " + (mark.length - 1) + " marks, " + array.length + " elements.");
          }

          var littleEndian;
          if (mark[0] == "<") {
              littleEndian = true;
          } else if (mark[0] == ">") {
              littleEndian = false;
          } else {
              throw new Error("");
          }
          var packed = "";
          var p = 1;
          var val = null;
          var c = null;
          var valStr = null;

          while (c = mark[p]) {
              if (c.toLowerCase() == "b") {
                  val = array[p - 1];
                  if ((c == "b") && (val < 0)) {
                      val += 0x100;
                  }
                  if ((val > 0xff) || (val < 0)) {
                      throw new Error("'pack' error.");
                  } else {
                      valStr = String.fromCharCode(val);
                  }
              } else if (c == "H") {
                  val = array[p - 1];
                  if ((val > 0xffff) || (val < 0)) {
                      throw new Error("'pack' error.");
                  } else {
                      valStr = String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
                          String.fromCharCode(val % 0x100);
                      if (littleEndian) {
                          valStr = valStr.split("").reverse().join("");
                      }
                  }
              } else if (c.toLowerCase() == "l") {
                  val = array[p - 1];
                  if ((c == "l") && (val < 0)) {
                      val += 0x100000000;
                  }
                  if ((val > 0xffffffff) || (val < 0)) {
                      throw new Error("'pack' error.");
                  } else {
                      valStr = String.fromCharCode(Math.floor(val / 0x1000000)) +
                          String.fromCharCode(Math.floor((val % 0x1000000) / 0x10000)) +
                          String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
                          String.fromCharCode(val % 0x100);
                      if (littleEndian) {
                          valStr = valStr.split("").reverse().join("");
                      }
                  }
              } else {
                  throw new Error("'pack' error.");
              }

              packed += valStr;
              p += 1;
          }

          return packed;
      }

      function unpack(mark, str) {
          if (typeof (str) != "string") {
              throw new Error("'unpack' error. Got invalid type argument.");
          }
          var l = 0;
          for (var markPointer = 1; markPointer < mark.length; markPointer++) {
              if (mark[markPointer].toLowerCase() == "b") {
                  l += 1;
              } else if (mark[markPointer].toLowerCase() == "h") {
                  l += 2;
              } else if (mark[markPointer].toLowerCase() == "l") {
                  l += 4;
              } else {
                  throw new Error("'unpack' error. Got invalid mark.");
              }
          }

          if (l != str.length) {
              throw new Error("'unpack' error. Mismatch between symbol and string length. " + l + ":" + str.length);
          }

          var littleEndian;
          if (mark[0] == "<") {
              littleEndian = true;
          } else if (mark[0] == ">") {
              littleEndian = false;
          } else {
              throw new Error("'unpack' error.");
          }
          var unpacked = [];
          var strPointer = 0;
          var p = 1;
          var val = null;
          var c = null;
          var length = null;
          var sliced = "";

          while (c = mark[p]) {
              if (c.toLowerCase() == "b") {
                  length = 1;
                  sliced = str.slice(strPointer, strPointer + length);
                  val = sliced.charCodeAt(0);
                  if ((c == "b") && (val >= 0x80)) {
                      val -= 0x100;
                  }
              } else if (c == "H") {
                  length = 2;
                  sliced = str.slice(strPointer, strPointer + length);
                  if (littleEndian) {
                      sliced = sliced.split("").reverse().join("");
                  }
                  val = sliced.charCodeAt(0) * 0x100 +
                      sliced.charCodeAt(1);
              } else if (c.toLowerCase() == "l") {
                  length = 4;
                  sliced = str.slice(strPointer, strPointer + length);
                  if (littleEndian) {
                      sliced = sliced.split("").reverse().join("");
                  }
                  val = sliced.charCodeAt(0) * 0x1000000 +
                      sliced.charCodeAt(1) * 0x10000 +
                      sliced.charCodeAt(2) * 0x100 +
                      sliced.charCodeAt(3);
                  if ((c == "l") && (val >= 0x80000000)) {
                      val -= 0x100000000;
                  }
              } else {
                  throw new Error("'unpack' error. " + c);
              }

              unpacked.push(val);
              strPointer += length;
              p += 1;
          }

          return unpacked;
      }

      function nStr(ch, num) {
          var str = "";
          for (var i = 0; i < num; i++) {
              str += ch;
          }
          return str;
      }

      function splitIntoSegments(data) {
          if (data.slice(0, 2) != "\xff\xd8") {
              throw new Error("Given data isn't JPEG.");
          }

          var head = 2;
          var segments = ["\xff\xd8"];
          while (true) {
              if (data.slice(head, head + 2) == "\xff\xda") {
                  segments.push(data.slice(head));
                  break;
              } else {
                  var length = unpack(">H", data.slice(head + 2, head + 4))[0];
                  var endPoint = head + length + 2;
                  segments.push(data.slice(head, endPoint));
                  head = endPoint;
              }

              if (head >= data.length) {
                  throw new Error("Wrong JPEG data.");
              }
          }
          return segments;
      }


      function getExifSeg(segments) {
          var seg;
          for (var i = 0; i < segments.length; i++) {
              seg = segments[i];
              if (seg.slice(0, 2) == "\xff\xe1" &&
                     seg.slice(4, 10) == "Exif\x00\x00") {
                  return seg;
              }
          }
          return null;
      }


      function mergeSegments(segments, exif) {
          var hasExifSegment = false;
          var additionalAPP1ExifSegments = [];

          segments.forEach(function(segment, i) {
              // Replace first occurence of APP1:Exif segment
              if (segment.slice(0, 2) == "\xff\xe1" &&
                  segment.slice(4, 10) == "Exif\x00\x00"
              ) {
                  if (!hasExifSegment) {
                      segments[i] = exif;
                      hasExifSegment = true;
                  } else {
                      additionalAPP1ExifSegments.unshift(i);
                  }
              }
          });

          // Remove additional occurences of APP1:Exif segment
          additionalAPP1ExifSegments.forEach(function(segmentIndex) {
              segments.splice(segmentIndex, 1);
          });

          if (!hasExifSegment && exif) {
              segments = [segments[0], exif].concat(segments.slice(1));
          }

          return segments.join("");
      }


      var TYPES = {
          "Byte": 1,
          "Ascii": 2,
          "Short": 3,
          "Long": 4,
          "Rational": 5,
          "Undefined": 7,
          "SLong": 9,
          "SRational": 10
      };


      var TAGS = {
          'Image': {
              11: {
                  'name': 'ProcessingSoftware',
                  'type': 'Ascii'
              },
              254: {
                  'name': 'NewSubfileType',
                  'type': 'Long'
              },
              255: {
                  'name': 'SubfileType',
                  'type': 'Short'
              },
              256: {
                  'name': 'ImageWidth',
                  'type': 'Long'
              },
              257: {
                  'name': 'ImageLength',
                  'type': 'Long'
              },
              258: {
                  'name': 'BitsPerSample',
                  'type': 'Short'
              },
              259: {
                  'name': 'Compression',
                  'type': 'Short'
              },
              262: {
                  'name': 'PhotometricInterpretation',
                  'type': 'Short'
              },
              263: {
                  'name': 'Threshholding',
                  'type': 'Short'
              },
              264: {
                  'name': 'CellWidth',
                  'type': 'Short'
              },
              265: {
                  'name': 'CellLength',
                  'type': 'Short'
              },
              266: {
                  'name': 'FillOrder',
                  'type': 'Short'
              },
              269: {
                  'name': 'DocumentName',
                  'type': 'Ascii'
              },
              270: {
                  'name': 'ImageDescription',
                  'type': 'Ascii'
              },
              271: {
                  'name': 'Make',
                  'type': 'Ascii'
              },
              272: {
                  'name': 'Model',
                  'type': 'Ascii'
              },
              273: {
                  'name': 'StripOffsets',
                  'type': 'Long'
              },
              274: {
                  'name': 'Orientation',
                  'type': 'Short'
              },
              277: {
                  'name': 'SamplesPerPixel',
                  'type': 'Short'
              },
              278: {
                  'name': 'RowsPerStrip',
                  'type': 'Long'
              },
              279: {
                  'name': 'StripByteCounts',
                  'type': 'Long'
              },
              282: {
                  'name': 'XResolution',
                  'type': 'Rational'
              },
              283: {
                  'name': 'YResolution',
                  'type': 'Rational'
              },
              284: {
                  'name': 'PlanarConfiguration',
                  'type': 'Short'
              },
              290: {
                  'name': 'GrayResponseUnit',
                  'type': 'Short'
              },
              291: {
                  'name': 'GrayResponseCurve',
                  'type': 'Short'
              },
              292: {
                  'name': 'T4Options',
                  'type': 'Long'
              },
              293: {
                  'name': 'T6Options',
                  'type': 'Long'
              },
              296: {
                  'name': 'ResolutionUnit',
                  'type': 'Short'
              },
              301: {
                  'name': 'TransferFunction',
                  'type': 'Short'
              },
              305: {
                  'name': 'Software',
                  'type': 'Ascii'
              },
              306: {
                  'name': 'DateTime',
                  'type': 'Ascii'
              },
              315: {
                  'name': 'Artist',
                  'type': 'Ascii'
              },
              316: {
                  'name': 'HostComputer',
                  'type': 'Ascii'
              },
              317: {
                  'name': 'Predictor',
                  'type': 'Short'
              },
              318: {
                  'name': 'WhitePoint',
                  'type': 'Rational'
              },
              319: {
                  'name': 'PrimaryChromaticities',
                  'type': 'Rational'
              },
              320: {
                  'name': 'ColorMap',
                  'type': 'Short'
              },
              321: {
                  'name': 'HalftoneHints',
                  'type': 'Short'
              },
              322: {
                  'name': 'TileWidth',
                  'type': 'Short'
              },
              323: {
                  'name': 'TileLength',
                  'type': 'Short'
              },
              324: {
                  'name': 'TileOffsets',
                  'type': 'Short'
              },
              325: {
                  'name': 'TileByteCounts',
                  'type': 'Short'
              },
              330: {
                  'name': 'SubIFDs',
                  'type': 'Long'
              },
              332: {
                  'name': 'InkSet',
                  'type': 'Short'
              },
              333: {
                  'name': 'InkNames',
                  'type': 'Ascii'
              },
              334: {
                  'name': 'NumberOfInks',
                  'type': 'Short'
              },
              336: {
                  'name': 'DotRange',
                  'type': 'Byte'
              },
              337: {
                  'name': 'TargetPrinter',
                  'type': 'Ascii'
              },
              338: {
                  'name': 'ExtraSamples',
                  'type': 'Short'
              },
              339: {
                  'name': 'SampleFormat',
                  'type': 'Short'
              },
              340: {
                  'name': 'SMinSampleValue',
                  'type': 'Short'
              },
              341: {
                  'name': 'SMaxSampleValue',
                  'type': 'Short'
              },
              342: {
                  'name': 'TransferRange',
                  'type': 'Short'
              },
              343: {
                  'name': 'ClipPath',
                  'type': 'Byte'
              },
              344: {
                  'name': 'XClipPathUnits',
                  'type': 'Long'
              },
              345: {
                  'name': 'YClipPathUnits',
                  'type': 'Long'
              },
              346: {
                  'name': 'Indexed',
                  'type': 'Short'
              },
              347: {
                  'name': 'JPEGTables',
                  'type': 'Undefined'
              },
              351: {
                  'name': 'OPIProxy',
                  'type': 'Short'
              },
              512: {
                  'name': 'JPEGProc',
                  'type': 'Long'
              },
              513: {
                  'name': 'JPEGInterchangeFormat',
                  'type': 'Long'
              },
              514: {
                  'name': 'JPEGInterchangeFormatLength',
                  'type': 'Long'
              },
              515: {
                  'name': 'JPEGRestartInterval',
                  'type': 'Short'
              },
              517: {
                  'name': 'JPEGLosslessPredictors',
                  'type': 'Short'
              },
              518: {
                  'name': 'JPEGPointTransforms',
                  'type': 'Short'
              },
              519: {
                  'name': 'JPEGQTables',
                  'type': 'Long'
              },
              520: {
                  'name': 'JPEGDCTables',
                  'type': 'Long'
              },
              521: {
                  'name': 'JPEGACTables',
                  'type': 'Long'
              },
              529: {
                  'name': 'YCbCrCoefficients',
                  'type': 'Rational'
              },
              530: {
                  'name': 'YCbCrSubSampling',
                  'type': 'Short'
              },
              531: {
                  'name': 'YCbCrPositioning',
                  'type': 'Short'
              },
              532: {
                  'name': 'ReferenceBlackWhite',
                  'type': 'Rational'
              },
              700: {
                  'name': 'XMLPacket',
                  'type': 'Byte'
              },
              18246: {
                  'name': 'Rating',
                  'type': 'Short'
              },
              18249: {
                  'name': 'RatingPercent',
                  'type': 'Short'
              },
              32781: {
                  'name': 'ImageID',
                  'type': 'Ascii'
              },
              33421: {
                  'name': 'CFARepeatPatternDim',
                  'type': 'Short'
              },
              33422: {
                  'name': 'CFAPattern',
                  'type': 'Byte'
              },
              33423: {
                  'name': 'BatteryLevel',
                  'type': 'Rational'
              },
              33432: {
                  'name': 'Copyright',
                  'type': 'Ascii'
              },
              33434: {
                  'name': 'ExposureTime',
                  'type': 'Rational'
              },
              34377: {
                  'name': 'ImageResources',
                  'type': 'Byte'
              },
              34665: {
                  'name': 'ExifTag',
                  'type': 'Long'
              },
              34675: {
                  'name': 'InterColorProfile',
                  'type': 'Undefined'
              },
              34853: {
                  'name': 'GPSTag',
                  'type': 'Long'
              },
              34857: {
                  'name': 'Interlace',
                  'type': 'Short'
              },
              34858: {
                  'name': 'TimeZoneOffset',
                  'type': 'Long'
              },
              34859: {
                  'name': 'SelfTimerMode',
                  'type': 'Short'
              },
              37387: {
                  'name': 'FlashEnergy',
                  'type': 'Rational'
              },
              37388: {
                  'name': 'SpatialFrequencyResponse',
                  'type': 'Undefined'
              },
              37389: {
                  'name': 'Noise',
                  'type': 'Undefined'
              },
              37390: {
                  'name': 'FocalPlaneXResolution',
                  'type': 'Rational'
              },
              37391: {
                  'name': 'FocalPlaneYResolution',
                  'type': 'Rational'
              },
              37392: {
                  'name': 'FocalPlaneResolutionUnit',
                  'type': 'Short'
              },
              37393: {
                  'name': 'ImageNumber',
                  'type': 'Long'
              },
              37394: {
                  'name': 'SecurityClassification',
                  'type': 'Ascii'
              },
              37395: {
                  'name': 'ImageHistory',
                  'type': 'Ascii'
              },
              37397: {
                  'name': 'ExposureIndex',
                  'type': 'Rational'
              },
              37398: {
                  'name': 'TIFFEPStandardID',
                  'type': 'Byte'
              },
              37399: {
                  'name': 'SensingMethod',
                  'type': 'Short'
              },
              40091: {
                  'name': 'XPTitle',
                  'type': 'Byte'
              },
              40092: {
                  'name': 'XPComment',
                  'type': 'Byte'
              },
              40093: {
                  'name': 'XPAuthor',
                  'type': 'Byte'
              },
              40094: {
                  'name': 'XPKeywords',
                  'type': 'Byte'
              },
              40095: {
                  'name': 'XPSubject',
                  'type': 'Byte'
              },
              50341: {
                  'name': 'PrintImageMatching',
                  'type': 'Undefined'
              },
              50706: {
                  'name': 'DNGVersion',
                  'type': 'Byte'
              },
              50707: {
                  'name': 'DNGBackwardVersion',
                  'type': 'Byte'
              },
              50708: {
                  'name': 'UniqueCameraModel',
                  'type': 'Ascii'
              },
              50709: {
                  'name': 'LocalizedCameraModel',
                  'type': 'Byte'
              },
              50710: {
                  'name': 'CFAPlaneColor',
                  'type': 'Byte'
              },
              50711: {
                  'name': 'CFALayout',
                  'type': 'Short'
              },
              50712: {
                  'name': 'LinearizationTable',
                  'type': 'Short'
              },
              50713: {
                  'name': 'BlackLevelRepeatDim',
                  'type': 'Short'
              },
              50714: {
                  'name': 'BlackLevel',
                  'type': 'Rational'
              },
              50715: {
                  'name': 'BlackLevelDeltaH',
                  'type': 'SRational'
              },
              50716: {
                  'name': 'BlackLevelDeltaV',
                  'type': 'SRational'
              },
              50717: {
                  'name': 'WhiteLevel',
                  'type': 'Short'
              },
              50718: {
                  'name': 'DefaultScale',
                  'type': 'Rational'
              },
              50719: {
                  'name': 'DefaultCropOrigin',
                  'type': 'Short'
              },
              50720: {
                  'name': 'DefaultCropSize',
                  'type': 'Short'
              },
              50721: {
                  'name': 'ColorMatrix1',
                  'type': 'SRational'
              },
              50722: {
                  'name': 'ColorMatrix2',
                  'type': 'SRational'
              },
              50723: {
                  'name': 'CameraCalibration1',
                  'type': 'SRational'
              },
              50724: {
                  'name': 'CameraCalibration2',
                  'type': 'SRational'
              },
              50725: {
                  'name': 'ReductionMatrix1',
                  'type': 'SRational'
              },
              50726: {
                  'name': 'ReductionMatrix2',
                  'type': 'SRational'
              },
              50727: {
                  'name': 'AnalogBalance',
                  'type': 'Rational'
              },
              50728: {
                  'name': 'AsShotNeutral',
                  'type': 'Short'
              },
              50729: {
                  'name': 'AsShotWhiteXY',
                  'type': 'Rational'
              },
              50730: {
                  'name': 'BaselineExposure',
                  'type': 'SRational'
              },
              50731: {
                  'name': 'BaselineNoise',
                  'type': 'Rational'
              },
              50732: {
                  'name': 'BaselineSharpness',
                  'type': 'Rational'
              },
              50733: {
                  'name': 'BayerGreenSplit',
                  'type': 'Long'
              },
              50734: {
                  'name': 'LinearResponseLimit',
                  'type': 'Rational'
              },
              50735: {
                  'name': 'CameraSerialNumber',
                  'type': 'Ascii'
              },
              50736: {
                  'name': 'LensInfo',
                  'type': 'Rational'
              },
              50737: {
                  'name': 'ChromaBlurRadius',
                  'type': 'Rational'
              },
              50738: {
                  'name': 'AntiAliasStrength',
                  'type': 'Rational'
              },
              50739: {
                  'name': 'ShadowScale',
                  'type': 'SRational'
              },
              50740: {
                  'name': 'DNGPrivateData',
                  'type': 'Byte'
              },
              50741: {
                  'name': 'MakerNoteSafety',
                  'type': 'Short'
              },
              50778: {
                  'name': 'CalibrationIlluminant1',
                  'type': 'Short'
              },
              50779: {
                  'name': 'CalibrationIlluminant2',
                  'type': 'Short'
              },
              50780: {
                  'name': 'BestQualityScale',
                  'type': 'Rational'
              },
              50781: {
                  'name': 'RawDataUniqueID',
                  'type': 'Byte'
              },
              50827: {
                  'name': 'OriginalRawFileName',
                  'type': 'Byte'
              },
              50828: {
                  'name': 'OriginalRawFileData',
                  'type': 'Undefined'
              },
              50829: {
                  'name': 'ActiveArea',
                  'type': 'Short'
              },
              50830: {
                  'name': 'MaskedAreas',
                  'type': 'Short'
              },
              50831: {
                  'name': 'AsShotICCProfile',
                  'type': 'Undefined'
              },
              50832: {
                  'name': 'AsShotPreProfileMatrix',
                  'type': 'SRational'
              },
              50833: {
                  'name': 'CurrentICCProfile',
                  'type': 'Undefined'
              },
              50834: {
                  'name': 'CurrentPreProfileMatrix',
                  'type': 'SRational'
              },
              50879: {
                  'name': 'ColorimetricReference',
                  'type': 'Short'
              },
              50931: {
                  'name': 'CameraCalibrationSignature',
                  'type': 'Byte'
              },
              50932: {
                  'name': 'ProfileCalibrationSignature',
                  'type': 'Byte'
              },
              50934: {
                  'name': 'AsShotProfileName',
                  'type': 'Byte'
              },
              50935: {
                  'name': 'NoiseReductionApplied',
                  'type': 'Rational'
              },
              50936: {
                  'name': 'ProfileName',
                  'type': 'Byte'
              },
              50937: {
                  'name': 'ProfileHueSatMapDims',
                  'type': 'Long'
              },
              50938: {
                  'name': 'ProfileHueSatMapData1',
                  'type': 'Float'
              },
              50939: {
                  'name': 'ProfileHueSatMapData2',
                  'type': 'Float'
              },
              50940: {
                  'name': 'ProfileToneCurve',
                  'type': 'Float'
              },
              50941: {
                  'name': 'ProfileEmbedPolicy',
                  'type': 'Long'
              },
              50942: {
                  'name': 'ProfileCopyright',
                  'type': 'Byte'
              },
              50964: {
                  'name': 'ForwardMatrix1',
                  'type': 'SRational'
              },
              50965: {
                  'name': 'ForwardMatrix2',
                  'type': 'SRational'
              },
              50966: {
                  'name': 'PreviewApplicationName',
                  'type': 'Byte'
              },
              50967: {
                  'name': 'PreviewApplicationVersion',
                  'type': 'Byte'
              },
              50968: {
                  'name': 'PreviewSettingsName',
                  'type': 'Byte'
              },
              50969: {
                  'name': 'PreviewSettingsDigest',
                  'type': 'Byte'
              },
              50970: {
                  'name': 'PreviewColorSpace',
                  'type': 'Long'
              },
              50971: {
                  'name': 'PreviewDateTime',
                  'type': 'Ascii'
              },
              50972: {
                  'name': 'RawImageDigest',
                  'type': 'Undefined'
              },
              50973: {
                  'name': 'OriginalRawFileDigest',
                  'type': 'Undefined'
              },
              50974: {
                  'name': 'SubTileBlockSize',
                  'type': 'Long'
              },
              50975: {
                  'name': 'RowInterleaveFactor',
                  'type': 'Long'
              },
              50981: {
                  'name': 'ProfileLookTableDims',
                  'type': 'Long'
              },
              50982: {
                  'name': 'ProfileLookTableData',
                  'type': 'Float'
              },
              51008: {
                  'name': 'OpcodeList1',
                  'type': 'Undefined'
              },
              51009: {
                  'name': 'OpcodeList2',
                  'type': 'Undefined'
              },
              51022: {
                  'name': 'OpcodeList3',
                  'type': 'Undefined'
              }
          },
          'Exif': {
              33434: {
                  'name': 'ExposureTime',
                  'type': 'Rational'
              },
              33437: {
                  'name': 'FNumber',
                  'type': 'Rational'
              },
              34850: {
                  'name': 'ExposureProgram',
                  'type': 'Short'
              },
              34852: {
                  'name': 'SpectralSensitivity',
                  'type': 'Ascii'
              },
              34855: {
                  'name': 'ISOSpeedRatings',
                  'type': 'Short'
              },
              34856: {
                  'name': 'OECF',
                  'type': 'Undefined'
              },
              34864: {
                  'name': 'SensitivityType',
                  'type': 'Short'
              },
              34865: {
                  'name': 'StandardOutputSensitivity',
                  'type': 'Long'
              },
              34866: {
                  'name': 'RecommendedExposureIndex',
                  'type': 'Long'
              },
              34867: {
                  'name': 'ISOSpeed',
                  'type': 'Long'
              },
              34868: {
                  'name': 'ISOSpeedLatitudeyyy',
                  'type': 'Long'
              },
              34869: {
                  'name': 'ISOSpeedLatitudezzz',
                  'type': 'Long'
              },
              36864: {
                  'name': 'ExifVersion',
                  'type': 'Undefined'
              },
              36867: {
                  'name': 'DateTimeOriginal',
                  'type': 'Ascii'
              },
              36868: {
                  'name': 'DateTimeDigitized',
                  'type': 'Ascii'
              },
              37121: {
                  'name': 'ComponentsConfiguration',
                  'type': 'Undefined'
              },
              37122: {
                  'name': 'CompressedBitsPerPixel',
                  'type': 'Rational'
              },
              37377: {
                  'name': 'ShutterSpeedValue',
                  'type': 'SRational'
              },
              37378: {
                  'name': 'ApertureValue',
                  'type': 'Rational'
              },
              37379: {
                  'name': 'BrightnessValue',
                  'type': 'SRational'
              },
              37380: {
                  'name': 'ExposureBiasValue',
                  'type': 'SRational'
              },
              37381: {
                  'name': 'MaxApertureValue',
                  'type': 'Rational'
              },
              37382: {
                  'name': 'SubjectDistance',
                  'type': 'Rational'
              },
              37383: {
                  'name': 'MeteringMode',
                  'type': 'Short'
              },
              37384: {
                  'name': 'LightSource',
                  'type': 'Short'
              },
              37385: {
                  'name': 'Flash',
                  'type': 'Short'
              },
              37386: {
                  'name': 'FocalLength',
                  'type': 'Rational'
              },
              37396: {
                  'name': 'SubjectArea',
                  'type': 'Short'
              },
              37500: {
                  'name': 'MakerNote',
                  'type': 'Undefined'
              },
              37510: {
                  'name': 'UserComment',
                  'type': 'Ascii'
              },
              37520: {
                  'name': 'SubSecTime',
                  'type': 'Ascii'
              },
              37521: {
                  'name': 'SubSecTimeOriginal',
                  'type': 'Ascii'
              },
              37522: {
                  'name': 'SubSecTimeDigitized',
                  'type': 'Ascii'
              },
              40960: {
                  'name': 'FlashpixVersion',
                  'type': 'Undefined'
              },
              40961: {
                  'name': 'ColorSpace',
                  'type': 'Short'
              },
              40962: {
                  'name': 'PixelXDimension',
                  'type': 'Long'
              },
              40963: {
                  'name': 'PixelYDimension',
                  'type': 'Long'
              },
              40964: {
                  'name': 'RelatedSoundFile',
                  'type': 'Ascii'
              },
              40965: {
                  'name': 'InteroperabilityTag',
                  'type': 'Long'
              },
              41483: {
                  'name': 'FlashEnergy',
                  'type': 'Rational'
              },
              41484: {
                  'name': 'SpatialFrequencyResponse',
                  'type': 'Undefined'
              },
              41486: {
                  'name': 'FocalPlaneXResolution',
                  'type': 'Rational'
              },
              41487: {
                  'name': 'FocalPlaneYResolution',
                  'type': 'Rational'
              },
              41488: {
                  'name': 'FocalPlaneResolutionUnit',
                  'type': 'Short'
              },
              41492: {
                  'name': 'SubjectLocation',
                  'type': 'Short'
              },
              41493: {
                  'name': 'ExposureIndex',
                  'type': 'Rational'
              },
              41495: {
                  'name': 'SensingMethod',
                  'type': 'Short'
              },
              41728: {
                  'name': 'FileSource',
                  'type': 'Undefined'
              },
              41729: {
                  'name': 'SceneType',
                  'type': 'Undefined'
              },
              41730: {
                  'name': 'CFAPattern',
                  'type': 'Undefined'
              },
              41985: {
                  'name': 'CustomRendered',
                  'type': 'Short'
              },
              41986: {
                  'name': 'ExposureMode',
                  'type': 'Short'
              },
              41987: {
                  'name': 'WhiteBalance',
                  'type': 'Short'
              },
              41988: {
                  'name': 'DigitalZoomRatio',
                  'type': 'Rational'
              },
              41989: {
                  'name': 'FocalLengthIn35mmFilm',
                  'type': 'Short'
              },
              41990: {
                  'name': 'SceneCaptureType',
                  'type': 'Short'
              },
              41991: {
                  'name': 'GainControl',
                  'type': 'Short'
              },
              41992: {
                  'name': 'Contrast',
                  'type': 'Short'
              },
              41993: {
                  'name': 'Saturation',
                  'type': 'Short'
              },
              41994: {
                  'name': 'Sharpness',
                  'type': 'Short'
              },
              41995: {
                  'name': 'DeviceSettingDescription',
                  'type': 'Undefined'
              },
              41996: {
                  'name': 'SubjectDistanceRange',
                  'type': 'Short'
              },
              42016: {
                  'name': 'ImageUniqueID',
                  'type': 'Ascii'
              },
              42032: {
                  'name': 'CameraOwnerName',
                  'type': 'Ascii'
              },
              42033: {
                  'name': 'BodySerialNumber',
                  'type': 'Ascii'
              },
              42034: {
                  'name': 'LensSpecification',
                  'type': 'Rational'
              },
              42035: {
                  'name': 'LensMake',
                  'type': 'Ascii'
              },
              42036: {
                  'name': 'LensModel',
                  'type': 'Ascii'
              },
              42037: {
                  'name': 'LensSerialNumber',
                  'type': 'Ascii'
              },
              42240: {
                  'name': 'Gamma',
                  'type': 'Rational'
              }
          },
          'GPS': {
              0: {
                  'name': 'GPSVersionID',
                  'type': 'Byte'
              },
              1: {
                  'name': 'GPSLatitudeRef',
                  'type': 'Ascii'
              },
              2: {
                  'name': 'GPSLatitude',
                  'type': 'Rational'
              },
              3: {
                  'name': 'GPSLongitudeRef',
                  'type': 'Ascii'
              },
              4: {
                  'name': 'GPSLongitude',
                  'type': 'Rational'
              },
              5: {
                  'name': 'GPSAltitudeRef',
                  'type': 'Byte'
              },
              6: {
                  'name': 'GPSAltitude',
                  'type': 'Rational'
              },
              7: {
                  'name': 'GPSTimeStamp',
                  'type': 'Rational'
              },
              8: {
                  'name': 'GPSSatellites',
                  'type': 'Ascii'
              },
              9: {
                  'name': 'GPSStatus',
                  'type': 'Ascii'
              },
              10: {
                  'name': 'GPSMeasureMode',
                  'type': 'Ascii'
              },
              11: {
                  'name': 'GPSDOP',
                  'type': 'Rational'
              },
              12: {
                  'name': 'GPSSpeedRef',
                  'type': 'Ascii'
              },
              13: {
                  'name': 'GPSSpeed',
                  'type': 'Rational'
              },
              14: {
                  'name': 'GPSTrackRef',
                  'type': 'Ascii'
              },
              15: {
                  'name': 'GPSTrack',
                  'type': 'Rational'
              },
              16: {
                  'name': 'GPSImgDirectionRef',
                  'type': 'Ascii'
              },
              17: {
                  'name': 'GPSImgDirection',
                  'type': 'Rational'
              },
              18: {
                  'name': 'GPSMapDatum',
                  'type': 'Ascii'
              },
              19: {
                  'name': 'GPSDestLatitudeRef',
                  'type': 'Ascii'
              },
              20: {
                  'name': 'GPSDestLatitude',
                  'type': 'Rational'
              },
              21: {
                  'name': 'GPSDestLongitudeRef',
                  'type': 'Ascii'
              },
              22: {
                  'name': 'GPSDestLongitude',
                  'type': 'Rational'
              },
              23: {
                  'name': 'GPSDestBearingRef',
                  'type': 'Ascii'
              },
              24: {
                  'name': 'GPSDestBearing',
                  'type': 'Rational'
              },
              25: {
                  'name': 'GPSDestDistanceRef',
                  'type': 'Ascii'
              },
              26: {
                  'name': 'GPSDestDistance',
                  'type': 'Rational'
              },
              27: {
                  'name': 'GPSProcessingMethod',
                  'type': 'Undefined'
              },
              28: {
                  'name': 'GPSAreaInformation',
                  'type': 'Undefined'
              },
              29: {
                  'name': 'GPSDateStamp',
                  'type': 'Ascii'
              },
              30: {
                  'name': 'GPSDifferential',
                  'type': 'Short'
              },
              31: {
                  'name': 'GPSHPositioningError',
                  'type': 'Rational'
              }
          },
          'Interop': {
              1: {
                  'name': 'InteroperabilityIndex',
                  'type': 'Ascii'
              }
          },
      };
      TAGS["0th"] = TAGS["Image"];
      TAGS["1st"] = TAGS["Image"];
      that.TAGS = TAGS;

      
      that.ImageIFD = {
          ProcessingSoftware:11,
          NewSubfileType:254,
          SubfileType:255,
          ImageWidth:256,
          ImageLength:257,
          BitsPerSample:258,
          Compression:259,
          PhotometricInterpretation:262,
          Threshholding:263,
          CellWidth:264,
          CellLength:265,
          FillOrder:266,
          DocumentName:269,
          ImageDescription:270,
          Make:271,
          Model:272,
          StripOffsets:273,
          Orientation:274,
          SamplesPerPixel:277,
          RowsPerStrip:278,
          StripByteCounts:279,
          XResolution:282,
          YResolution:283,
          PlanarConfiguration:284,
          GrayResponseUnit:290,
          GrayResponseCurve:291,
          T4Options:292,
          T6Options:293,
          ResolutionUnit:296,
          TransferFunction:301,
          Software:305,
          DateTime:306,
          Artist:315,
          HostComputer:316,
          Predictor:317,
          WhitePoint:318,
          PrimaryChromaticities:319,
          ColorMap:320,
          HalftoneHints:321,
          TileWidth:322,
          TileLength:323,
          TileOffsets:324,
          TileByteCounts:325,
          SubIFDs:330,
          InkSet:332,
          InkNames:333,
          NumberOfInks:334,
          DotRange:336,
          TargetPrinter:337,
          ExtraSamples:338,
          SampleFormat:339,
          SMinSampleValue:340,
          SMaxSampleValue:341,
          TransferRange:342,
          ClipPath:343,
          XClipPathUnits:344,
          YClipPathUnits:345,
          Indexed:346,
          JPEGTables:347,
          OPIProxy:351,
          JPEGProc:512,
          JPEGInterchangeFormat:513,
          JPEGInterchangeFormatLength:514,
          JPEGRestartInterval:515,
          JPEGLosslessPredictors:517,
          JPEGPointTransforms:518,
          JPEGQTables:519,
          JPEGDCTables:520,
          JPEGACTables:521,
          YCbCrCoefficients:529,
          YCbCrSubSampling:530,
          YCbCrPositioning:531,
          ReferenceBlackWhite:532,
          XMLPacket:700,
          Rating:18246,
          RatingPercent:18249,
          ImageID:32781,
          CFARepeatPatternDim:33421,
          CFAPattern:33422,
          BatteryLevel:33423,
          Copyright:33432,
          ExposureTime:33434,
          ImageResources:34377,
          ExifTag:34665,
          InterColorProfile:34675,
          GPSTag:34853,
          Interlace:34857,
          TimeZoneOffset:34858,
          SelfTimerMode:34859,
          FlashEnergy:37387,
          SpatialFrequencyResponse:37388,
          Noise:37389,
          FocalPlaneXResolution:37390,
          FocalPlaneYResolution:37391,
          FocalPlaneResolutionUnit:37392,
          ImageNumber:37393,
          SecurityClassification:37394,
          ImageHistory:37395,
          ExposureIndex:37397,
          TIFFEPStandardID:37398,
          SensingMethod:37399,
          XPTitle:40091,
          XPComment:40092,
          XPAuthor:40093,
          XPKeywords:40094,
          XPSubject:40095,
          PrintImageMatching:50341,
          DNGVersion:50706,
          DNGBackwardVersion:50707,
          UniqueCameraModel:50708,
          LocalizedCameraModel:50709,
          CFAPlaneColor:50710,
          CFALayout:50711,
          LinearizationTable:50712,
          BlackLevelRepeatDim:50713,
          BlackLevel:50714,
          BlackLevelDeltaH:50715,
          BlackLevelDeltaV:50716,
          WhiteLevel:50717,
          DefaultScale:50718,
          DefaultCropOrigin:50719,
          DefaultCropSize:50720,
          ColorMatrix1:50721,
          ColorMatrix2:50722,
          CameraCalibration1:50723,
          CameraCalibration2:50724,
          ReductionMatrix1:50725,
          ReductionMatrix2:50726,
          AnalogBalance:50727,
          AsShotNeutral:50728,
          AsShotWhiteXY:50729,
          BaselineExposure:50730,
          BaselineNoise:50731,
          BaselineSharpness:50732,
          BayerGreenSplit:50733,
          LinearResponseLimit:50734,
          CameraSerialNumber:50735,
          LensInfo:50736,
          ChromaBlurRadius:50737,
          AntiAliasStrength:50738,
          ShadowScale:50739,
          DNGPrivateData:50740,
          MakerNoteSafety:50741,
          CalibrationIlluminant1:50778,
          CalibrationIlluminant2:50779,
          BestQualityScale:50780,
          RawDataUniqueID:50781,
          OriginalRawFileName:50827,
          OriginalRawFileData:50828,
          ActiveArea:50829,
          MaskedAreas:50830,
          AsShotICCProfile:50831,
          AsShotPreProfileMatrix:50832,
          CurrentICCProfile:50833,
          CurrentPreProfileMatrix:50834,
          ColorimetricReference:50879,
          CameraCalibrationSignature:50931,
          ProfileCalibrationSignature:50932,
          AsShotProfileName:50934,
          NoiseReductionApplied:50935,
          ProfileName:50936,
          ProfileHueSatMapDims:50937,
          ProfileHueSatMapData1:50938,
          ProfileHueSatMapData2:50939,
          ProfileToneCurve:50940,
          ProfileEmbedPolicy:50941,
          ProfileCopyright:50942,
          ForwardMatrix1:50964,
          ForwardMatrix2:50965,
          PreviewApplicationName:50966,
          PreviewApplicationVersion:50967,
          PreviewSettingsName:50968,
          PreviewSettingsDigest:50969,
          PreviewColorSpace:50970,
          PreviewDateTime:50971,
          RawImageDigest:50972,
          OriginalRawFileDigest:50973,
          SubTileBlockSize:50974,
          RowInterleaveFactor:50975,
          ProfileLookTableDims:50981,
          ProfileLookTableData:50982,
          OpcodeList1:51008,
          OpcodeList2:51009,
          OpcodeList3:51022,
          NoiseProfile:51041,
      };

      
      that.ExifIFD = {
          ExposureTime:33434,
          FNumber:33437,
          ExposureProgram:34850,
          SpectralSensitivity:34852,
          ISOSpeedRatings:34855,
          OECF:34856,
          SensitivityType:34864,
          StandardOutputSensitivity:34865,
          RecommendedExposureIndex:34866,
          ISOSpeed:34867,
          ISOSpeedLatitudeyyy:34868,
          ISOSpeedLatitudezzz:34869,
          ExifVersion:36864,
          DateTimeOriginal:36867,
          DateTimeDigitized:36868,
          ComponentsConfiguration:37121,
          CompressedBitsPerPixel:37122,
          ShutterSpeedValue:37377,
          ApertureValue:37378,
          BrightnessValue:37379,
          ExposureBiasValue:37380,
          MaxApertureValue:37381,
          SubjectDistance:37382,
          MeteringMode:37383,
          LightSource:37384,
          Flash:37385,
          FocalLength:37386,
          SubjectArea:37396,
          MakerNote:37500,
          UserComment:37510,
          SubSecTime:37520,
          SubSecTimeOriginal:37521,
          SubSecTimeDigitized:37522,
          FlashpixVersion:40960,
          ColorSpace:40961,
          PixelXDimension:40962,
          PixelYDimension:40963,
          RelatedSoundFile:40964,
          InteroperabilityTag:40965,
          FlashEnergy:41483,
          SpatialFrequencyResponse:41484,
          FocalPlaneXResolution:41486,
          FocalPlaneYResolution:41487,
          FocalPlaneResolutionUnit:41488,
          SubjectLocation:41492,
          ExposureIndex:41493,
          SensingMethod:41495,
          FileSource:41728,
          SceneType:41729,
          CFAPattern:41730,
          CustomRendered:41985,
          ExposureMode:41986,
          WhiteBalance:41987,
          DigitalZoomRatio:41988,
          FocalLengthIn35mmFilm:41989,
          SceneCaptureType:41990,
          GainControl:41991,
          Contrast:41992,
          Saturation:41993,
          Sharpness:41994,
          DeviceSettingDescription:41995,
          SubjectDistanceRange:41996,
          ImageUniqueID:42016,
          CameraOwnerName:42032,
          BodySerialNumber:42033,
          LensSpecification:42034,
          LensMake:42035,
          LensModel:42036,
          LensSerialNumber:42037,
          Gamma:42240,
      };


      that.GPSIFD = {
          GPSVersionID:0,
          GPSLatitudeRef:1,
          GPSLatitude:2,
          GPSLongitudeRef:3,
          GPSLongitude:4,
          GPSAltitudeRef:5,
          GPSAltitude:6,
          GPSTimeStamp:7,
          GPSSatellites:8,
          GPSStatus:9,
          GPSMeasureMode:10,
          GPSDOP:11,
          GPSSpeedRef:12,
          GPSSpeed:13,
          GPSTrackRef:14,
          GPSTrack:15,
          GPSImgDirectionRef:16,
          GPSImgDirection:17,
          GPSMapDatum:18,
          GPSDestLatitudeRef:19,
          GPSDestLatitude:20,
          GPSDestLongitudeRef:21,
          GPSDestLongitude:22,
          GPSDestBearingRef:23,
          GPSDestBearing:24,
          GPSDestDistanceRef:25,
          GPSDestDistance:26,
          GPSProcessingMethod:27,
          GPSAreaInformation:28,
          GPSDateStamp:29,
          GPSDifferential:30,
          GPSHPositioningError:31,
      };


      that.InteropIFD = {
          InteroperabilityIndex:1,
      };

      that.GPSHelper = {
          degToDmsRational:function (degFloat) {
              var degAbs = Math.abs(degFloat);
              var minFloat = degAbs % 1 * 60;
              var secFloat = minFloat % 1 * 60;
              var deg = Math.floor(degAbs);
              var min = Math.floor(minFloat);
              var sec = Math.round(secFloat * 100);

              return [[deg, 1], [min, 1], [sec, 100]];
          },

          dmsRationalToDeg:function (dmsArray, ref) {
              var sign = (ref === 'S' || ref === 'W') ? -1.0 : 1.0;
              var deg = dmsArray[0][0] / dmsArray[0][1] +
                        dmsArray[1][0] / dmsArray[1][1] / 60.0 +
                        dmsArray[2][0] / dmsArray[2][1] / 3600.0;

              return deg * sign;
          }
      };
      
      
      {
          if ( module.exports) {
              exports = module.exports = that;
          }
          exports.piexif = that;
      }

  })();
  });
  var piexif_1 = piexif.piexif;

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
      const r = piexif.load(img);
      return JSON.parse(r[`0th`][piexif.ImageIFD.Make])
    } catch (ex) {
      return false
    }
  };

  const save = async (weave) => {
    const obj = {
      "0th": {
        [piexif.ImageIFD.Make]: JSON.stringify(weave),
        [piexif.ImageIFD.Software]: `isekai`
      },
      Exif: {},
      GPS: {}
    };

    FileSaver_min.saveAs(piexif.insert(piexif.dump(obj), await image(weave)), `${weave.name.get()}.seed.jpg`);
  };

  const image = async (weave) => {
    const tn = tile(`/${weave.name.get()}`);
    const t = await Tile({
      width: 4,
      height: 4,
      data: [
        `18 19 19 20`,
        `50 ${tn} 0 52`,
        `50 0 ${tn} 52`,
        `82 83 83 84`
      ].join(` `)
    });

    return new Promise((resolve) => {
      const image = new Image();
      image.src = t;

      image.onload = () => {
        const canvas = document.createElement(`canvas`);
        canvas.width = 64;
        canvas.height = 64;

        const ctx = canvas.getContext(`2d`);
        ctx.imageSmoothingEnabled = false;
        ctx.filter = `sepia(1) hue-rotate(90deg)`;
        ctx.drawImage(image, 0, 0, 64, 64, 0, 0, 64, 64);
        ctx.lineWidth = 4;
        ctx.lineCap = `round`;
        // ctx.rect(0, 0, 64, 64)
        // ctx.rect(4, 4, 56, 56)
        ctx.stroke();
        resolve(canvas.toDataURL(`image/jpeg`, 0.95));
      };
    })
  };

  const VERSION = 3;
  const HOUR_AGO = IDBKeyRange.upperBound(Date.now() - 1000 * 60 * 60);
  let db;

  let load_res;
  const loaded = new Promise((resolve) => { load_res = resolve; });
  const data = new Promise((resolve) => {
    const req = window.indexedDB.open(`isekai`, VERSION);

    req.onupgradeneeded = async (e) => {
      db = e.target.result;

      db.createObjectStore(`wheel`, { keyPath: `date` });

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
      args: [wheel]
    });
  };

  const clean = () => query({
    action: `delete`,
    args: [HOUR_AGO]
  });

  window.query = query;

  const init = async () => {
    const result = await query({
      action: `getAll`
    }).catch((e) => console.warn(`DB`, e.target.error));

    if (result && result.length > 0) {
      const { weaves, running } = result.pop();
      delete weaves[Wheel.SYSTEM];

      Wheel.spawn(weaves);

      Object.keys(running).forEach((id) => {
        if (id === Wheel.SYSTEM) return
        if (!Wheel.get(id)) return
        Wheel.start(id);
      });
    }

    load_res(true);

    tick.listen((t) => {
      if (
        t % 10 !== 0 ||
        db === undefined ||
        !loaded
      ) return

      save$1();
      if (t % 100 === 0) clean();
    });
  };

  init();

  path.listen(async ($path) => {
    if ($path.length < 3) return
    const url = `https://raw.githubusercontent.com/${$path[0]}/${$path[1]}/master/${$path[2]}.jpg`;

    const reader = new FileReader();
    const blob = await fetch(url)
      .then((r) => r.blob());

    reader.readAsDataURL(blob);

    reader.addEventListener(`load`, () => {
      const data = load(reader.result);
      if (!data) return

      Wheel.spawn({
        [data.name]: data
      });

      Wheel.start(data.name);
    });
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
      key,
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
              update(component.$$);
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
  function update($$) {
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
  function init$1(component, options, instance, create_fragment, not_equal, props) {
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

  /* src/ui/image/Tile.svelte generated by Svelte v3.14.1 */
  const file = "src/ui/image/Tile.svelte";

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

  // (24:28)  <img     class="tileset"      alt="tileset image"     {src}
  function create_then_block(ctx) {
  	let img;
  	let img_src_value;

  	const block = {
  		c: function create() {
  			img = element("img");
  			attr_dev(img, "class", "tileset svelte-1ifhj4a");
  			attr_dev(img, "alt", "tileset image");
  			if (img.src !== (img_src_value = ctx.src)) attr_dev(img, "src", img_src_value);
  			add_location(img, file, 24, 0, 353);
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
  		source: "(24:28)  <img     class=\\\"tileset\\\"      alt=\\\"tileset image\\\"     {src}",
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

  function create_fragment(ctx) {
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
  		id: create_fragment.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance($$self, $$props, $$invalidate) {
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

  		init$1(this, options, instance, create_fragment, safe_not_equal, {
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
  			id: create_fragment.name
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
  const file$1 = "src/ui/weave/Postage.svelte";

  function create_fragment$1(ctx) {
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
  			add_location(div, file$1, 23, 0, 408);
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
  		id: create_fragment$1.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$1($$self, $$props, $$invalidate) {
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
  		init$1(this, options, instance$1, create_fragment$1, safe_not_equal, { address: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Postage",
  			options,
  			id: create_fragment$1.name
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
        const col = Color(color(JSON.stringify(txt)));

        node.style.backgroundColor = col.darkenByRatio(0.7).setAlpha(0.925).toCSS();
      }
    };

    handler.update(txt_init);
    return handler
  };

  /* src/ui/weave/Picker.svelte generated by Svelte v3.14.1 */
  const file$2 = "src/ui/weave/Picker.svelte";

  // (47:0) {#if nameit}
  function create_if_block(ctx) {
  	let div4;
  	let h2;
  	let t1;
  	let div0;
  	let t2;
  	let input;
  	let t3;
  	let div3;
  	let div1;
  	let t5;
  	let div2;
  	let color_action;
  	let current;
  	let dispose;

  	const postage = new Postage({
  			props: { address: `/${ctx.name}` },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div4 = element("div");
  			h2 = element("h2");
  			h2.textContent = "Name It!";
  			t1 = space();
  			div0 = element("div");
  			create_component(postage.$$.fragment);
  			t2 = space();
  			input = element("input");
  			t3 = space();
  			div3 = element("div");
  			div1 = element("div");
  			div1.textContent = "Cancel";
  			t5 = space();
  			div2 = element("div");
  			div2.textContent = "Plant";
  			add_location(h2, file$2, 51, 2, 959);
  			attr_dev(div0, "class", "spirit svelte-1hnyn9v");
  			add_location(div0, file$2, 53, 2, 980);
  			attr_dev(input, "class", "nameit svelte-1hnyn9v");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "placeholder", "Name it");
  			add_location(input, file$2, 57, 2, 1049);
  			attr_dev(div1, "class", "false svelte-1hnyn9v");
  			add_location(div1, file$2, 68, 4, 1258);
  			attr_dev(div2, "class", "true svelte-1hnyn9v");
  			add_location(div2, file$2, 69, 4, 1330);
  			attr_dev(div3, "class", "controls svelte-1hnyn9v");
  			add_location(div3, file$2, 67, 2, 1231);
  			attr_dev(div4, "class", "nameprompt svelte-1hnyn9v");
  			add_location(div4, file$2, 47, 0, 903);

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
  			mount_component(postage, div0, null);
  			append_dev(div4, t2);
  			append_dev(div4, input);
  			set_input_value(input, ctx.name);
  			append_dev(div4, t3);
  			append_dev(div4, div3);
  			append_dev(div3, div1);
  			append_dev(div3, t5);
  			append_dev(div3, div2);
  			color_action = color$1.call(null, div4, `/${ctx.name}`) || ({});
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const postage_changes = {};
  			if (changed.name) postage_changes.address = `/${ctx.name}`;
  			postage.$set(postage_changes);

  			if (changed.name && input.value !== ctx.name) {
  				set_input_value(input, ctx.name);
  			}

  			if (is_function(color_action.update) && changed.name) color_action.update.call(null, `/${ctx.name}`);
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
  			if (detaching) detach_dev(div4);
  			destroy_component(postage);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block.name,
  		type: "if",
  		source: "(47:0) {#if nameit}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$2(ctx) {
  	let t0;
  	let div;
  	let t1;
  	let input;
  	let current;
  	let dispose;
  	let if_block = ctx.nameit && create_if_block(ctx);

  	const block = {
  		c: function create() {
  			if (if_block) if_block.c();
  			t0 = space();
  			div = element("div");
  			t1 = space();
  			input = element("input");
  			attr_dev(div, "class", "picker svelte-1hnyn9v");
  			add_location(div, file$2, 74, 0, 1402);
  			attr_dev(input, "type", "file");
  			attr_dev(input, "class", "file svelte-1hnyn9v");
  			input.multiple = "multiple";
  			add_location(input, file$2, 82, 0, 1504);

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
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (ctx.nameit) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block(ctx);
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
  		id: create_fragment$2.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$2($$self, $$props, $$invalidate) {
  	let files;
  	let nameit = false;

  	const drop = e => {
  		dragover = false;
  		const files = e.dataTransfer.files;

  		for (let i = 0; i < files.length; i++) {
  			const reader = new FileReader();

  			reader.onloadend = e => {
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
  		init$1(this, options, instance$2, create_fragment$2, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Picker",
  			options,
  			id: create_fragment$2.name
  		});
  	}
  }

  /* src/ui/weave/MainScreen.svelte generated by Svelte v3.14.1 */
  const file$3 = "src/ui/weave/MainScreen.svelte";

  function create_fragment$3(ctx) {
  	let div;
  	let insert_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			div = element("div");
  			attr_dev(div, "class", "main svelte-ipuen4");
  			toggle_class(div, "full", ctx.full);
  			add_location(div, file$3, 32, 0, 546);
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
  		id: create_fragment$3.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$3($$self, $$props, $$invalidate) {
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
  		init$1(this, options, instance$3, create_fragment$3, safe_not_equal, { full: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "MainScreen",
  			options,
  			id: create_fragment$3.name
  		});
  	}

  	get full() {
  		throw new Error("<MainScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set full(value) {
  		throw new Error("<MainScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/explore/Omni.svelte generated by Svelte v3.14.1 */
  const file$4 = "src/ui/weave/explore/Omni.svelte";

  function create_fragment$4(ctx) {
  	let input;
  	let focusd_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			input = element("input");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "class", "omni svelte-147gyvi");
  			set_style(input, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			attr_dev(input, "placeholder", ctx.tru_placeholder);
  			add_location(input, file$4, 54, 0, 1059);

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
  			focusd_action = ctx.focusd.call(null, input, ctx.focus) || ({});
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

  			if (is_function(focusd_action.update) && changed.focus) focusd_action.update.call(null, ctx.focus);
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
  		id: create_fragment$4.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$4($$self, $$props, $$invalidate) {
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
  	let { focus = false } = $$props;
  	const place_default = system ? `!` : `! > + -`;
  	let placeholder = place_default;

  	const calc_offset = ($t, $p) => {
  		if ($p.length < 20) return placeholder;
  		const offset = Math.floor($t / 2) % $p.length;
  		return $p.slice(-offset) + $p.slice(0, -offset);
  	};

  	const focusd = (node, init) => {
  		if (init) node.focus();

  		return {
  			update: val => {
  				if (val) node.focus();
  			}
  		};
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
  		if (commands[data[0]]) commands[data[0]](data);
  		command(data);
  		$$invalidate("omni", omni = ``);
  	};

  	const writable_props = ["command", "system", "focus"];

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
  		if ("focus" in $$props) $$invalidate("focus", focus = $$props.focus);
  	};

  	$$self.$capture_state = () => {
  		return {
  			command,
  			omni,
  			system,
  			focus,
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
  		if ("focus" in $$props) $$invalidate("focus", focus = $$props.focus);
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
  		focus,
  		focusd,
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
  		init$1(this, options, instance$4, create_fragment$4, safe_not_equal, { command: 0, system: 0, focus: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Omni",
  			options,
  			id: create_fragment$4.name
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

  	get focus() {
  		throw new Error("<Omni>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set focus(value) {
  		throw new Error("<Omni>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/explore/Thread.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1 } = globals;
  const file$5 = "src/ui/weave/explore/Thread.svelte";

  function get_each_context(ctx, list, i) {
  	const child_ctx = Object_1.create(ctx);
  	child_ctx.link = list[i];
  	return child_ctx;
  }

  // (213:2) {:else}
  function create_else_block_2(ctx) {
  	let textarea;
  	let textarea_style_value;
  	let focus_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			textarea = element("textarea");
  			attr_dev(textarea, "class", "edit svelte-1ifqcjd");
  			attr_dev(textarea, "type", "text");
  			attr_dev(textarea, "style", textarea_style_value = `background-color: ${ctx.$THEME_BG}; border:0.5rem solid ${ctx.$THEME_BORDER};`);
  			add_location(textarea, file$5, 213, 4, 4070);

  			dispose = [
  				listen_dev(textarea, "input", ctx.textarea_input_handler),
  				listen_dev(textarea, "blur", ctx.blur_handler, false, false, false),
  				listen_dev(textarea, "keydown", ctx.keydown_handler, false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, textarea, anchor);
  			set_input_value(textarea, ctx.edit);
  			focus_action = ctx.focus.call(null, textarea) || ({});
  		},
  		p: function update(changed, ctx) {
  			if ((changed.$THEME_BG || changed.$THEME_BORDER) && textarea_style_value !== (textarea_style_value = `background-color: ${ctx.$THEME_BG}; border:0.5rem solid ${ctx.$THEME_BORDER};`)) {
  				attr_dev(textarea, "style", textarea_style_value);
  			}

  			if (changed.edit) {
  				set_input_value(textarea, ctx.edit);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(textarea);
  			if (focus_action && is_function(focus_action.destroy)) focus_action.destroy();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block_2.name,
  		type: "else",
  		source: "(213:2) {:else}",
  		ctx
  	});

  	return block;
  }

  // (183:2) {#if !editing}
  function create_if_block$1(ctx) {
  	let each_1_anchor;
  	let each_value = ctx.tru_thread;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
  	}

  	let each_1_else = null;

  	if (!each_value.length) {
  		each_1_else = create_else_block_1(ctx);
  		each_1_else.c();
  	}

  	const block = {
  		c: function create() {
  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			each_1_anchor = empty();
  		},
  		m: function mount(target, anchor) {
  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(target, anchor);
  			}

  			insert_dev(target, each_1_anchor, anchor);

  			if (each_1_else) {
  				each_1_else.m(target, anchor);
  			}
  		},
  		p: function update(changed, ctx) {
  			if (changed.tru_thread || changed.style || changed.chain || changed.$feed || changed.weave || changed.time_cut || changed.condense || changed.$THEME_BORDER) {
  				each_value = ctx.tru_thread;
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  					} else {
  						each_blocks[i] = create_each_block(child_ctx);
  						each_blocks[i].c();
  						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
  					}
  				}

  				for (; i < each_blocks.length; i += 1) {
  					each_blocks[i].d(1);
  				}

  				each_blocks.length = each_value.length;
  			}

  			if (!each_value.length && each_1_else) {
  				each_1_else.p(changed, ctx);
  			} else if (!each_value.length) {
  				each_1_else = create_else_block_1(ctx);
  				each_1_else.c();
  				each_1_else.m(each_1_anchor.parentNode, each_1_anchor);
  			} else if (each_1_else) {
  				each_1_else.d(1);
  				each_1_else = null;
  			}
  		},
  		d: function destroy(detaching) {
  			destroy_each(each_blocks, detaching);
  			if (detaching) detach_dev(each_1_anchor);
  			if (each_1_else) each_1_else.d(detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$1.name,
  		type: "if",
  		source: "(183:2) {#if !editing}",
  		ctx
  	});

  	return block;
  }

  // (204:4) {:else}
  function create_else_block_1(ctx) {
  	let div;
  	let t;

  	const block = {
  		c: function create() {
  			div = element("div");
  			t = text("+\n      ");
  			attr_dev(div, "class", "cap svelte-1ifqcjd");
  			set_style(div, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			add_location(div, file$5, 204, 6, 3933);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			append_dev(div, t);
  		},
  		p: function update(changed, ctx) {
  			if (changed.$THEME_BORDER) {
  				set_style(div, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block_1.name,
  		type: "else",
  		source: "(204:4) {:else}",
  		ctx
  	});

  	return block;
  }

  // (193:6) {:else}
  function create_else_block(ctx) {
  	let div;
  	let t0_value = ctx.condense(ctx.link) + "";
  	let t0;
  	let t1;
  	let color_action;

  	const block = {
  		c: function create() {
  			div = element("div");
  			t0 = text(t0_value);
  			t1 = space();
  			attr_dev(div, "class", "thread svelte-1ifqcjd");
  			attr_dev(div, "style", ctx.style);
  			toggle_class(div, "active", ctx.$feed[`${ctx.weave.name.get()}/${ctx.link}`] > ctx.time_cut);
  			add_location(div, file$5, 193, 8, 3690);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			append_dev(div, t0);
  			append_dev(div, t1);
  			color_action = color$1.call(null, div, ctx.condense(ctx.link)) || ({});
  		},
  		p: function update(changed, new_ctx) {
  			ctx = new_ctx;
  			if (changed.tru_thread && t0_value !== (t0_value = ctx.condense(ctx.link) + "")) set_data_dev(t0, t0_value);

  			if (changed.style) {
  				attr_dev(div, "style", ctx.style);
  			}

  			if (is_function(color_action.update) && changed.tru_thread) color_action.update.call(null, ctx.condense(ctx.link));

  			if (changed.$feed || changed.weave || changed.tru_thread || changed.time_cut) {
  				toggle_class(div, "active", ctx.$feed[`${ctx.weave.name.get()}/${ctx.link}`] > ctx.time_cut);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block.name,
  		type: "else",
  		source: "(193:6) {:else}",
  		ctx
  	});

  	return block;
  }

  // (185:6) {#if link[0] === `#`}
  function create_if_block_1(ctx) {
  	let div;
  	let t0_value = ctx.link + "";
  	let t0;
  	let t1;

  	const block = {
  		c: function create() {
  			div = element("div");
  			t0 = text(t0_value);
  			t1 = space();
  			attr_dev(div, "class", "thread svelte-1ifqcjd");
  			attr_dev(div, "style", ctx.style);
  			toggle_class(div, "active", ctx.chain.some(ctx.func));
  			add_location(div, file$5, 185, 0, 3481);
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
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1.name,
  		type: "if",
  		source: "(185:6) {#if link[0] === `#`}",
  		ctx
  	});

  	return block;
  }

  // (184:4) {#each tru_thread as link}
  function create_each_block(ctx) {
  	let if_block_anchor;

  	function select_block_type_1(changed, ctx) {
  		if (ctx.link[0] === `#`) return create_if_block_1;
  		return create_else_block;
  	}

  	let current_block_type = select_block_type_1(null, ctx);
  	let if_block = current_block_type(ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		m: function mount(target, anchor) {
  			if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (current_block_type === (current_block_type = select_block_type_1(changed, ctx)) && if_block) {
  				if_block.p(changed, ctx);
  			} else {
  				if_block.d(1);
  				if_block = current_block_type(ctx);

  				if (if_block) {
  					if_block.c();
  					if_block.m(if_block_anchor.parentNode, if_block_anchor);
  				}
  			}
  		},
  		d: function destroy(detaching) {
  			if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block.name,
  		type: "each",
  		source: "(184:4) {#each tru_thread as link}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$5(ctx) {
  	let div;
  	let dispose;

  	function select_block_type(changed, ctx) {
  		if (!ctx.editing) return create_if_block$1;
  		return create_else_block_2;
  	}

  	let current_block_type = select_block_type(null, ctx);
  	let if_block = current_block_type(ctx);

  	const block = {
  		c: function create() {
  			div = element("div");
  			if_block.c();
  			attr_dev(div, "class", "spot svelte-1ifqcjd");
  			attr_dev(div, "data:super", ctx.super_open);
  			add_location(div, file$5, 173, 0, 3262);
  			dispose = listen_dev(div, "click", ctx.click_handler, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			if_block.m(div, null);
  		},
  		p: function update(changed, ctx) {
  			if (current_block_type === (current_block_type = select_block_type(changed, ctx)) && if_block) {
  				if_block.p(changed, ctx);
  			} else {
  				if_block.d(1);
  				if_block = current_block_type(ctx);

  				if (if_block) {
  					if_block.c();
  					if_block.m(div, null);
  				}
  			}

  			if (changed.super_open) {
  				attr_dev(div, "data:super", ctx.super_open);
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if_block.d();
  			dispose();
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
  	let $threads,
  		$$unsubscribe_threads = noop,
  		$$subscribe_threads = () => ($$unsubscribe_threads(), $$unsubscribe_threads = subscribe(threads, $$value => $$invalidate("$threads", $threads = $$value)), threads);

  	let $tick;
  	let $THEME_BG;
  	let $THEME_BORDER;

  	let $feed,
  		$$unsubscribe_feed = noop,
  		$$subscribe_feed = () => ($$unsubscribe_feed(), $$unsubscribe_feed = subscribe(feed, $$value => $$invalidate("$feed", $feed = $$value)), feed);

  	validate_store(tick, "tick");
  	component_subscribe($$self, tick, $$value => $$invalidate("$tick", $tick = $$value));
  	validate_store(THEME_BG, "THEME_BG");
  	component_subscribe($$self, THEME_BG, $$value => $$invalidate("$THEME_BG", $THEME_BG = $$value));
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_threads());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_feed());
  	let { channel } = $$props;
  	let { stitch } = $$props;
  	let { weave } = $$props;
  	let { super_open = false } = $$props;
  	let editing = false;

  	const knots = {
  		stream: k => JSON.stringify(k.value.get()),
  		math: k => k.math.get().trim(),
  		mail: k => k.whom.get().trim(),
  		default: k => k.knot.get(),
  		stitch: k => `./${k.name.get()}`
  	};

  	const knots_is = {
  		mail: data => {
  			const ms = data.match(Wheel.REG_ID);
  			if (!ms || ms.length !== 1) return false;
  			if (ms[0] !== data) return false;
  			return true;
  		},
  		stream: data => {
  			try {
  				JSON.parse(data);
  				return true;
  			} catch(ex) {
  				return false;
  			}
  		}
  	};

  	const knots_create = {
  		math: data => ({ knot: `math`, math: data }),
  		mail: data => ({ knot: `mail`, whom: data }),
  		stream: data => ({ knot: `stream`, value: JSON.parse(data) })
  	};

  	const what_is = data => {
  		const entries = Object.entries(knots_is);

  		for (let i = 0; i < entries.length; i++) {
  			const [type, fn] = entries[i];
  			if (fn(data)) return type;
  		}

  		return `math`;
  	};

  	const knot_create = data => knots_create[what_is(data)](data);

  	const translate = k => {
  		if (k[0] === `#`) return k;
  		const knot = weave.knots.get()[k];
  		if (!knot) return `stitch`;
  		const type = knot.knot.get();
  		return knots[type] ? knots[type](knot) : type;
  	};

  	let edit = ``;
  	const focus = node => node.focus();

  	const execute = () => {
  		if (!editing) return;
  		$$invalidate("editing", editing = false);
  		const parts = edit.replace(/[\r\n]/g, ``).split(`=>`).reverse();
  		const threads_update = weave.threads.get();
  		const knots = weave.knots.get();

  		weave.chain(address).forEach(id => {
  			delete knots[id];
  			delete threads_update[id];
  		});

  		weave.knots.set(knots);
  		let connection = address;

  		parts.forEach(part => {
  			part = part.trim();
  			if (part === ``) return;
  			const w_data = knot_create(part);
  			const k = weave.add(w_data);
  			threads_update[k.id.get()] = connection;
  			connection = k.id.get();
  		});

  		weave.threads.set(threads_update);
  		weave.validate();
  		const n = weave.name.get();

  		if (Wheel.running.get()[n]) {
  			Wheel.restart(n);
  		}
  	};

  	const format = txt => {
  		txt = txt.split(`;`);

  		txt = txt.map((i, k) => {
  			i = i.trim();

  			if (k !== txt.length - 1) {
  				i += `;`;
  			}

  			if (k === txt.length - 2) {
  				i += `\r\n`;
  			}

  			return i;
  		}).join(`\r\n`);

  		txt = txt.split(`=>`).join(`\r\n\r\n=>`);
  		return txt;
  	};

  	const condense = link => {
  		const t = translate(link).split(`;`);
  		const v = t.pop().trim();
  		return t.length > 0 ? `#${t.length} ${v}` : v;
  	};

  	const writable_props = ["channel", "stitch", "weave", "super_open"];

  	Object_1.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Thread> was created with unknown prop '${key}'`);
  	});

  	const func = item => $feed[`${weave.name.get()}/${item}`] > time_cut;

  	function textarea_input_handler() {
  		edit = this.value;
  		$$invalidate("edit", edit);
  	}

  	const blur_handler = e => {
  		execute();
  	};

  	const keydown_handler = ({ which, shiftKey }) => {
  		if (which !== 13 || !shiftKey) return;
  		execute();
  	};

  	const click_handler = () => {
  		if (editing) return;
  		$$invalidate("editing", editing = true);
  		$$invalidate("edit", edit = format(boxes));
  	};

  	$$self.$set = $$props => {
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  	};

  	$$self.$capture_state = () => {
  		return {
  			channel,
  			stitch,
  			weave,
  			super_open,
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
  			$THEME_BG,
  			$THEME_BORDER,
  			$feed
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  		if ("editing" in $$props) $$invalidate("editing", editing = $$props.editing);
  		if ("edit" in $$props) $$invalidate("edit", edit = $$props.edit);
  		if ("feed" in $$props) $$subscribe_feed($$invalidate("feed", feed = $$props.feed));
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  		if ("threads" in $$props) $$subscribe_threads($$invalidate("threads", threads = $$props.threads));
  		if ("chain" in $$props) $$invalidate("chain", chain = $$props.chain);
  		if ("$threads" in $$props) threads.set($threads = $$props.$threads);
  		if ("boxes" in $$props) $$invalidate("boxes", boxes = $$props.boxes);
  		if ("time_cut" in $$props) $$invalidate("time_cut", time_cut = $$props.time_cut);
  		if ("$tick" in $$props) tick.set($tick = $$props.$tick);
  		if ("tru_thread" in $$props) $$invalidate("tru_thread", tru_thread = $$props.tru_thread);
  		if ("style" in $$props) $$invalidate("style", style = $$props.style);
  		if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
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

  	$$self.$$.update = (changed = { stitch: 1, channel: 1, weave: 1, $threads: 1, address: 1, chain: 1, $tick: 1, super_open: 1, $THEME_BG: 1, $THEME_BORDER: 1 }) => {
  		if (changed.stitch || changed.channel) {
  			 $$invalidate("address", address = `${stitch.id.get()}/${channel[0]}`);
  		}

  		if (changed.weave) {
  			 $$subscribe_threads($$invalidate("threads", threads = weave.threads));
  		}

  		if (changed.$threads || changed.weave || changed.address) {
  			 $$invalidate("chain", chain = $threads && weave.chain(address).slice(0, -1));
  		}

  		if (changed.chain) {
  			 $$invalidate("boxes", boxes = chain.map(translate).join(` => `));
  		}

  		if (changed.$tick) {
  			 $$invalidate("time_cut", time_cut = $tick && Date.now() - 1000);
  		}

  		if (changed.super_open || changed.chain) {
  			 $$invalidate("tru_thread", tru_thread = !super_open ? chain : [`#${chain.length}`]);
  		}

  		if (changed.$THEME_BG || changed.$THEME_BORDER) {
  			 $$invalidate("style", style = `background-color: ${$THEME_BG}; border:0.25rem solid ${$THEME_BORDER};`);
  		}
  	};

  	 $$subscribe_feed($$invalidate("feed", feed = Wheel.feed));

  	return {
  		channel,
  		stitch,
  		weave,
  		super_open,
  		editing,
  		edit,
  		focus,
  		execute,
  		format,
  		condense,
  		feed,
  		threads,
  		chain,
  		boxes,
  		time_cut,
  		tru_thread,
  		style,
  		$THEME_BG,
  		$THEME_BORDER,
  		$feed,
  		func,
  		textarea_input_handler,
  		blur_handler,
  		keydown_handler,
  		click_handler
  	};
  }

  class Thread extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init$1(this, options, instance$5, create_fragment$5, safe_not_equal, {
  			channel: 0,
  			stitch: 0,
  			weave: 0,
  			super_open: 0
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Thread",
  			options,
  			id: create_fragment$5.name
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

  	get super_open() {
  		throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set super_open(value) {
  		throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/explore/Channel.svelte generated by Svelte v3.14.1 */
  const file$6 = "src/ui/weave/explore/Channel.svelte";

  // (34:0) {#if weave.id.get() !== Wheel.SYSTEM}
  function create_if_block_1$1(ctx) {
  	let current;

  	const thread = new Thread({
  			props: {
  				channel: ctx.channel,
  				stitch: ctx.stitch,
  				weave: ctx.weave,
  				super_open: ctx.super_open
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(thread.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(thread, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const thread_changes = {};
  			if (changed.channel) thread_changes.channel = ctx.channel;
  			if (changed.stitch) thread_changes.stitch = ctx.stitch;
  			if (changed.weave) thread_changes.weave = ctx.weave;
  			if (changed.super_open) thread_changes.super_open = ctx.super_open;
  			thread.$set(thread_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(thread.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(thread.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(thread, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1$1.name,
  		type: "if",
  		source: "(34:0) {#if weave.id.get() !== Wheel.SYSTEM}",
  		ctx
  	});

  	return block;
  }

  // (54:0) {:else}
  function create_else_block$1(ctx) {
  	let input;
  	let focusd_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			input = element("input");
  			attr_dev(input, "class", "edit svelte-w2moq1");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "placeholder", "JSON PLZ");
  			add_location(input, file$6, 54, 2, 924);

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
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(input);
  			if (focusd_action && is_function(focusd_action.destroy)) focusd_action.destroy();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$1.name,
  		type: "else",
  		source: "(54:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (47:0) {#if !editing}
  function create_if_block$2(ctx) {
  	let div0;
  	let t0;
  	let t1;
  	let div1;
  	let t2_value = JSON.stringify(ctx.$value) + "";
  	let t2;

  	const block = {
  		c: function create() {
  			div0 = element("div");
  			t0 = text(ctx.key);
  			t1 = space();
  			div1 = element("div");
  			t2 = text(t2_value);
  			attr_dev(div0, "class", "key svelte-w2moq1");
  			add_location(div0, file$6, 47, 2, 817);
  			attr_dev(div1, "class", "value svelte-w2moq1");
  			add_location(div1, file$6, 50, 2, 856);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div0, anchor);
  			append_dev(div0, t0);
  			insert_dev(target, t1, anchor);
  			insert_dev(target, div1, anchor);
  			append_dev(div1, t2);
  		},
  		p: function update(changed, ctx) {
  			if (changed.key) set_data_dev(t0, ctx.key);
  			if (changed.$value && t2_value !== (t2_value = JSON.stringify(ctx.$value) + "")) set_data_dev(t2, t2_value);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div0);
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(div1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$2.name,
  		type: "if",
  		source: "(47:0) {#if !editing}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$6(ctx) {
  	let show_if = ctx.weave.id.get() !== Wheel.SYSTEM;
  	let t;
  	let div;
  	let color_action;
  	let current;
  	let dispose;
  	let if_block0 = show_if && create_if_block_1$1(ctx);

  	function select_block_type(changed, ctx) {
  		if (!ctx.editing) return create_if_block$2;
  		return create_else_block$1;
  	}

  	let current_block_type = select_block_type(null, ctx);
  	let if_block1 = current_block_type(ctx);

  	const block = {
  		c: function create() {
  			if (if_block0) if_block0.c();
  			t = space();
  			div = element("div");
  			if_block1.c();
  			attr_dev(div, "class", "channel svelte-w2moq1");
  			set_style(div, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			add_location(div, file$6, 37, 0, 630);
  			dispose = listen_dev(div, "click", ctx.click_handler, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if (if_block0) if_block0.m(target, anchor);
  			insert_dev(target, t, anchor);
  			insert_dev(target, div, anchor);
  			if_block1.m(div, null);
  			color_action = color$1.call(null, div, ctx.key) || ({});
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.weave) show_if = ctx.weave.id.get() !== Wheel.SYSTEM;

  			if (show_if) {
  				if (if_block0) {
  					if_block0.p(changed, ctx);
  					transition_in(if_block0, 1);
  				} else {
  					if_block0 = create_if_block_1$1(ctx);
  					if_block0.c();
  					transition_in(if_block0, 1);
  					if_block0.m(t.parentNode, t);
  				}
  			} else if (if_block0) {
  				group_outros();

  				transition_out(if_block0, 1, 1, () => {
  					if_block0 = null;
  				});

  				check_outros();
  			}

  			if (current_block_type === (current_block_type = select_block_type(changed, ctx)) && if_block1) {
  				if_block1.p(changed, ctx);
  			} else {
  				if_block1.d(1);
  				if_block1 = current_block_type(ctx);

  				if (if_block1) {
  					if_block1.c();
  					if_block1.m(div, null);
  				}
  			}

  			if (!current || changed.$THEME_BORDER) {
  				set_style(div, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			}

  			if (is_function(color_action.update) && changed.key) color_action.update.call(null, ctx.key);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block0);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block0);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (if_block0) if_block0.d(detaching);
  			if (detaching) detach_dev(t);
  			if (detaching) detach_dev(div);
  			if_block1.d();
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			dispose();
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

  function instance$6($$self, $$props, $$invalidate) {
  	let $THEME_BORDER;

  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	let { stitch } = $$props;
  	let { weave } = $$props;
  	let { channel } = $$props;
  	let { focus = false } = $$props;

  	let { executed = () => {
  		
  	} } = $$props;

  	let { super_open = false } = $$props;
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

  	const writable_props = ["stitch", "weave", "channel", "focus", "executed", "super_open"];

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
  		if ("focus" in $$props) $$invalidate("focus", focus = $$props.focus);
  		if ("executed" in $$props) $$invalidate("executed", executed = $$props.executed);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  	};

  	$$self.$capture_state = () => {
  		return {
  			stitch,
  			weave,
  			channel,
  			focus,
  			executed,
  			super_open,
  			val,
  			key,
  			value,
  			editing,
  			$THEME_BORDER,
  			$value
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("focus" in $$props) $$invalidate("focus", focus = $$props.focus);
  		if ("executed" in $$props) $$invalidate("executed", executed = $$props.executed);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  		if ("val" in $$props) $$invalidate("val", val = $$props.val);
  		if ("key" in $$props) $$invalidate("key", key = $$props.key);
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("editing" in $$props) $$invalidate("editing", editing = $$props.editing);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
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
  		focus,
  		executed,
  		super_open,
  		val,
  		execute,
  		focusd,
  		key,
  		value,
  		editing,
  		$THEME_BORDER,
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

  		init$1(this, options, instance$6, create_fragment$6, safe_not_equal, {
  			stitch: 0,
  			weave: 0,
  			channel: 0,
  			focus: 0,
  			executed: 0,
  			super_open: 0
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Channel",
  			options,
  			id: create_fragment$6.name
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

  	get super_open() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set super_open(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/explore/Stitch.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$1 } = globals;
  const file$7 = "src/ui/weave/explore/Stitch.svelte";

  function get_each_context$1(ctx, list, i) {
  	const child_ctx = Object_1$1.create(ctx);
  	child_ctx.channel = list[i];
  	return child_ctx;
  }

  // (85:0) {#if open}
  function create_if_block$3(ctx) {
  	let div;
  	let t;
  	let current;
  	let if_block = ctx.$w_name !== Wheel.SYSTEM && create_if_block_2(ctx);
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
  			if (if_block) if_block.c();
  			t = space();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div, "class", "chans svelte-1cl6cnp");
  			add_location(div, file$7, 85, 0, 1562);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			if (if_block) if_block.m(div, null);
  			append_dev(div, t);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (ctx.$w_name !== Wheel.SYSTEM) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block_2(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(div, t);
  				}
  			} else if (if_block) {
  				group_outros();

  				transition_out(if_block, 1, 1, () => {
  					if_block = null;
  				});

  				check_outros();
  			}

  			if (changed.filter || changed.chans || changed.stitch || changed.weave || changed.super_open || changed.executed) {
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
  			if (detaching) detach_dev(div);
  			if (if_block) if_block.d();
  			destroy_each(each_blocks, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$3.name,
  		type: "if",
  		source: "(85:0) {#if open}",
  		ctx
  	});

  	return block;
  }

  // (88:0) {#if $w_name !== Wheel.SYSTEM}
  function create_if_block_2(ctx) {
  	let current;

  	const omni = new Omni({
  			props: {
  				command: ctx.command,
  				focus: ctx.omni_focus
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(omni.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(omni, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const omni_changes = {};
  			if (changed.omni_focus) omni_changes.focus = ctx.omni_focus;
  			omni.$set(omni_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(omni.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(omni.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(omni, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_2.name,
  		type: "if",
  		source: "(88:0) {#if $w_name !== Wheel.SYSTEM}",
  		ctx
  	});

  	return block;
  }

  // (93:2) {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}
  function create_if_block_1$2(ctx) {
  	let current;

  	const channel = new Channel({
  			props: {
  				channel: ctx.channel,
  				stitch: ctx.stitch,
  				weave: ctx.weave,
  				super_open: ctx.super_open,
  				executed: ctx.executed
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
  			if (changed.super_open) channel_changes.super_open = ctx.super_open;
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
  		id: create_if_block_1$2.name,
  		type: "if",
  		source: "(93:2) {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}",
  		ctx
  	});

  	return block;
  }

  // (92:0) {#each chans as channel}
  function create_each_block$1(ctx) {
  	let show_if = ctx.filter.length === 0 || ctx.channel.name.indexOf(ctx.filter[0]) !== -1;
  	let if_block_anchor;
  	let current;
  	let if_block = show_if && create_if_block_1$2(ctx);

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
  					if_block = create_if_block_1$2(ctx);
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
  		source: "(92:0) {#each chans as channel}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$7(ctx) {
  	let div1;
  	let div0;
  	let t0;
  	let t1;
  	let color_action;
  	let t2;
  	let if_block_anchor;
  	let current;
  	let dispose;

  	const postage = new Postage({
  			props: { address: `/${ctx.$w_name}/${ctx.$name}` },
  			$$inline: true
  		});

  	let if_block = ctx.open && create_if_block$3(ctx);

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			div0 = element("div");
  			create_component(postage.$$.fragment);
  			t0 = space();
  			t1 = text(ctx.$name);
  			t2 = space();
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  			attr_dev(div0, "class", "postage svelte-1cl6cnp");
  			add_location(div0, file$7, 78, 2, 1436);
  			attr_dev(div1, "class", "stitch svelte-1cl6cnp");
  			attr_dev(div1, "style", ctx.$THEME_STYLE);
  			toggle_class(div1, "open", ctx.open);
  			add_location(div1, file$7, 65, 0, 1236);

  			dispose = [
  				listen_dev(div0, "click", ctx.toggle, false, false, false),
  				listen_dev(div1, "click", ctx.click_handler, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			append_dev(div1, div0);
  			mount_component(postage, div0, null);
  			append_dev(div1, t0);
  			append_dev(div1, t1);
  			color_action = color$1.call(null, div1, ctx.$name) || ({});
  			insert_dev(target, t2, anchor);
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const postage_changes = {};
  			if (changed.$w_name || changed.$name) postage_changes.address = `/${ctx.$w_name}/${ctx.$name}`;
  			postage.$set(postage_changes);
  			if (!current || changed.$name) set_data_dev(t1, ctx.$name);

  			if (!current || changed.$THEME_STYLE) {
  				attr_dev(div1, "style", ctx.$THEME_STYLE);
  			}

  			if (is_function(color_action.update) && changed.$name) color_action.update.call(null, ctx.$name);

  			if (changed.open) {
  				toggle_class(div1, "open", ctx.open);
  			}

  			if (ctx.open) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block$3(ctx);
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
  			if (detaching) detach_dev(div1);
  			destroy_component(postage);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			if (detaching) detach_dev(t2);
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  			run_all(dispose);
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

  	let $keys;
  	let $THEME_STYLE;

  	let $w_name,
  		$$unsubscribe_w_name = noop,
  		$$subscribe_w_name = () => ($$unsubscribe_w_name(), $$unsubscribe_w_name = subscribe(w_name, $$value => $$invalidate("$w_name", $w_name = $$value)), w_name);

  	validate_store(WEAVE_EXPLORE_OPEN, "WEAVE_EXPLORE_OPEN");
  	component_subscribe($$self, WEAVE_EXPLORE_OPEN, $$value => $$invalidate("$WEAVE_EXPLORE_OPEN", $WEAVE_EXPLORE_OPEN = $$value));
  	validate_store(keys, "keys");
  	component_subscribe($$self, keys, $$value => $$invalidate("$keys", $keys = $$value));
  	validate_store(THEME_STYLE, "THEME_STYLE");
  	component_subscribe($$self, THEME_STYLE, $$value => $$invalidate("$THEME_STYLE", $THEME_STYLE = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_rezed());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_w_name());
  	let { filter = [] } = $$props;
  	let { stitch } = $$props;
  	let { open = $WEAVE_EXPLORE_OPEN } = $$props;
  	let { weave } = $$props;
  	let { super_open = $WEAVE_EXPLORE_OPEN } = $$props;
  	let omni_focus = false;
  	let focus = ``;

  	const executed = () => {
  		$$invalidate("omni_focus", omni_focus = true);
  	};

  	const command = ([action, chan = ``]) => {
  		chan = chan.trim();

  		switch (action) {
  			case `+`:
  				value.add({ [chan]: `` });
  				focus = chan;
  				return;
  			case `-`:
  				value.remove(chan);
  				weave.chain(`${stitch.id.get()}/${chan}`).forEach(id => {
  					weave.remove(id);
  				});
  		}
  	};

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

  	const writable_props = ["filter", "stitch", "open", "weave", "super_open"];

  	Object_1$1.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Stitch> was created with unknown prop '${key}'`);
  	});

  	const click_handler = () => {
  		if ($keys.shift) {
  			$$invalidate("super_open", super_open = !super_open);
  			return;
  		}

  		$$invalidate("open", open = !open);
  	};

  	$$self.$set = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  	};

  	$$self.$capture_state = () => {
  		return {
  			filter,
  			stitch,
  			open,
  			weave,
  			super_open,
  			omni_focus,
  			focus,
  			$WEAVE_EXPLORE_OPEN,
  			w_name,
  			name,
  			rezed,
  			value,
  			chans,
  			$value,
  			$rezed,
  			$name,
  			$keys,
  			$THEME_STYLE,
  			$w_name
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  		if ("omni_focus" in $$props) $$invalidate("omni_focus", omni_focus = $$props.omni_focus);
  		if ("focus" in $$props) focus = $$props.focus;
  		if ("$WEAVE_EXPLORE_OPEN" in $$props) WEAVE_EXPLORE_OPEN.set($WEAVE_EXPLORE_OPEN = $$props.$WEAVE_EXPLORE_OPEN);
  		if ("w_name" in $$props) $$subscribe_w_name($$invalidate("w_name", w_name = $$props.w_name));
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("rezed" in $$props) $$subscribe_rezed($$invalidate("rezed", rezed = $$props.rezed));
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("chans" in $$props) $$invalidate("chans", chans = $$props.chans);
  		if ("$value" in $$props) value.set($value = $$props.$value);
  		if ("$rezed" in $$props) rezed.set($rezed = $$props.$rezed);
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$keys" in $$props) keys.set($keys = $$props.$keys);
  		if ("$THEME_STYLE" in $$props) THEME_STYLE.set($THEME_STYLE = $$props.$THEME_STYLE);
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
  		super_open,
  		omni_focus,
  		executed,
  		command,
  		toggle,
  		w_name,
  		name,
  		rezed,
  		value,
  		chans,
  		$name,
  		$keys,
  		$THEME_STYLE,
  		$w_name,
  		click_handler
  	};
  }

  class Stitch extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init$1(this, options, instance$7, create_fragment$7, safe_not_equal, {
  			filter: 0,
  			stitch: 0,
  			open: 0,
  			weave: 0,
  			super_open: 0
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Stitch",
  			options,
  			id: create_fragment$7.name
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

  	get super_open() {
  		throw new Error("<Stitch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set super_open(value) {
  		throw new Error("<Stitch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/Controls.svelte generated by Svelte v3.14.1 */
  const file$8 = "src/ui/weave/Controls.svelte";

  // (1:0) <script> import { save, image }
  function create_catch_block$1(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_catch_block$1.name,
  		type: "catch",
  		source: "(1:0) <script> import { save, image }",
  		ctx
  	});

  	return block;
  }

  // (48:34)        <img {src}
  function create_then_block$1(ctx) {
  	let img;
  	let img_src_value;

  	const block = {
  		c: function create() {
  			img = element("img");
  			if (img.src !== (img_src_value = ctx.src)) attr_dev(img, "src", img_src_value);
  			attr_dev(img, "alt", "save");
  			attr_dev(img, "class", "svelte-1pgeteq");
  			add_location(img, file$8, 48, 6, 872);
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
  		id: create_then_block$1.name,
  		type: "then",
  		source: "(48:34)        <img {src}",
  		ctx
  	});

  	return block;
  }

  // (1:0) <script> import { save, image }
  function create_pending_block$1(ctx) {
  	const block = { c: noop, m: noop, p: noop, d: noop };

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_pending_block$1.name,
  		type: "pending",
  		source: "(1:0) <script> import { save, image }",
  		ctx
  	});

  	return block;
  }

  function create_fragment$8(ctx) {
  	let div2;
  	let div0;
  	let t;
  	let div1;
  	let promise;
  	let current;
  	let dispose;

  	const postage = new Postage({
  			props: { address: `/${ctx.$name}` },
  			$$inline: true
  		});

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

  	handle_promise(promise = image(ctx.weave), info);

  	const block = {
  		c: function create() {
  			div2 = element("div");
  			div0 = element("div");
  			create_component(postage.$$.fragment);
  			t = space();
  			div1 = element("div");
  			info.block.c();
  			attr_dev(div0, "class", "postage svelte-1pgeteq");
  			add_location(div0, file$8, 36, 1, 628);
  			attr_dev(div1, "class", "save svelte-1pgeteq");
  			set_style(div1, "border", "0.5rem solid " + ctx.$THEME_BORDER);
  			add_location(div1, file$8, 42, 2, 730);
  			attr_dev(div2, "class", "controls svelte-1pgeteq");
  			add_location(div2, file$8, 33, 0, 600);

  			dispose = [
  				listen_dev(div0, "click", ctx.toggle, false, false, false),
  				listen_dev(div1, "click", ctx.save_it, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div2, anchor);
  			append_dev(div2, div0);
  			mount_component(postage, div0, null);
  			append_dev(div2, t);
  			append_dev(div2, div1);
  			info.block.m(div1, info.anchor = null);
  			info.mount = () => div1;
  			info.anchor = null;
  			current = true;
  		},
  		p: function update(changed, new_ctx) {
  			ctx = new_ctx;
  			const postage_changes = {};
  			if (changed.$name) postage_changes.address = `/${ctx.$name}`;
  			postage.$set(postage_changes);
  			info.ctx = ctx;

  			if (changed.weave && promise !== (promise = image(ctx.weave)) && handle_promise(promise, info)) ; else {
  				info.block.p(changed, assign(assign({}, ctx), info.resolved)); // nothing
  			}

  			if (!current || changed.$THEME_BORDER) {
  				set_style(div1, "border", "0.5rem solid " + ctx.$THEME_BORDER);
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
  			if (detaching) detach_dev(div2);
  			destroy_component(postage);
  			info.block.d();
  			info.token = null;
  			info = null;
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
  		$name,
  		$THEME_BORDER
  	};
  }

  class Controls extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$8, create_fragment$8, safe_not_equal, { weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Controls",
  			options,
  			id: create_fragment$8.name
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

  /* src/ui/weave/explore/Weave.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$2 } = globals;
  const file$9 = "src/ui/weave/explore/Weave.svelte";

  function get_each_context$2(ctx, list, i) {
  	const child_ctx = Object_1$2.create(ctx);
  	child_ctx.s_name = list[i][0];
  	child_ctx.stitch = list[i][1];
  	return child_ctx;
  }

  // (82:0) {#if open}
  function create_if_block$4(ctx) {
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
  			add_location(div, file$9, 82, 2, 1520);
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

  			if (changed.filter || changed.stitches || changed.super_open || changed.super_duper_open || changed.weave) {
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
  		id: create_if_block$4.name,
  		type: "if",
  		source: "(82:0) {#if open}",
  		ctx
  	});

  	return block;
  }

  // (88:6) {#if          filter.length === 0 ||         s_name.indexOf(filter[0]) !== -1       }
  function create_if_block_1$3(ctx) {
  	let current;

  	const stitch = new Stitch({
  			props: {
  				stitch: ctx.stitch,
  				filter: ctx.filter.slice(1),
  				open: ctx.super_open,
  				super_open: ctx.super_duper_open,
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
  			if (changed.super_open) stitch_changes.open = ctx.super_open;
  			if (changed.super_duper_open) stitch_changes.super_open = ctx.super_duper_open;
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
  		id: create_if_block_1$3.name,
  		type: "if",
  		source: "(88:6) {#if          filter.length === 0 ||         s_name.indexOf(filter[0]) !== -1       }",
  		ctx
  	});

  	return block;
  }

  // (87:4) {#each stitches as [s_name,stitch]}
  function create_each_block$2(ctx) {
  	let show_if = ctx.filter.length === 0 || ctx.s_name.indexOf(ctx.filter[0]) !== -1;
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
  			if (changed.filter || changed.stitches) show_if = ctx.filter.length === 0 || ctx.s_name.indexOf(ctx.filter[0]) !== -1;

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
  		id: create_each_block$2.name,
  		type: "each",
  		source: "(87:4) {#each stitches as [s_name,stitch]}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$9(ctx) {
  	let div;
  	let t0;
  	let t1;
  	let color_action;
  	let t2;
  	let if_block_anchor;
  	let current;
  	let dispose;

  	const controls = new Controls({
  			props: { weave: ctx.weave },
  			$$inline: true
  		});

  	let if_block = ctx.open && create_if_block$4(ctx);

  	const block = {
  		c: function create() {
  			div = element("div");
  			create_component(controls.$$.fragment);
  			t0 = space();
  			t1 = text(ctx.$name);
  			t2 = space();
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  			attr_dev(div, "class", "weave svelte-296y2q");
  			set_style(div, "background-color", ctx.$THEME_BG);
  			set_style(div, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			toggle_class(div, "open", ctx.open);
  			add_location(div, file$9, 53, 0, 992);
  			dispose = listen_dev(div, "click", ctx.click_handler, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			mount_component(controls, div, null);
  			append_dev(div, t0);
  			append_dev(div, t1);
  			color_action = color$1.call(null, div, ctx.$name) || ({});
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

  			if (!current || changed.$THEME_BG) {
  				set_style(div, "background-color", ctx.$THEME_BG);
  			}

  			if (!current || changed.$THEME_BORDER) {
  				set_style(div, "border", "0.25rem solid " + ctx.$THEME_BORDER);
  			}

  			if (is_function(color_action.update) && changed.$name) color_action.update.call(null, ctx.$name);

  			if (changed.open) {
  				toggle_class(div, "open", ctx.open);
  			}

  			if (ctx.open) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  					transition_in(if_block, 1);
  				} else {
  					if_block = create_if_block$4(ctx);
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
  			if (detaching) detach_dev(div);
  			destroy_component(controls);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			if (detaching) detach_dev(t2);
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
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
  	let $WEAVE_EXPLORE_OPEN;

  	let $names,
  		$$unsubscribe_names = noop,
  		$$subscribe_names = () => ($$unsubscribe_names(), $$unsubscribe_names = subscribe(names, $$value => $$invalidate("$names", $names = $$value)), names);

  	let $name,
  		$$unsubscribe_name = noop,
  		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

  	let $THEME_BG;
  	let $THEME_BORDER;
  	let $keys;
  	validate_store(WEAVE_EXPLORE_OPEN, "WEAVE_EXPLORE_OPEN");
  	component_subscribe($$self, WEAVE_EXPLORE_OPEN, $$value => $$invalidate("$WEAVE_EXPLORE_OPEN", $WEAVE_EXPLORE_OPEN = $$value));
  	validate_store(THEME_BG, "THEME_BG");
  	component_subscribe($$self, THEME_BG, $$value => $$invalidate("$THEME_BG", $THEME_BG = $$value));
  	validate_store(THEME_BORDER, "THEME_BORDER");
  	component_subscribe($$self, THEME_BORDER, $$value => $$invalidate("$THEME_BORDER", $THEME_BORDER = $$value));
  	validate_store(keys, "keys");
  	component_subscribe($$self, keys, $$value => $$invalidate("$keys", $keys = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_names());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	let { weave } = $$props;
  	let { filter = [] } = $$props;
  	let { open = $WEAVE_EXPLORE_OPEN } = $$props;
  	$$invalidate("open", open = open && weave.name.get() !== Wheel.SYSTEM);
  	let super_open = open;
  	let super_duper_open = false;

  	const command = ([command, detail, detail2]) => {
  		switch (command) {
  			case `~`:
  				const k = $names[detail];
  				if (!k) return;
  				k.name.set(detail2);
  				break;
  			case `+`:
  				weave.add({ knot: `stitch`, name: detail });
  				break;
  			case `-`:
  				weave.remove_name(detail);
  		}
  	};

  	const writable_props = ["weave", "filter", "open"];

  	Object_1$2.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Weave> was created with unknown prop '${key}'`);
  	});

  	const click_handler = () => {
  		if ($keys.shift) {
  			$$invalidate("open", open = true);

  			if (super_open === false) {
  				$$invalidate("super_open", super_open = true);
  				return;
  			}

  			if (super_duper_open === false) {
  				$$invalidate("super_duper_open", super_duper_open = true);
  				return;
  			}

  			$$invalidate("super_open", super_open = false);
  			$$invalidate("super_duper_open", super_duper_open = false);
  			return;
  		}

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
  			super_open,
  			super_duper_open,
  			name,
  			names,
  			$WEAVE_EXPLORE_OPEN,
  			stitches,
  			$names,
  			knots,
  			$name,
  			$THEME_BG,
  			$THEME_BORDER,
  			$keys
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  		if ("super_duper_open" in $$props) $$invalidate("super_duper_open", super_duper_open = $$props.super_duper_open);
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("names" in $$props) $$subscribe_names($$invalidate("names", names = $$props.names));
  		if ("$WEAVE_EXPLORE_OPEN" in $$props) WEAVE_EXPLORE_OPEN.set($WEAVE_EXPLORE_OPEN = $$props.$WEAVE_EXPLORE_OPEN);
  		if ("stitches" in $$props) $$invalidate("stitches", stitches = $$props.stitches);
  		if ("$names" in $$props) names.set($names = $$props.$names);
  		if ("knots" in $$props) knots = $$props.knots;
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
  		if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
  		if ("$keys" in $$props) keys.set($keys = $$props.$keys);
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
  		super_open,
  		super_duper_open,
  		command,
  		name,
  		names,
  		stitches,
  		$name,
  		$THEME_BG,
  		$THEME_BORDER,
  		$keys,
  		click_handler
  	};
  }

  class Weave$1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$9, create_fragment$9, safe_not_equal, { weave: 0, filter: 0, open: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Weave",
  			options,
  			id: create_fragment$9.name
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

  const { Object: Object_1$3 } = globals;
  const file$a = "src/ui/weave/Explore.svelte";

  function get_each_context$3(ctx, list, i) {
  	const child_ctx = Object_1$3.create(ctx);
  	child_ctx.weave = list[i];
  	return child_ctx;
  }

  // (64:4) {#if        filter === `` ||       weave.name.get().indexOf(parts[0]) !== -1     }
  function create_if_block$5(ctx) {
  	let current;

  	const weave = new Weave$1({
  			props: {
  				weave: ctx.weave,
  				filter: ctx.parts.slice(1)
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
  		id: create_if_block$5.name,
  		type: "if",
  		source: "(64:4) {#if        filter === `` ||       weave.name.get().indexOf(parts[0]) !== -1     }",
  		ctx
  	});

  	return block;
  }

  // (63:2) {#each ws as weave}
  function create_each_block$3(ctx) {
  	let show_if = ctx.filter === `` || ctx.weave.name.get().indexOf(ctx.parts[0]) !== -1;
  	let if_block_anchor;
  	let current;
  	let if_block = show_if && create_if_block$5(ctx);

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
  		id: create_each_block$3.name,
  		type: "each",
  		source: "(63:2) {#each ws as weave}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$a(ctx) {
  	let t0;
  	let t1;
  	let div2;
  	let div0;
  	let t2;
  	let t3;
  	let input;
  	let t4;
  	let div1;
  	let current;
  	let dispose;
  	const mainscreen = new MainScreen({ $$inline: true });
  	const picker = new Picker({ $$inline: true });
  	let each_value = ctx.ws;
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
  			div2 = element("div");
  			div0 = element("div");
  			t2 = text("[ I S E K A I ]");
  			t3 = space();
  			input = element("input");
  			t4 = space();
  			div1 = element("div");

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div0, "class", "logo svelte-otl23e");
  			attr_dev(div0, "style", ctx.$THEME_STYLE);
  			add_location(div0, file$a, 48, 2, 810);
  			attr_dev(input, "type", "text");
  			attr_dev(input, "class", "filter svelte-otl23e");
  			attr_dev(input, "placeholder", "!/~/+/-");
  			add_location(input, file$a, 53, 2, 886);
  			attr_dev(div1, "class", "weaves svelte-otl23e");
  			add_location(div1, file$a, 61, 2, 1046);
  			attr_dev(div2, "class", "explore svelte-otl23e");
  			toggle_class(div2, "hidden", ctx.hidden);
  			add_location(div2, file$a, 44, 0, 767);

  			dispose = [
  				listen_dev(input, "input", ctx.input_input_handler),
  				listen_dev(input, "keydown", ctx.keydown_handler, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			mount_component(mainscreen, target, anchor);
  			insert_dev(target, t0, anchor);
  			mount_component(picker, target, anchor);
  			insert_dev(target, t1, anchor);
  			insert_dev(target, div2, anchor);
  			append_dev(div2, div0);
  			append_dev(div0, t2);
  			append_dev(div2, t3);
  			append_dev(div2, input);
  			set_input_value(input, ctx.filter);
  			append_dev(div2, t4);
  			append_dev(div2, div1);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div1, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (!current || changed.$THEME_STYLE) {
  				attr_dev(div0, "style", ctx.$THEME_STYLE);
  			}

  			if (changed.filter && input.value !== ctx.filter) {
  				set_input_value(input, ctx.filter);
  			}

  			if (changed.filter || changed.ws || changed.parts) {
  				each_value = ctx.ws;
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
  						each_blocks[i].m(div1, null);
  					}
  				}

  				group_outros();

  				for (i = each_value.length; i < each_blocks.length; i += 1) {
  					out(i);
  				}

  				check_outros();
  			}

  			if (changed.hidden) {
  				toggle_class(div2, "hidden", ctx.hidden);
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
  			if (detaching) detach_dev(div2);
  			destroy_each(each_blocks, detaching);
  			run_all(dispose);
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
  	let $weaves,
  		$$unsubscribe_weaves = noop,
  		$$subscribe_weaves = () => ($$unsubscribe_weaves(), $$unsubscribe_weaves = subscribe(weaves, $$value => $$invalidate("$weaves", $weaves = $$value)), weaves);

  	let $THEME_STYLE;
  	validate_store(THEME_STYLE, "THEME_STYLE");
  	component_subscribe($$self, THEME_STYLE, $$value => $$invalidate("$THEME_STYLE", $THEME_STYLE = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_weaves());

  	down.listen(key => {
  		if (key !== `\``) return;
  		$$invalidate("hidden", hidden = !hidden);
  	});

  	let filter = ``;
  	let { hidden = false } = $$props;

  	const do_add = () => {
  		switch (filter[0]) {
  			case `-`:
  				Wheel.del({ [filter.slice(1)]: true });
  				$$invalidate("filter", filter = ``);
  				return;
  			case `+`:
  				Wheel.spawn({ [filter.slice(1)]: {} });
  				$$invalidate("filter", filter = ``);
  		}
  	};

  	const writable_props = ["hidden"];

  	Object_1$3.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Explore> was created with unknown prop '${key}'`);
  	});

  	function input_input_handler() {
  		filter = this.value;
  		$$invalidate("filter", filter);
  	}

  	const keydown_handler = ({ which }) => which === 13 && do_add();

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
  		do_add,
  		weaves,
  		ws,
  		parts,
  		$THEME_STYLE,
  		input_input_handler,
  		keydown_handler
  	};
  }

  class Explore extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$a, create_fragment$a, safe_not_equal, { hidden: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Explore",
  			options,
  			id: create_fragment$a.name
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

  function create_fragment$b(ctx) {
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
  		id: create_fragment$b.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  class App extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, null, create_fragment$b, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "App",
  			options,
  			id: create_fragment$b.name
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

}(Color, cuid, exprEval, twgl));
//# sourceMappingURL=bundle.js.map
