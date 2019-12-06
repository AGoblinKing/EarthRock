var app = (function (uuid, expr, twgl, Tone, Color) {
  'use strict';

  uuid = uuid && uuid.hasOwnProperty('default') ? uuid['default'] : uuid;
  expr = expr && expr.hasOwnProperty('default') ? expr['default'] : expr;
  Tone = Tone && Tone.hasOwnProperty('default') ? Tone['default'] : Tone;
  Color = Color && Color.hasOwnProperty('default') ? Color['default'] : Color;

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

  const WEAVE_EXPLORE_OPEN = write(false);

  const INPUT_SCROLL_STRENGTH = write(20);
  const INPUT_ZOOM_STRENGTH = write(0.01);
  const INPUT_ZOOM_MIN = write(0.1);

  const TILE_COUNT = read(1024);
  const TILE_COLUMNS = read(32);

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
    TILE_COLUMNS: TILE_COLUMNS
  });

  const str_color = (str) => {
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

  var stream = () => {
    const value = write();
    const set = value.set;

    value.set = (val) => {
      try {
        set(JSON.parse(val));
      } catch (ex) {
        set(val);
      }
    };

    value.set(`null`);

    return ({
      knot: read(`stream`),
      value
    })
  };

  const parser = new expr.Parser();

  const math = (formula, variables) => {
    return parser.parse(formula).evaluate(variables)
  };

  const math_run = (expression, arg) => {
    try {
      return math(expression, arg)
    } catch (ex) {
      return null
    }
  };

  var math$1 = ({
    math = `2+2`,
    value
  } = false) => {
    const m = ({
      knot: read(`math`),
      math: write(math),
      value: write(value)
    });

    const set = m.value.set;
    let val_in = value;

    set(math_run(math, val_in));

    m.value.set = (val) => {
      val_in = typeof val === `object` && !Array.isArray(val)
        ? val
        : { v: val };

      set(math_run(m.math.get(), val_in));
    };

    m.math.subscribe((expression) =>
      set(math_run(expression, val_in))
    );

    return m
  };

  // instead use the weave messaging channel
  var mail = ({
    whom = `/sys/mouse/position`,
    weave,
    id
  }) => {
    const value = write();
    const { set } = value;

    // when set hit up the remote
    value.set = (value_new) => {
      const $whom = m.whom.get().replace(`~`, `/${weave.id.get()}`);
      const v = Wheel.get($whom);

      if (!v || !v.set) {
        console.warn(`tried to mail a readable or unknown`, m.whom.get());
        return
      }

      v.set(value_new);
    };

    // Subscribe to remote
    const m = ({
      knot: read(`mail`),
      whom: transformer((whom_new) => {
        weave.mails.update(($mails) => ({
          ...$mails,
          [id]: whom_new.replace(`~`, `/${weave.id.get()}`)
        }));

        return whom_new
      }).set(whom),
      value,
      set
    });

    return m
  };

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

  var sprite_frag = "precision highp float;uniform sampler2D map;varying vec2 vUv;varying vec3 vTint;varying float vOpacity;vec4 LinearToLinear(in vec4 value){return value;}void main(){gl_FragColor=LinearToLinear(texture2D(map,vUv))*vec4(vTint,vOpacity);if(gl_FragColor.a<0.5)discard;}";

  var sprite_vert = "precision highp float;uniform mat4 model_view_matrix;uniform mat4 projectionMatrix;uniform float time;attribute float scale;attribute vec3 position;attribute float sprite;attribute float opacity;attribute float color;attribute vec2 slice;varying float vOpacity;varying vec3 vTint;varying vec2 vUv;void main(){vTint=tint;vOpacity=opacity;vUv=uv*cellsize+slice*cellsize;vec2 huv=vec2((translate.x+100.0)/200.0,(-translate.y+100.0)/200.0);float alpha=texture2D(heightmap,huv).a;vec4 offset=vec4(translate.x-0.5,alpha*255.0*0.2+0.5,translate.y-0.5,1.0);vec4 mvPosition=model_view_matrix*offset;mvPosition.xyz+=position.xyz*scale;gl_Position=projectionMatrix*mvPosition;}";

  const breaker = (a) => a.map(i => `\r\n${i}`);

  const test = read(breaker([
    test_vert,
    test_frag
  ]));

  const sprite = read(breaker([
    sprite_vert,
    sprite_frag
  ]));

  const VALUE = () => ({
    square: read({
      position: read([
        -1, -1, 0,
        1, -1, 0,
        -1, 1, 0,
        -1, 1, 0,
        1, -1, 0,
        1, 1, 0
      ])
    })
  });

  var screen = ({
    value = VALUE(),
    id,
    life,
    weave
  }) => {
    const canvas = document.createElement(`canvas`);
    canvas.width = 100;
    canvas.height = 100;
    const gl = canvas.getContext(`webgl`);

    let buffer_data = {};

    const buffer_defaults = {
      position: read([0, 0, 0])
    };

    const gpu = ({
      knot: read(`screen`),
      value: transformer((data) => {
        buffer_data = data;
        return canvas
      }).set(value),

      toJSON: () => ({
        id,
        knot: gpu.knot.get()
      })
    });

    const program_info = twgl.createProgramInfo(
      gl,
      sprite.get()
    );

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const snapshot = () => {
      const $value = buffer_data;
      const buffer = {
        position: []
      };
      const uniforms = {};

      Object.entries($value).forEach(([
        key,
        chan
      ]) => {
        const $chan = chan.get();

        // tell us about the objects
        if (
          typeof $chan !== `object` ||
          Array.isArray($chan) ||
          $chan === null ||
          $chan === undefined
        ) {
          uniforms[key] = $chan;
          return
        }

        // okay they're an object lets add buffer data for them
        Object.keys(buffer).forEach((key_buffer) => {
          const chan_buffer = $chan[key_buffer];

          // doesn't have the channel
          if (!chan_buffer || !chan_buffer.get) {
            buffer[key_buffer].push(
              ...buffer_defaults[key_buffer].get()
            );
            return
          }

          buffer[key_buffer].push(...chan_buffer.get());
        });
      });

      return {
        buffer,
        uniforms
      }
    };

    // lifecycle on knot
    life(() => frame.subscribe(([, t]) => {
      if (program_info === null) return
      const { buffer } = snapshot();

      const u = {
        time: t * 0.001,
        resolution: [
          gl.canvas.width,
          gl.canvas.height
        ]
      };

      try {
        const buffer_info = twgl.createBufferInfoFromArrays(
          gl,
          buffer
        );

        gl.useProgram(program_info.program);
        twgl.setBuffersAndAttributes(gl, program_info, buffer_info);
        twgl.setUniforms(program_info, u);
        twgl.drawBufferInfo(gl, buffer_info);
      } catch (ex) {
        console.warn(`GPU ERROR ${ex}`);
      }
    }));

    return gpu
  };



  var knots = /*#__PURE__*/Object.freeze({
    __proto__: null,
    stitch: stitch,
    stream: stream,
    math: math$1,
    mail: mail,
    screen: screen
  });

  // the basic knot
  var Knot_Factory = ({
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
    threads = {}
  } = false) => {
    let threads_set;

    const w = {
      id: read(id),
      knot: read(`weave`),

      name: write(name),

      threads: read(threads, set => {
        threads_set = set;
      }),

      lives: write([]),
      mails: write({}),
      take_thread: write(),
      give_thread: write(),
      give_knot: transformer((knot) => {
        const k = Knot_Factory(knot);

        w.knots.update((knots) => ({
          ...knots,
          [k.id]: k
        }));

        return k
      }),
      toJSON: () => {
        const {
          id,
          knot,
          name,
          threads,
          knots
        } = w;

        return JSON.parse(JSON.stringify({
          id,
          knot,
          name,
          threads,
          knots
        }))
      }
    };

    const life_set = w.lives.set;

    w.lives.set = undefined;
    const life_add = (life) => life_set([
      ...w.lives.get(),
      life
    ]);

    w.add = (properties) => {
      const k = Knot_Factory({
        ...properties,
        weave: w,
        life: life_add
      });

      w.knots.update(($knots) => ({
        ...$knots,
        [k.id.get()]: k
      }));

      return k
    };

    w.knots = write(Object
      .entries(knots)
      .reduce((res, [knot_id, val]) => {
        if (val.id !== knot_id) {
          val.id = knot_id;
        }

        res[knot_id] = Knot_Factory({
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

    w.take_thread.subscribe((id) => {
      if (!id) return
      const $threads = w.threads.get();

      if (!$threads[id]) return
      delete $threads[id];

      threads_set($threads);
    });

    w.give_thread.subscribe((match) => {
      if (!match) return

      const [[
        x_id,
        x_dir
      ], [
        y_id,
        y_dir
      ]] = match.map((address) => address.split(`|`));

      if (x_dir === y_dir) {
        console.warn(`Tried to match same direction`);
        return
      }

      const target = [x_id, y_id];
      x_dir === `write` && target.reverse();

      const threads = w.threads.get();

      threads[target[0]] = target[1];
      threads_set(threads);
    });

    return w
  };

  const SYSTEM = `sys`;

  let feed_set;
  const feed = read({
    reader: ``
  }, (set) => {
    feed_set = set;
  });

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
      const weave = get(weave_id);

      if (weave === undefined) {
        const ws = weaves.get();
        const w = Weave({
          ...weave_data,
          name: weave_id
        });

        ws[weave_id] = w;

        weaves.set(ws);
        return [weave_id, w]
      }

      return [weave_id, weave]
    })
  );

  const start = (weave_name) => {
    if (weave_name === SYSTEM) {
      throw new Error(`CaN NoT StArT or StOp /${SYSTEM}`)
    }
    const w = get(weave_name);
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
          const w = by_id(writer);

          return r.subscribe(($val) => {
            w.set($val);

            // costly debug thingy,
            // TODO: better way?
            feed_set({
              reader: `${weave_name}/${reader}`,
              writer: `${weave_name}/${writer}`,
              value: $val
            });
          })
        }),
      // frames
      ...w.lives.get().map((cb) => cb()),

      // ramp to/from the bifrost
      ...Object.entries(w.mails.get())
        .map(
          ([
            mail_id,
            address
          ]) => get(address).subscribe((value_new) => {
            knots[mail_id].set(value_new);
            feed_set({
              reader: address,
              writer: `${weave_name}/${mail_id}`,
              value: value_new
            });
          })
        )
    ]);

    running_set({
      ...running.get(),
      [weave_name]: true
    });
  };

  const stop = (weave_name) => {
    if (weave_name === SYSTEM) {
      throw new Error(`CaN NoT StArT or StOp /${SYSTEM}`)
    }

    const h = highways.get(weave_name);

    const r = running.get();
    delete r[weave_name];

    running_set(r);

    if (h === undefined) {
      throw new Error(`can't stop ${weave_name}`)
    }

    h.forEach((cancel) => cancel());

    highways.delete(weave_name);
  };

  const bump = (what) => JSON.parse(JSON.stringify(what));
  const toJSON = () => ({
    weaves: bump(weaves),
    running: bump(running)
  });

  var Wheel$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    SYSTEM: SYSTEM,
    feed: feed,
    weaves: weaves,
    running: running,
    trash: trash,
    del: del,
    get: get,
    exists: exists,
    spawn: spawn,
    start: start,
    stop: stop,
    toJSON: toJSON
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
      try {
        e.preventDefault();
      } catch (ex) {
        // shh
      }
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
  const main = write((() => {
    const canvas = document.createElement(`canvas`);
    canvas.width = canvas.height = 100;
    return canvas
  })());

  var screen$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    size: size,
    scale: scale,
    main: main
  });

  const up = read(``, (set) =>
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

    up.listen((char) => {
      delete value[char];
      set(value);
    });
  });

  var key = /*#__PURE__*/Object.freeze({
    __proto__: null,
    up: up,
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

  // raw translate commands
  const translate = read([0, 0, 0], (set) => {
    const b_key = [0, 0, 0];
    // frame stuff has to be fast :/
    frame.listen(() => {
      const { w, a, s, d } = keys.get();

      b_key[0] = 0;
      b_key[1] = 0;

      if (w) b_key[1] -= 1;
      if (s) b_key[1] += 1;
      if (a) b_key[0] -= 1;
      if (d) b_key[0] += 1;

      if (length(b_key) === 0) return

      set(b_key);
    });

    // Mouse.scroll.listen((value_new) => {
    //   buffer = add(buffer, value_new)
    // })
  });

  let scroll_velocity = [0, 0, 0];

  const scroll$1 = write([0, 0, 0]);

  tick.listen(() => {
    if (Math.abs(length(scroll_velocity)) < 1) return

    scroll$1.set(add(
      scroll$1.get(),
      scroll_velocity
    ).map((n) => Math.round(n)));

    scroll_velocity = multiply_scalar(
      scroll_velocity,
      0.5
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

  const zoom = write(0.75);

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

  var input = /*#__PURE__*/Object.freeze({
    __proto__: null,
    translate: translate,
    scroll: scroll$1,
    zoom: zoom
  });

  const VERSION = 2;

  let db;

  let load_res;
  const loaded = new Promise((resolve) => { load_res = resolve; });
  const data = new Promise((resolve) => {
    const req = window.indexedDB.open(`isekai`, VERSION);

    req.onupgradeneeded = async (e) => {
      db = e.target.result;

      db.createObjectStore(`weave`, { keyPath: `id` });
      db.createObjectStore(`running`, { keyPath: `id` });

      resolve(db);
    };

    req.onsuccess = (e) => {
      db = e.target.result;

      resolve(db);
    };
  });

  const query = ({
    store = `weave`,
    action = `getAll`,
    args = [],
    foronly = `readwrite`
  } = false) => new Promise((resolve, reject) => {
    data.then(() => {
      const t = db.transaction([store], foronly);
      t.onerror = reject;
      t.objectStore(store)[action](...args).onsuccess = (e) => resolve(e.target.result);
    });
  });

  const save = async () => {
    const {
      running, weaves
    } = Wheel.toJSON();

    await Promise.all([
      query({
        action: `clear`
      }),
      query({
        store: `running`,
        action: `clear`
      })
    ]);

    await Promise.all([
      ...Object.values(weaves).map((data) => query({
        action: `put`,
        args: [data]
      })),
      ...Object.keys(running).map((id) => query({
        store: `running`,
        action: `put`,
        args: [{
          id
        }]
      }))
    ]);
  };

  tick.listen((t) => {
    if (
      t % 10 !== 0 ||
      db === undefined ||
      !loaded
    ) return

    save();
  });

  window.query = query;

  const init = async () => {
    const [
      weaves,
      running
    ] = await Promise.all([
      await query(),
      await query({
        store: `running`
      })
    ]);

    Wheel.spawn(Object.fromEntries(
      weaves
        .filter((w) => w.name !== Wheel.SYSTEM)
        .map((w) => [
          w.name,
          w
        ])
    ));

    running.forEach((r) => {
      if (r.id === Wheel.SYSTEM) return

      Wheel.start(r.id);
    });

    load_res(true);
  };

  init();

  const path = transformer((path_new) => {
    const path_split = path_new.split(`/`);
    if (window.location.pathname === path_new) {
      return path_split
    }

    window.history.pushState({ page: 1 }, ``, `/${path_new}`);

    return path_split
  }).set(decodeURI(window.location.pathname.slice(1)));

  // Which weave is being woven
  const woven = transformer((weave_id) => {
    const w = Wheel.get(weave_id);
    if (!w) return woven.get()

    return w
  }).set(`sys`);

  Wheel.trash.listen((trashee) => {
    if (!trashee) return

    if (woven.get().name.get() === trashee.name.get()) {
      woven.set(`sys`);
    }
  });

  path.listen(async ($path) => {
    if (
      $path[0] !== `weave` ||
      $path.length === 1
    ) return

    await loaded;
    if (!Wheel.get($path[1])) {
      path.set(`weave`);
      return
    }

    woven.set($path[1]);
  });

  const hoveree = write(``);
  const draggee = write(``);
  const drag_count = write(0);
  draggee.listen(() => drag_count.update($d => $d + 1));

  // 50rem between points
  const FORCE_PULL = 2;
  const FORCE_DECAY = 5;
  const MIN_MOVE = 40;
  const FORCE_STRONG = 1.25;

  const bodies = write({});
  // keeps all the postions for woven
  const positions = write({});
  let velocities = {};

  // reset positions
  woven.listen(() => {
    positions.set({});
    velocities = {};
    drag_count.set(0);
  });

  const vel = (id) => velocities[id] || [0, 0, 0];

  tick.listen((t) => {
    const { threads, knots } = woven.get();
    const $knots = knots.get();
    const $threads = threads.get();
    const $positions = positions.get();
    const $bodies = bodies.get();

    const $hoveree = hoveree.get();

    let dirty = false;
    const stitch = (id) => $knots[id].knot.get() === `stitch`;

    const pos = (id) => $positions[id] || [0, 0, 0];
    const dest_count = {};
    const chan_depth = (id, chan) => {
      const $v = $knots[id].value.get();

      if (!$v) return [0, 0, 0]
      const idx = Object.keys($v).indexOf(chan);

      return [
        25 + (idx % 2) * 161.8,
        -125 * idx,
        0
      ]
    };

    // attempt to pull threads together
    Object.entries($threads).forEach(([
      address,
      address_o
    ]) => {
      const [id_o, chan_o] = address_o.split(`/`);
      const [id, chan] = address.split(`/`);

      // keep track of destinations
      dest_count[id_o] = dest_count[id_o]
        ? dest_count[id_o] + 1
        : 1;

      if (!$bodies[id] || !$bodies[id_o]) return

      const [w, h] = $bodies[id];
      const [w_o, h_o] = $bodies[id_o];
      // woho my friend

      // factor in size
      const pos_me = add(
        pos(id),
        [w + 16.18, h + 10, 0],
        chan_o === undefined
          ? multiply_scalar([
            0,
            h + 10,
            0
          ], dest_count[id_o] - 1)
          : chan_depth(id_o, chan_o)
      );

      let pos_other = add(
        pos(id_o),
        chan === undefined
          ? [0, 0, 0]
          : add(
            multiply(
              chan_depth(id, chan),
              [-1, 1, 0]
            ),
            [0, h / 1.5, 0]
          )
      );

      // stitch nipple
      if (stitch(id) && chan === undefined) {
        pos_other = add(
          pos_other,
          [w_o, h + h_o, 0]
        );
      }

      // moving to top left, don't need to worry about our own dims
      velocities[id] = add(
        vel(id),
        // difference of distance
        multiply_scalar(
          add(
            minus(
              pos_other,
              pos_me
            )
          ),
          FORCE_PULL
        )
      );

      velocities[id_o] = add(
        vel(id_o),
        // difference of distance
        multiply_scalar(
          add(
            minus(
              pos_me,
              pos_other
            )
          ),
          FORCE_PULL
        )
      );
    });

    // Quad tree eventually
    Object.entries($bodies).forEach(([
      id, [w, h]
    ]) => {
      id = id.split(`/`)[0];
      if (!$knots[id] || $knots[id].knot.get() === `stitch`) return
      if ($hoveree === id) {
        velocities[id] = [0, 0, 0];
        return
      }

      // n^2 sucks until quad tree
      Object.keys($bodies).forEach((o_id) => {
        if (o_id === id) return

        const [pos_id, pos_oid] = [
          $positions[id],
          $positions[o_id]
        ];
        if (!pos_id || !pos_oid) return

        const [[x, y], [o_x, o_y]] = [
          pos_id,
          pos_oid
        ];

        const [[w, h], [o_w, o_h]] = [
          $bodies[id],
          $bodies[o_id]
        ];

        // AABB
        if (
          x < o_x + o_w &&
          x + w > o_x &&
          y < o_y + o_h &&
          y + h > o_y
        ) {
          // move it
          const v = vel(id);

          // push directly away but
          // keep velocity so it can maybe go through
          velocities[id] = add(
            v,
            multiply_scalar(
              [x - o_x, y - o_y, 0],
              FORCE_STRONG
            )
          );
        }
      });

      // Decay the velocity
      velocities[id] = divide_scalar(vel(id), FORCE_DECAY);

      // simple length tests to modify velocity
      const [v_x, v_y] = vel(id);
      if (Math.abs(v_x) + Math.abs(v_y) < MIN_MOVE) return
      if (id === draggee.get()) return

      dirty = true;
      $positions[id] = add(
        pos(id),
        vel(id)
      );
    });

    if (dirty) positions.set($positions);
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
      screen: screen$1,
      input,
      key,
      flag
    })
  });

  function noop() { }
  const identity = x => x;
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
  function create_slot(definition, ctx, fn) {
      if (definition) {
          const slot_ctx = get_slot_context(definition, ctx, fn);
          return definition[0](slot_ctx);
      }
  }
  function get_slot_context(definition, ctx, fn) {
      return definition[1]
          ? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
          : ctx.$$scope.ctx;
  }
  function get_slot_changes(definition, ctx, changed, fn) {
      return definition[1]
          ? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
          : ctx.$$scope.changed || {};
  }
  function set_store_value(store, ret, value = ret) {
      store.set(value);
      return ret;
  }

  const is_client = typeof window !== 'undefined';
  let now = is_client
      ? () => window.performance.now()
      : () => Date.now();
  let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

  const tasks = new Set();
  let running$1 = false;
  function run_tasks() {
      tasks.forEach(task => {
          if (!task[0](now())) {
              tasks.delete(task);
              task[1]();
          }
      });
      running$1 = tasks.size > 0;
      if (running$1)
          raf(run_tasks);
  }
  function loop(fn) {
      let task;
      if (!running$1) {
          running$1 = true;
          raf(run_tasks);
      }
      return {
          promise: new Promise(fulfil => {
              tasks.add(task = [fn, fulfil]);
          }),
          abort() {
              tasks.delete(task);
          }
      };
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
  function svg_element(name) {
      return document.createElementNS('http://www.w3.org/2000/svg', name);
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
  function toggle_class(element, name, toggle) {
      element.classList[toggle ? 'add' : 'remove'](name);
  }
  function custom_event(type, detail) {
      const e = document.createEvent('CustomEvent');
      e.initCustomEvent(type, false, false, detail);
      return e;
  }

  let stylesheet;
  let active = 0;
  let current_rules = {};
  // https://github.com/darkskyapp/string-hash/blob/master/index.js
  function hash(str) {
      let hash = 5381;
      let i = str.length;
      while (i--)
          hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
      return hash >>> 0;
  }
  function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
      const step = 16.666 / duration;
      let keyframes = '{\n';
      for (let p = 0; p <= 1; p += step) {
          const t = a + (b - a) * ease(p);
          keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
      }
      const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
      const name = `__svelte_${hash(rule)}_${uid}`;
      if (!current_rules[name]) {
          if (!stylesheet) {
              const style = element('style');
              document.head.appendChild(style);
              stylesheet = style.sheet;
          }
          current_rules[name] = true;
          stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
      }
      const animation = node.style.animation || '';
      node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
      active += 1;
      return name;
  }
  function delete_rule(node, name) {
      node.style.animation = (node.style.animation || '')
          .split(', ')
          .filter(name
          ? anim => anim.indexOf(name) < 0 // remove specific animation
          : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
      )
          .join(', ');
      if (name && !--active)
          clear_rules();
  }
  function clear_rules() {
      raf(() => {
          if (active)
              return;
          let i = stylesheet.cssRules.length;
          while (i--)
              stylesheet.deleteRule(i);
          current_rules = {};
      });
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

  let promise;
  function wait() {
      if (!promise) {
          promise = Promise.resolve();
          promise.then(() => {
              promise = null;
          });
      }
      return promise;
  }
  function dispatch(node, direction, kind) {
      node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
  const null_transition = { duration: 0 };
  function create_in_transition(node, fn, params) {
      let config = fn(node, params);
      let running = false;
      let animation_name;
      let task;
      let uid = 0;
      function cleanup() {
          if (animation_name)
              delete_rule(node, animation_name);
      }
      function go() {
          const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
          if (css)
              animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
          tick(0, 1);
          const start_time = now() + delay;
          const end_time = start_time + duration;
          if (task)
              task.abort();
          running = true;
          add_render_callback(() => dispatch(node, true, 'start'));
          task = loop(now => {
              if (running) {
                  if (now >= end_time) {
                      tick(1, 0);
                      dispatch(node, true, 'end');
                      cleanup();
                      return running = false;
                  }
                  if (now >= start_time) {
                      const t = easing((now - start_time) / duration);
                      tick(t, 1 - t);
                  }
              }
              return running;
          });
      }
      let started = false;
      return {
          start() {
              if (started)
                  return;
              delete_rule(node);
              if (is_function(config)) {
                  config = config();
                  wait().then(go);
              }
              else {
                  go();
              }
          },
          invalidate() {
              started = false;
          },
          end() {
              if (running) {
                  cleanup();
                  running = false;
              }
          }
      };
  }
  function create_out_transition(node, fn, params) {
      let config = fn(node, params);
      let running = true;
      let animation_name;
      const group = outros;
      group.r += 1;
      function go() {
          const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
          if (css)
              animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
          const start_time = now() + delay;
          const end_time = start_time + duration;
          add_render_callback(() => dispatch(node, false, 'start'));
          loop(now => {
              if (running) {
                  if (now >= end_time) {
                      tick(0, 1);
                      dispatch(node, false, 'end');
                      if (!--group.r) {
                          // this will result in `end()` being called,
                          // so we don't need to clean up here
                          run_all(group.c);
                      }
                      return false;
                  }
                  if (now >= start_time) {
                      const t = easing((now - start_time) / duration);
                      tick(1 - t, t);
                  }
              }
              return running;
          });
      }
      if (is_function(config)) {
          wait().then(() => {
              // @ts-ignore
              config = config();
              go();
          });
      }
      else {
          go();
      }
      return {
          end(reset) {
              if (reset && config.tick) {
                  config.tick(1, 0);
              }
              if (running) {
                  if (animation_name)
                      delete_rule(node, animation_name);
                  running = false;
              }
          }
      };
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

  function destroy_block(block, lookup) {
      block.d(1);
      lookup.delete(block.key);
  }
  function outro_and_destroy_block(block, lookup) {
      transition_out(block, 1, 1, () => {
          lookup.delete(block.key);
      });
  }
  function update_keyed_each(old_blocks, changed, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
      let o = old_blocks.length;
      let n = list.length;
      let i = o;
      const old_indexes = {};
      while (i--)
          old_indexes[old_blocks[i].key] = i;
      const new_blocks = [];
      const new_lookup = new Map();
      const deltas = new Map();
      i = n;
      while (i--) {
          const child_ctx = get_context(ctx, list, i);
          const key = get_key(child_ctx);
          let block = lookup.get(key);
          if (!block) {
              block = create_each_block(key, child_ctx);
              block.c();
          }
          else if (dynamic) {
              block.p(changed, child_ctx);
          }
          new_lookup.set(key, new_blocks[i] = block);
          if (key in old_indexes)
              deltas.set(key, Math.abs(i - old_indexes[key]));
      }
      const will_move = new Set();
      const did_move = new Set();
      function insert(block) {
          transition_in(block, 1);
          block.m(node, next);
          lookup.set(block.key, block);
          next = block.first;
          n--;
      }
      while (o && n) {
          const new_block = new_blocks[n - 1];
          const old_block = old_blocks[o - 1];
          const new_key = new_block.key;
          const old_key = old_block.key;
          if (new_block === old_block) {
              // do nothing
              next = new_block.first;
              o--;
              n--;
          }
          else if (!new_lookup.has(old_key)) {
              // remove old block
              destroy(old_block, lookup);
              o--;
          }
          else if (!lookup.has(new_key) || will_move.has(new_key)) {
              insert(new_block);
          }
          else if (did_move.has(old_key)) {
              o--;
          }
          else if (deltas.get(new_key) > deltas.get(old_key)) {
              did_move.add(new_key);
              insert(new_block);
          }
          else {
              will_move.add(old_key);
              o--;
          }
      }
      while (o--) {
          const old_block = old_blocks[o];
          if (!new_lookup.has(old_block.key))
              destroy(old_block, lookup);
      }
      while (n)
          insert(new_blocks[n - 1]);
      return new_blocks;
  }
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

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var internal = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, '__esModule', { value: true });

  function noop() { }
  const identity = x => x;
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
  function not_equal(a, b) {
      return a != a ? b == b : a !== b;
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
  function get_store_value(store) {
      let value;
      subscribe(store, _ => value = _)();
      return value;
  }
  function component_subscribe(component, store, callback) {
      component.$$.on_destroy.push(subscribe(store, callback));
  }
  function create_slot(definition, ctx, fn) {
      if (definition) {
          const slot_ctx = get_slot_context(definition, ctx, fn);
          return definition[0](slot_ctx);
      }
  }
  function get_slot_context(definition, ctx, fn) {
      return definition[1]
          ? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
          : ctx.$$scope.ctx;
  }
  function get_slot_changes(definition, ctx, changed, fn) {
      return definition[1]
          ? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
          : ctx.$$scope.changed || {};
  }
  function exclude_internal_props(props) {
      const result = {};
      for (const k in props)
          if (k[0] !== '$')
              result[k] = props[k];
      return result;
  }
  function once(fn) {
      let ran = false;
      return function (...args) {
          if (ran)
              return;
          ran = true;
          fn.call(this, ...args);
      };
  }
  function null_to_empty(value) {
      return value == null ? '' : value;
  }
  function set_store_value(store, ret, value = ret) {
      store.set(value);
      return ret;
  }
  const has_prop = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

  const is_client = typeof window !== 'undefined';
  exports.now = is_client
      ? () => window.performance.now()
      : () => Date.now();
  exports.raf = is_client ? cb => requestAnimationFrame(cb) : noop;
  // used internally for testing
  function set_now(fn) {
      exports.now = fn;
  }
  function set_raf(fn) {
      exports.raf = fn;
  }

  const tasks = new Set();
  let running = false;
  function run_tasks() {
      tasks.forEach(task => {
          if (!task[0](exports.now())) {
              tasks.delete(task);
              task[1]();
          }
      });
      running = tasks.size > 0;
      if (running)
          exports.raf(run_tasks);
  }
  function clear_loops() {
      // for testing...
      tasks.forEach(task => tasks.delete(task));
      running = false;
  }
  function loop(fn) {
      let task;
      if (!running) {
          running = true;
          exports.raf(run_tasks);
      }
      return {
          promise: new Promise(fulfil => {
              tasks.add(task = [fn, fulfil]);
          }),
          abort() {
              tasks.delete(task);
          }
      };
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
  function element_is(name, is) {
      return document.createElement(name, { is });
  }
  function object_without_properties(obj, exclude) {
      // eslint-disable-next-line @typescript-eslint/no-object-literal-type-assertion
      const target = {};
      for (const k in obj) {
          if (has_prop(obj, k)
              // @ts-ignore
              && exclude.indexOf(k) === -1) {
              // @ts-ignore
              target[k] = obj[k];
          }
      }
      return target;
  }
  function svg_element(name) {
      return document.createElementNS('http://www.w3.org/2000/svg', name);
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
  function prevent_default(fn) {
      return function (event) {
          event.preventDefault();
          // @ts-ignore
          return fn.call(this, event);
      };
  }
  function stop_propagation(fn) {
      return function (event) {
          event.stopPropagation();
          // @ts-ignore
          return fn.call(this, event);
      };
  }
  function self(fn) {
      return function (event) {
          // @ts-ignore
          if (event.target === this)
              fn.call(this, event);
      };
  }
  function attr(node, attribute, value) {
      if (value == null)
          node.removeAttribute(attribute);
      else if (node.getAttribute(attribute) !== value)
          node.setAttribute(attribute, value);
  }
  function set_attributes(node, attributes) {
      // @ts-ignore
      const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
      for (const key in attributes) {
          if (attributes[key] == null) {
              node.removeAttribute(key);
          }
          else if (key === 'style') {
              node.style.cssText = attributes[key];
          }
          else if (descriptors[key] && descriptors[key].set) {
              node[key] = attributes[key];
          }
          else {
              attr(node, key, attributes[key]);
          }
      }
  }
  function set_svg_attributes(node, attributes) {
      for (const key in attributes) {
          attr(node, key, attributes[key]);
      }
  }
  function set_custom_element_data(node, prop, value) {
      if (prop in node) {
          node[prop] = value;
      }
      else {
          attr(node, prop, value);
      }
  }
  function xlink_attr(node, attribute, value) {
      node.setAttributeNS('http://www.w3.org/1999/xlink', attribute, value);
  }
  function get_binding_group_value(group) {
      const value = [];
      for (let i = 0; i < group.length; i += 1) {
          if (group[i].checked)
              value.push(group[i].__value);
      }
      return value;
  }
  function to_number(value) {
      return value === '' ? undefined : +value;
  }
  function time_ranges_to_array(ranges) {
      const array = [];
      for (let i = 0; i < ranges.length; i += 1) {
          array.push({ start: ranges.start(i), end: ranges.end(i) });
      }
      return array;
  }
  function children(element) {
      return Array.from(element.childNodes);
  }
  function claim_element(nodes, name, attributes, svg) {
      for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          if (node.nodeName === name) {
              for (let j = 0; j < node.attributes.length; j += 1) {
                  const attribute = node.attributes[j];
                  if (!attributes[attribute.name])
                      node.removeAttribute(attribute.name);
              }
              return nodes.splice(i, 1)[0]; // TODO strip unwanted attributes
          }
      }
      return svg ? svg_element(name) : element(name);
  }
  function claim_text(nodes, data) {
      for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          if (node.nodeType === 3) {
              node.data = '' + data;
              return nodes.splice(i, 1)[0];
          }
      }
      return text(data);
  }
  function claim_space(nodes) {
      return claim_text(nodes, ' ');
  }
  function set_data(text, data) {
      data = '' + data;
      if (text.data !== data)
          text.data = data;
  }
  function set_input_value(input, value) {
      if (value != null || input.value) {
          input.value = value;
      }
  }
  function set_input_type(input, type) {
      try {
          input.type = type;
      }
      catch (e) {
          // do nothing
      }
  }
  function set_style(node, key, value, important) {
      node.style.setProperty(key, value, important ? 'important' : '');
  }
  function select_option(select, value) {
      for (let i = 0; i < select.options.length; i += 1) {
          const option = select.options[i];
          if (option.__value === value) {
              option.selected = true;
              return;
          }
      }
  }
  function select_options(select, value) {
      for (let i = 0; i < select.options.length; i += 1) {
          const option = select.options[i];
          option.selected = ~value.indexOf(option.__value);
      }
  }
  function select_value(select) {
      const selected_option = select.querySelector(':checked') || select.options[0];
      return selected_option && selected_option.__value;
  }
  function select_multiple_value(select) {
      return [].map.call(select.querySelectorAll(':checked'), option => option.__value);
  }
  function add_resize_listener(element, fn) {
      if (getComputedStyle(element).position === 'static') {
          element.style.position = 'relative';
      }
      const object = document.createElement('object');
      object.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; pointer-events: none; z-index: -1;');
      object.type = 'text/html';
      object.tabIndex = -1;
      let win;
      object.onload = () => {
          win = object.contentDocument.defaultView;
          win.addEventListener('resize', fn);
      };
      if (/Trident/.test(navigator.userAgent)) {
          element.appendChild(object);
          object.data = 'about:blank';
      }
      else {
          object.data = 'about:blank';
          element.appendChild(object);
      }
      return {
          cancel: () => {
              win && win.removeEventListener && win.removeEventListener('resize', fn);
              element.removeChild(object);
          }
      };
  }
  function toggle_class(element, name, toggle) {
      element.classList[toggle ? 'add' : 'remove'](name);
  }
  function custom_event(type, detail) {
      const e = document.createEvent('CustomEvent');
      e.initCustomEvent(type, false, false, detail);
      return e;
  }
  class HtmlTag {
      constructor(html, anchor = null) {
          this.e = element('div');
          this.a = anchor;
          this.u(html);
      }
      m(target, anchor = null) {
          for (let i = 0; i < this.n.length; i += 1) {
              insert(target, this.n[i], anchor);
          }
          this.t = target;
      }
      u(html) {
          this.e.innerHTML = html;
          this.n = Array.from(this.e.childNodes);
      }
      p(html) {
          this.d();
          this.u(html);
          this.m(this.t, this.a);
      }
      d() {
          this.n.forEach(detach);
      }
  }

  let stylesheet;
  let active = 0;
  let current_rules = {};
  // https://github.com/darkskyapp/string-hash/blob/master/index.js
  function hash(str) {
      let hash = 5381;
      let i = str.length;
      while (i--)
          hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
      return hash >>> 0;
  }
  function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
      const step = 16.666 / duration;
      let keyframes = '{\n';
      for (let p = 0; p <= 1; p += step) {
          const t = a + (b - a) * ease(p);
          keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
      }
      const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
      const name = `__svelte_${hash(rule)}_${uid}`;
      if (!current_rules[name]) {
          if (!stylesheet) {
              const style = element('style');
              document.head.appendChild(style);
              stylesheet = style.sheet;
          }
          current_rules[name] = true;
          stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
      }
      const animation = node.style.animation || '';
      node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
      active += 1;
      return name;
  }
  function delete_rule(node, name) {
      node.style.animation = (node.style.animation || '')
          .split(', ')
          .filter(name
          ? anim => anim.indexOf(name) < 0 // remove specific animation
          : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
      )
          .join(', ');
      if (name && !--active)
          clear_rules();
  }
  function clear_rules() {
      exports.raf(() => {
          if (active)
              return;
          let i = stylesheet.cssRules.length;
          while (i--)
              stylesheet.deleteRule(i);
          current_rules = {};
      });
  }

  function create_animation(node, from, fn, params) {
      if (!from)
          return noop;
      const to = node.getBoundingClientRect();
      if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
          return noop;
      const { delay = 0, duration = 300, easing = identity, 
      // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
      start: start_time = exports.now() + delay, 
      // @ts-ignore todo:
      end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
      let running = true;
      let started = false;
      let name;
      function start() {
          if (css) {
              name = create_rule(node, 0, 1, duration, delay, easing, css);
          }
          if (!delay) {
              started = true;
          }
      }
      function stop() {
          if (css)
              delete_rule(node, name);
          running = false;
      }
      loop(now => {
          if (!started && now >= start_time) {
              started = true;
          }
          if (started && now >= end) {
              tick(1, 0);
              stop();
          }
          if (!running) {
              return false;
          }
          if (started) {
              const p = now - start_time;
              const t = 0 + 1 * easing(p / duration);
              tick(t, 1 - t);
          }
          return true;
      });
      start();
      tick(0, 1);
      return stop;
  }
  function fix_position(node) {
      const style = getComputedStyle(node);
      if (style.position !== 'absolute' && style.position !== 'fixed') {
          const { width, height } = style;
          const a = node.getBoundingClientRect();
          node.style.position = 'absolute';
          node.style.width = width;
          node.style.height = height;
          add_transform(node, a);
      }
  }
  function add_transform(node, a) {
      const b = node.getBoundingClientRect();
      if (a.left !== b.left || a.top !== b.top) {
          const style = getComputedStyle(node);
          const transform = style.transform === 'none' ? '' : style.transform;
          node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
      }
  }

  function set_current_component(component) {
      exports.current_component = component;
  }
  function get_current_component() {
      if (!exports.current_component)
          throw new Error(`Function called outside component initialization`);
      return exports.current_component;
  }
  function beforeUpdate(fn) {
      get_current_component().$$.before_update.push(fn);
  }
  function onMount(fn) {
      get_current_component().$$.on_mount.push(fn);
  }
  function afterUpdate(fn) {
      get_current_component().$$.after_update.push(fn);
  }
  function onDestroy(fn) {
      get_current_component().$$.on_destroy.push(fn);
  }
  function createEventDispatcher() {
      const component = get_current_component();
      return (type, detail) => {
          const callbacks = component.$$.callbacks[type];
          if (callbacks) {
              // TODO are there situations where events could be dispatched
              // in a server (non-DOM) environment?
              const event = custom_event(type, detail);
              callbacks.slice().forEach(fn => {
                  fn.call(component, event);
              });
          }
      };
  }
  function setContext(key, context) {
      get_current_component().$$.context.set(key, context);
  }
  function getContext(key) {
      return get_current_component().$$.context.get(key);
  }
  // TODO figure out if we still want to support
  // shorthand events, or if we want to implement
  // a real bubbling mechanism
  function bubble(component, event) {
      const callbacks = component.$$.callbacks[event.type];
      if (callbacks) {
          callbacks.slice().forEach(fn => fn(event));
      }
  }

  const dirty_components = [];
  const intros = { enabled: false };
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
  function tick() {
      schedule_update();
      return resolved_promise;
  }
  function add_render_callback(fn) {
      render_callbacks.push(fn);
  }
  function add_flush_callback(fn) {
      flush_callbacks.push(fn);
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

  let promise;
  function wait() {
      if (!promise) {
          promise = Promise.resolve();
          promise.then(() => {
              promise = null;
          });
      }
      return promise;
  }
  function dispatch(node, direction, kind) {
      node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
  const null_transition = { duration: 0 };
  function create_in_transition(node, fn, params) {
      let config = fn(node, params);
      let running = false;
      let animation_name;
      let task;
      let uid = 0;
      function cleanup() {
          if (animation_name)
              delete_rule(node, animation_name);
      }
      function go() {
          const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
          if (css)
              animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
          tick(0, 1);
          const start_time = exports.now() + delay;
          const end_time = start_time + duration;
          if (task)
              task.abort();
          running = true;
          add_render_callback(() => dispatch(node, true, 'start'));
          task = loop(now => {
              if (running) {
                  if (now >= end_time) {
                      tick(1, 0);
                      dispatch(node, true, 'end');
                      cleanup();
                      return running = false;
                  }
                  if (now >= start_time) {
                      const t = easing((now - start_time) / duration);
                      tick(t, 1 - t);
                  }
              }
              return running;
          });
      }
      let started = false;
      return {
          start() {
              if (started)
                  return;
              delete_rule(node);
              if (is_function(config)) {
                  config = config();
                  wait().then(go);
              }
              else {
                  go();
              }
          },
          invalidate() {
              started = false;
          },
          end() {
              if (running) {
                  cleanup();
                  running = false;
              }
          }
      };
  }
  function create_out_transition(node, fn, params) {
      let config = fn(node, params);
      let running = true;
      let animation_name;
      const group = outros;
      group.r += 1;
      function go() {
          const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
          if (css)
              animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
          const start_time = exports.now() + delay;
          const end_time = start_time + duration;
          add_render_callback(() => dispatch(node, false, 'start'));
          loop(now => {
              if (running) {
                  if (now >= end_time) {
                      tick(0, 1);
                      dispatch(node, false, 'end');
                      if (!--group.r) {
                          // this will result in `end()` being called,
                          // so we don't need to clean up here
                          run_all(group.c);
                      }
                      return false;
                  }
                  if (now >= start_time) {
                      const t = easing((now - start_time) / duration);
                      tick(1 - t, t);
                  }
              }
              return running;
          });
      }
      if (is_function(config)) {
          wait().then(() => {
              // @ts-ignore
              config = config();
              go();
          });
      }
      else {
          go();
      }
      return {
          end(reset) {
              if (reset && config.tick) {
                  config.tick(1, 0);
              }
              if (running) {
                  if (animation_name)
                      delete_rule(node, animation_name);
                  running = false;
              }
          }
      };
  }
  function create_bidirectional_transition(node, fn, params, intro) {
      let config = fn(node, params);
      let t = intro ? 0 : 1;
      let running_program = null;
      let pending_program = null;
      let animation_name = null;
      function clear_animation() {
          if (animation_name)
              delete_rule(node, animation_name);
      }
      function init(program, duration) {
          const d = program.b - t;
          duration *= Math.abs(d);
          return {
              a: t,
              b: program.b,
              d,
              duration,
              start: program.start,
              end: program.start + duration,
              group: program.group
          };
      }
      function go(b) {
          const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
          const program = {
              start: exports.now() + delay,
              b
          };
          if (!b) {
              // @ts-ignore todo: improve typings
              program.group = outros;
              outros.r += 1;
          }
          if (running_program) {
              pending_program = program;
          }
          else {
              // if this is an intro, and there's a delay, we need to do
              // an initial tick and/or apply CSS animation immediately
              if (css) {
                  clear_animation();
                  animation_name = create_rule(node, t, b, duration, delay, easing, css);
              }
              if (b)
                  tick(0, 1);
              running_program = init(program, duration);
              add_render_callback(() => dispatch(node, b, 'start'));
              loop(now => {
                  if (pending_program && now > pending_program.start) {
                      running_program = init(pending_program, duration);
                      pending_program = null;
                      dispatch(node, running_program.b, 'start');
                      if (css) {
                          clear_animation();
                          animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                      }
                  }
                  if (running_program) {
                      if (now >= running_program.end) {
                          tick(t = running_program.b, 1 - t);
                          dispatch(node, running_program.b, 'end');
                          if (!pending_program) {
                              // we're done
                              if (running_program.b) {
                                  // intro — we can tidy up immediately
                                  clear_animation();
                              }
                              else {
                                  // outro — needs to be coordinated
                                  if (!--running_program.group.r)
                                      run_all(running_program.group.c);
                              }
                          }
                          running_program = null;
                      }
                      else if (now >= running_program.start) {
                          const p = now - running_program.start;
                          t = running_program.a + running_program.d * easing(p / running_program.duration);
                          tick(t, 1 - t);
                      }
                  }
                  return !!(running_program || pending_program);
              });
          }
      }
      return {
          run(b) {
              if (is_function(config)) {
                  wait().then(() => {
                      // @ts-ignore
                      config = config();
                      go(b);
                  });
              }
              else {
                  go(b);
              }
          },
          end() {
              clear_animation();
              running_program = pending_program = null;
          }
      };
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

  const globals = (typeof window !== 'undefined' ? window : commonjsGlobal);

  function destroy_block(block, lookup) {
      block.d(1);
      lookup.delete(block.key);
  }
  function outro_and_destroy_block(block, lookup) {
      transition_out(block, 1, 1, () => {
          lookup.delete(block.key);
      });
  }
  function fix_and_destroy_block(block, lookup) {
      block.f();
      destroy_block(block, lookup);
  }
  function fix_and_outro_and_destroy_block(block, lookup) {
      block.f();
      outro_and_destroy_block(block, lookup);
  }
  function update_keyed_each(old_blocks, changed, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
      let o = old_blocks.length;
      let n = list.length;
      let i = o;
      const old_indexes = {};
      while (i--)
          old_indexes[old_blocks[i].key] = i;
      const new_blocks = [];
      const new_lookup = new Map();
      const deltas = new Map();
      i = n;
      while (i--) {
          const child_ctx = get_context(ctx, list, i);
          const key = get_key(child_ctx);
          let block = lookup.get(key);
          if (!block) {
              block = create_each_block(key, child_ctx);
              block.c();
          }
          else if (dynamic) {
              block.p(changed, child_ctx);
          }
          new_lookup.set(key, new_blocks[i] = block);
          if (key in old_indexes)
              deltas.set(key, Math.abs(i - old_indexes[key]));
      }
      const will_move = new Set();
      const did_move = new Set();
      function insert(block) {
          transition_in(block, 1);
          block.m(node, next);
          lookup.set(block.key, block);
          next = block.first;
          n--;
      }
      while (o && n) {
          const new_block = new_blocks[n - 1];
          const old_block = old_blocks[o - 1];
          const new_key = new_block.key;
          const old_key = old_block.key;
          if (new_block === old_block) {
              // do nothing
              next = new_block.first;
              o--;
              n--;
          }
          else if (!new_lookup.has(old_key)) {
              // remove old block
              destroy(old_block, lookup);
              o--;
          }
          else if (!lookup.has(new_key) || will_move.has(new_key)) {
              insert(new_block);
          }
          else if (did_move.has(old_key)) {
              o--;
          }
          else if (deltas.get(new_key) > deltas.get(old_key)) {
              did_move.add(new_key);
              insert(new_block);
          }
          else {
              will_move.add(old_key);
              o--;
          }
      }
      while (o--) {
          const old_block = old_blocks[o];
          if (!new_lookup.has(old_block.key))
              destroy(old_block, lookup);
      }
      while (n)
          insert(new_blocks[n - 1]);
      return new_blocks;
  }
  function measure(blocks) {
      const rects = {};
      let i = blocks.length;
      while (i--)
          rects[blocks[i].key] = blocks[i].node.getBoundingClientRect();
      return rects;
  }

  function get_spread_update(levels, updates) {
      const update = {};
      const to_null_out = {};
      const accounted_for = { $$scope: 1 };
      let i = levels.length;
      while (i--) {
          const o = levels[i];
          const n = updates[i];
          if (n) {
              for (const key in o) {
                  if (!(key in n))
                      to_null_out[key] = 1;
              }
              for (const key in n) {
                  if (!accounted_for[key]) {
                      update[key] = n[key];
                      accounted_for[key] = 1;
                  }
              }
              levels[i] = n;
          }
          else {
              for (const key in o) {
                  accounted_for[key] = 1;
              }
          }
      }
      for (const key in to_null_out) {
          if (!(key in update))
              update[key] = undefined;
      }
      return update;
  }
  function get_spread_object(spread_props) {
      return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
  }

  // source: https://html.spec.whatwg.org/multipage/indices.html
  const boolean_attributes = new Set([
      'allowfullscreen',
      'allowpaymentrequest',
      'async',
      'autofocus',
      'autoplay',
      'checked',
      'controls',
      'default',
      'defer',
      'disabled',
      'formnovalidate',
      'hidden',
      'ismap',
      'loop',
      'multiple',
      'muted',
      'nomodule',
      'novalidate',
      'open',
      'playsinline',
      'readonly',
      'required',
      'reversed',
      'selected'
  ]);

  const invalid_attribute_name_character = /[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
  // https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
  // https://infra.spec.whatwg.org/#noncharacter
  function spread(args, classes_to_add) {
      const attributes = Object.assign({}, ...args);
      if (classes_to_add) {
          if (attributes.class == null) {
              attributes.class = classes_to_add;
          }
          else {
              attributes.class += ' ' + classes_to_add;
          }
      }
      let str = '';
      Object.keys(attributes).forEach(name => {
          if (invalid_attribute_name_character.test(name))
              return;
          const value = attributes[name];
          if (value === true)
              str += " " + name;
          else if (boolean_attributes.has(name.toLowerCase())) {
              if (value)
                  str += " " + name;
          }
          else if (value != null) {
              str += " " + name + "=" + JSON.stringify(String(value)
                  .replace(/"/g, '&#34;')
                  .replace(/'/g, '&#39;'));
          }
      });
      return str;
  }
  const escaped = {
      '"': '&quot;',
      "'": '&#39;',
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;'
  };
  function escape(html) {
      return String(html).replace(/["'&<>]/g, match => escaped[match]);
  }
  function each(items, fn) {
      let str = '';
      for (let i = 0; i < items.length; i += 1) {
          str += fn(items[i], i);
      }
      return str;
  }
  const missing_component = {
      $$render: () => ''
  };
  function validate_component(component, name) {
      if (!component || !component.$$render) {
          if (name === 'svelte:component')
              name += ' this={...}';
          throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
      }
      return component;
  }
  function debug(file, line, column, values) {
      console.log(`{@debug} ${file ? file + ' ' : ''}(${line}:${column})`); // eslint-disable-line no-console
      console.log(values); // eslint-disable-line no-console
      return '';
  }
  let on_destroy;
  function create_ssr_component(fn) {
      function $$render(result, props, bindings, slots) {
          const parent_component = exports.current_component;
          const $$ = {
              on_destroy,
              context: new Map(parent_component ? parent_component.$$.context : []),
              // these will be immediately discarded
              on_mount: [],
              before_update: [],
              after_update: [],
              callbacks: blank_object()
          };
          set_current_component({ $$ });
          const html = fn(result, props, bindings, slots);
          set_current_component(parent_component);
          return html;
      }
      return {
          render: (props = {}, options = {}) => {
              on_destroy = [];
              const result = { head: '', css: new Set() };
              const html = $$render(result, props, {}, options);
              run_all(on_destroy);
              return {
                  html,
                  css: {
                      code: Array.from(result.css).map(css => css.code).join('\n'),
                      map: null // TODO
                  },
                  head: result.head
              };
          },
          $$render
      };
  }
  function add_attribute(name, value, boolean) {
      if (value == null || (boolean && !value))
          return '';
      return ` ${name}${value === true ? '' : `=${typeof value === 'string' ? JSON.stringify(escape(value)) : `"${value}"`}`}`;
  }
  function add_classes(classes) {
      return classes ? ` class="${classes}"` : ``;
  }

  function bind(component, name, callback) {
      if (has_prop(component.$$.props, name)) {
          name = component.$$.props[name] || name;
          component.$$.bound[name] = callback;
          callback(component.$$.ctx[name]);
      }
  }
  function create_component(block) {
      block && block.c();
  }
  function claim_component(block, parent_nodes) {
      block && block.l(parent_nodes);
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
      const parent_component = exports.current_component;
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
  if (typeof HTMLElement === 'function') {
      exports.SvelteElement = class extends HTMLElement {
          constructor() {
              super();
              this.attachShadow({ mode: 'open' });
          }
          connectedCallback() {
              // @ts-ignore todo: improve typings
              for (const key in this.$$.slotted) {
                  // @ts-ignore todo: improve typings
                  this.appendChild(this.$$.slotted[key]);
              }
          }
          attributeChangedCallback(attr, _oldValue, newValue) {
              this[attr] = newValue;
          }
          $destroy() {
              destroy_component(this, 1);
              this.$destroy = noop;
          }
          $on(type, callback) {
              // TODO should this delegate to addEventListener?
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
      };
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
  function detach_between_dev(before, after) {
      while (before.nextSibling && before.nextSibling !== after) {
          detach_dev(before.nextSibling);
      }
  }
  function detach_before_dev(after) {
      while (after.previousSibling) {
          detach_dev(after.previousSibling);
      }
  }
  function detach_after_dev(before) {
      while (before.nextSibling) {
          detach_dev(before.nextSibling);
      }
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
  function prop_dev(node, property, value) {
      node[property] = value;
      dispatch_dev("SvelteDOMSetProperty", { node, property, value });
  }
  function dataset_dev(node, property, value) {
      node.dataset[property] = value;
      dispatch_dev("SvelteDOMSetDataset", { node, property, value });
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
  function loop_guard(timeout) {
      const start = Date.now();
      return () => {
          if (Date.now() - start > timeout) {
              throw new Error(`Infinite loop detected`);
          }
      };
  }

  exports.HtmlTag = HtmlTag;
  exports.SvelteComponent = SvelteComponent;
  exports.SvelteComponentDev = SvelteComponentDev;
  exports.add_attribute = add_attribute;
  exports.add_classes = add_classes;
  exports.add_flush_callback = add_flush_callback;
  exports.add_location = add_location;
  exports.add_render_callback = add_render_callback;
  exports.add_resize_listener = add_resize_listener;
  exports.add_transform = add_transform;
  exports.afterUpdate = afterUpdate;
  exports.append = append;
  exports.append_dev = append_dev;
  exports.assign = assign;
  exports.attr = attr;
  exports.attr_dev = attr_dev;
  exports.beforeUpdate = beforeUpdate;
  exports.bind = bind;
  exports.binding_callbacks = binding_callbacks;
  exports.blank_object = blank_object;
  exports.bubble = bubble;
  exports.check_outros = check_outros;
  exports.children = children;
  exports.claim_component = claim_component;
  exports.claim_element = claim_element;
  exports.claim_space = claim_space;
  exports.claim_text = claim_text;
  exports.clear_loops = clear_loops;
  exports.component_subscribe = component_subscribe;
  exports.createEventDispatcher = createEventDispatcher;
  exports.create_animation = create_animation;
  exports.create_bidirectional_transition = create_bidirectional_transition;
  exports.create_component = create_component;
  exports.create_in_transition = create_in_transition;
  exports.create_out_transition = create_out_transition;
  exports.create_slot = create_slot;
  exports.create_ssr_component = create_ssr_component;
  exports.custom_event = custom_event;
  exports.dataset_dev = dataset_dev;
  exports.debug = debug;
  exports.destroy_block = destroy_block;
  exports.destroy_component = destroy_component;
  exports.destroy_each = destroy_each;
  exports.detach = detach;
  exports.detach_after_dev = detach_after_dev;
  exports.detach_before_dev = detach_before_dev;
  exports.detach_between_dev = detach_between_dev;
  exports.detach_dev = detach_dev;
  exports.dirty_components = dirty_components;
  exports.dispatch_dev = dispatch_dev;
  exports.each = each;
  exports.element = element;
  exports.element_is = element_is;
  exports.empty = empty;
  exports.escape = escape;
  exports.escaped = escaped;
  exports.exclude_internal_props = exclude_internal_props;
  exports.fix_and_destroy_block = fix_and_destroy_block;
  exports.fix_and_outro_and_destroy_block = fix_and_outro_and_destroy_block;
  exports.fix_position = fix_position;
  exports.flush = flush;
  exports.getContext = getContext;
  exports.get_binding_group_value = get_binding_group_value;
  exports.get_current_component = get_current_component;
  exports.get_slot_changes = get_slot_changes;
  exports.get_slot_context = get_slot_context;
  exports.get_spread_object = get_spread_object;
  exports.get_spread_update = get_spread_update;
  exports.get_store_value = get_store_value;
  exports.globals = globals;
  exports.group_outros = group_outros;
  exports.handle_promise = handle_promise;
  exports.has_prop = has_prop;
  exports.identity = identity;
  exports.init = init;
  exports.insert = insert;
  exports.insert_dev = insert_dev;
  exports.intros = intros;
  exports.invalid_attribute_name_character = invalid_attribute_name_character;
  exports.is_client = is_client;
  exports.is_function = is_function;
  exports.is_promise = is_promise;
  exports.listen = listen;
  exports.listen_dev = listen_dev;
  exports.loop = loop;
  exports.loop_guard = loop_guard;
  exports.measure = measure;
  exports.missing_component = missing_component;
  exports.mount_component = mount_component;
  exports.noop = noop;
  exports.not_equal = not_equal;
  exports.null_to_empty = null_to_empty;
  exports.object_without_properties = object_without_properties;
  exports.onDestroy = onDestroy;
  exports.onMount = onMount;
  exports.once = once;
  exports.outro_and_destroy_block = outro_and_destroy_block;
  exports.prevent_default = prevent_default;
  exports.prop_dev = prop_dev;
  exports.run = run;
  exports.run_all = run_all;
  exports.safe_not_equal = safe_not_equal;
  exports.schedule_update = schedule_update;
  exports.select_multiple_value = select_multiple_value;
  exports.select_option = select_option;
  exports.select_options = select_options;
  exports.select_value = select_value;
  exports.self = self;
  exports.setContext = setContext;
  exports.set_attributes = set_attributes;
  exports.set_current_component = set_current_component;
  exports.set_custom_element_data = set_custom_element_data;
  exports.set_data = set_data;
  exports.set_data_dev = set_data_dev;
  exports.set_input_type = set_input_type;
  exports.set_input_value = set_input_value;
  exports.set_now = set_now;
  exports.set_raf = set_raf;
  exports.set_store_value = set_store_value;
  exports.set_style = set_style;
  exports.set_svg_attributes = set_svg_attributes;
  exports.space = space;
  exports.spread = spread;
  exports.stop_propagation = stop_propagation;
  exports.subscribe = subscribe;
  exports.svg_element = svg_element;
  exports.text = text;
  exports.tick = tick;
  exports.time_ranges_to_array = time_ranges_to_array;
  exports.to_number = to_number;
  exports.toggle_class = toggle_class;
  exports.transition_in = transition_in;
  exports.transition_out = transition_out;
  exports.update_keyed_each = update_keyed_each;
  exports.validate_component = validate_component;
  exports.validate_store = validate_store;
  exports.xlink_attr = xlink_attr;
  });

  unwrapExports(internal);
  var internal_1 = internal.now;
  var internal_2 = internal.raf;
  var internal_3 = internal.current_component;
  var internal_4 = internal.SvelteElement;
  var internal_5 = internal.HtmlTag;
  var internal_6 = internal.SvelteComponent;
  var internal_7 = internal.SvelteComponentDev;
  var internal_8 = internal.add_attribute;
  var internal_9 = internal.add_classes;
  var internal_10 = internal.add_flush_callback;
  var internal_11 = internal.add_location;
  var internal_12 = internal.add_render_callback;
  var internal_13 = internal.add_resize_listener;
  var internal_14 = internal.add_transform;
  var internal_15 = internal.afterUpdate;
  var internal_16 = internal.append;
  var internal_17 = internal.append_dev;
  var internal_18 = internal.assign;
  var internal_19 = internal.attr;
  var internal_20 = internal.attr_dev;
  var internal_21 = internal.beforeUpdate;
  var internal_22 = internal.bind;
  var internal_23 = internal.binding_callbacks;
  var internal_24 = internal.blank_object;
  var internal_25 = internal.bubble;
  var internal_26 = internal.check_outros;
  var internal_27 = internal.children;
  var internal_28 = internal.claim_component;
  var internal_29 = internal.claim_element;
  var internal_30 = internal.claim_space;
  var internal_31 = internal.claim_text;
  var internal_32 = internal.clear_loops;
  var internal_33 = internal.component_subscribe;
  var internal_34 = internal.createEventDispatcher;
  var internal_35 = internal.create_animation;
  var internal_36 = internal.create_bidirectional_transition;
  var internal_37 = internal.create_component;
  var internal_38 = internal.create_in_transition;
  var internal_39 = internal.create_out_transition;
  var internal_40 = internal.create_slot;
  var internal_41 = internal.create_ssr_component;
  var internal_42 = internal.custom_event;
  var internal_43 = internal.dataset_dev;
  var internal_44 = internal.debug;
  var internal_45 = internal.destroy_block;
  var internal_46 = internal.destroy_component;
  var internal_47 = internal.destroy_each;
  var internal_48 = internal.detach;
  var internal_49 = internal.detach_after_dev;
  var internal_50 = internal.detach_before_dev;
  var internal_51 = internal.detach_between_dev;
  var internal_52 = internal.detach_dev;
  var internal_53 = internal.dirty_components;
  var internal_54 = internal.dispatch_dev;
  var internal_55 = internal.each;
  var internal_56 = internal.element;
  var internal_57 = internal.element_is;
  var internal_58 = internal.empty;
  var internal_59 = internal.escape;
  var internal_60 = internal.escaped;
  var internal_61 = internal.exclude_internal_props;
  var internal_62 = internal.fix_and_destroy_block;
  var internal_63 = internal.fix_and_outro_and_destroy_block;
  var internal_64 = internal.fix_position;
  var internal_65 = internal.flush;
  var internal_66 = internal.getContext;
  var internal_67 = internal.get_binding_group_value;
  var internal_68 = internal.get_current_component;
  var internal_69 = internal.get_slot_changes;
  var internal_70 = internal.get_slot_context;
  var internal_71 = internal.get_spread_object;
  var internal_72 = internal.get_spread_update;
  var internal_73 = internal.get_store_value;
  var internal_74 = internal.globals;
  var internal_75 = internal.group_outros;
  var internal_76 = internal.handle_promise;
  var internal_77 = internal.has_prop;
  var internal_78 = internal.identity;
  var internal_79 = internal.init;
  var internal_80 = internal.insert;
  var internal_81 = internal.insert_dev;
  var internal_82 = internal.intros;
  var internal_83 = internal.invalid_attribute_name_character;
  var internal_84 = internal.is_client;
  var internal_85 = internal.is_function;
  var internal_86 = internal.is_promise;
  var internal_87 = internal.listen;
  var internal_88 = internal.listen_dev;
  var internal_89 = internal.loop;
  var internal_90 = internal.loop_guard;
  var internal_91 = internal.measure;
  var internal_92 = internal.missing_component;
  var internal_93 = internal.mount_component;
  var internal_94 = internal.noop;
  var internal_95 = internal.not_equal;
  var internal_96 = internal.null_to_empty;
  var internal_97 = internal.object_without_properties;
  var internal_98 = internal.onDestroy;
  var internal_99 = internal.onMount;
  var internal_100 = internal.once;
  var internal_101 = internal.outro_and_destroy_block;
  var internal_102 = internal.prevent_default;
  var internal_103 = internal.prop_dev;
  var internal_104 = internal.run;
  var internal_105 = internal.run_all;
  var internal_106 = internal.safe_not_equal;
  var internal_107 = internal.schedule_update;
  var internal_108 = internal.select_multiple_value;
  var internal_109 = internal.select_option;
  var internal_110 = internal.select_options;
  var internal_111 = internal.select_value;
  var internal_112 = internal.self;
  var internal_113 = internal.setContext;
  var internal_114 = internal.set_attributes;
  var internal_115 = internal.set_current_component;
  var internal_116 = internal.set_custom_element_data;
  var internal_117 = internal.set_data;
  var internal_118 = internal.set_data_dev;
  var internal_119 = internal.set_input_type;
  var internal_120 = internal.set_input_value;
  var internal_121 = internal.set_now;
  var internal_122 = internal.set_raf;
  var internal_123 = internal.set_store_value;
  var internal_124 = internal.set_style;
  var internal_125 = internal.set_svg_attributes;
  var internal_126 = internal.space;
  var internal_127 = internal.spread;
  var internal_128 = internal.stop_propagation;
  var internal_129 = internal.subscribe;
  var internal_130 = internal.svg_element;
  var internal_131 = internal.text;
  var internal_132 = internal.tick;
  var internal_133 = internal.time_ranges_to_array;
  var internal_134 = internal.to_number;
  var internal_135 = internal.toggle_class;
  var internal_136 = internal.transition_in;
  var internal_137 = internal.transition_out;
  var internal_138 = internal.update_keyed_each;
  var internal_139 = internal.validate_component;
  var internal_140 = internal.validate_store;
  var internal_141 = internal.xlink_attr;

  var easing = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, '__esModule', { value: true });



  /*
  Adapted from https://github.com/mattdesl
  Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
  */
  function backInOut(t) {
      const s = 1.70158 * 1.525;
      if ((t *= 2) < 1)
          return 0.5 * (t * t * ((s + 1) * t - s));
      return 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
  }
  function backIn(t) {
      const s = 1.70158;
      return t * t * ((s + 1) * t - s);
  }
  function backOut(t) {
      const s = 1.70158;
      return --t * t * ((s + 1) * t + s) + 1;
  }
  function bounceOut(t) {
      const a = 4.0 / 11.0;
      const b = 8.0 / 11.0;
      const c = 9.0 / 10.0;
      const ca = 4356.0 / 361.0;
      const cb = 35442.0 / 1805.0;
      const cc = 16061.0 / 1805.0;
      const t2 = t * t;
      return t < a
          ? 7.5625 * t2
          : t < b
              ? 9.075 * t2 - 9.9 * t + 3.4
              : t < c
                  ? ca * t2 - cb * t + cc
                  : 10.8 * t * t - 20.52 * t + 10.72;
  }
  function bounceInOut(t) {
      return t < 0.5
          ? 0.5 * (1.0 - bounceOut(1.0 - t * 2.0))
          : 0.5 * bounceOut(t * 2.0 - 1.0) + 0.5;
  }
  function bounceIn(t) {
      return 1.0 - bounceOut(1.0 - t);
  }
  function circInOut(t) {
      if ((t *= 2) < 1)
          return -0.5 * (Math.sqrt(1 - t * t) - 1);
      return 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1);
  }
  function circIn(t) {
      return 1.0 - Math.sqrt(1.0 - t * t);
  }
  function circOut(t) {
      return Math.sqrt(1 - --t * t);
  }
  function cubicInOut(t) {
      return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
  }
  function cubicIn(t) {
      return t * t * t;
  }
  function cubicOut(t) {
      const f = t - 1.0;
      return f * f * f + 1.0;
  }
  function elasticInOut(t) {
      return t < 0.5
          ? 0.5 *
              Math.sin(((+13.0 * Math.PI) / 2) * 2.0 * t) *
              Math.pow(2.0, 10.0 * (2.0 * t - 1.0))
          : 0.5 *
              Math.sin(((-13.0 * Math.PI) / 2) * (2.0 * t - 1.0 + 1.0)) *
              Math.pow(2.0, -10.0 * (2.0 * t - 1.0)) +
              1.0;
  }
  function elasticIn(t) {
      return Math.sin((13.0 * t * Math.PI) / 2) * Math.pow(2.0, 10.0 * (t - 1.0));
  }
  function elasticOut(t) {
      return (Math.sin((-13.0 * (t + 1.0) * Math.PI) / 2) * Math.pow(2.0, -10.0 * t) + 1.0);
  }
  function expoInOut(t) {
      return t === 0.0 || t === 1.0
          ? t
          : t < 0.5
              ? +0.5 * Math.pow(2.0, 20.0 * t - 10.0)
              : -0.5 * Math.pow(2.0, 10.0 - t * 20.0) + 1.0;
  }
  function expoIn(t) {
      return t === 0.0 ? t : Math.pow(2.0, 10.0 * (t - 1.0));
  }
  function expoOut(t) {
      return t === 1.0 ? t : 1.0 - Math.pow(2.0, -10.0 * t);
  }
  function quadInOut(t) {
      t /= 0.5;
      if (t < 1)
          return 0.5 * t * t;
      t--;
      return -0.5 * (t * (t - 2) - 1);
  }
  function quadIn(t) {
      return t * t;
  }
  function quadOut(t) {
      return -t * (t - 2.0);
  }
  function quartInOut(t) {
      return t < 0.5
          ? +8.0 * Math.pow(t, 4.0)
          : -8.0 * Math.pow(t - 1.0, 4.0) + 1.0;
  }
  function quartIn(t) {
      return Math.pow(t, 4.0);
  }
  function quartOut(t) {
      return Math.pow(t - 1.0, 3.0) * (1.0 - t) + 1.0;
  }
  function quintInOut(t) {
      if ((t *= 2) < 1)
          return 0.5 * t * t * t * t * t;
      return 0.5 * ((t -= 2) * t * t * t * t + 2);
  }
  function quintIn(t) {
      return t * t * t * t * t;
  }
  function quintOut(t) {
      return --t * t * t * t * t + 1;
  }
  function sineInOut(t) {
      return -0.5 * (Math.cos(Math.PI * t) - 1);
  }
  function sineIn(t) {
      const v = Math.cos(t * Math.PI * 0.5);
      if (Math.abs(v) < 1e-14)
          return 1;
      else
          return 1 - v;
  }
  function sineOut(t) {
      return Math.sin((t * Math.PI) / 2);
  }

  Object.defineProperty(exports, 'linear', {
  	enumerable: true,
  	get: function () {
  		return internal.identity;
  	}
  });
  exports.backIn = backIn;
  exports.backInOut = backInOut;
  exports.backOut = backOut;
  exports.bounceIn = bounceIn;
  exports.bounceInOut = bounceInOut;
  exports.bounceOut = bounceOut;
  exports.circIn = circIn;
  exports.circInOut = circInOut;
  exports.circOut = circOut;
  exports.cubicIn = cubicIn;
  exports.cubicInOut = cubicInOut;
  exports.cubicOut = cubicOut;
  exports.elasticIn = elasticIn;
  exports.elasticInOut = elasticInOut;
  exports.elasticOut = elasticOut;
  exports.expoIn = expoIn;
  exports.expoInOut = expoInOut;
  exports.expoOut = expoOut;
  exports.quadIn = quadIn;
  exports.quadInOut = quadInOut;
  exports.quadOut = quadOut;
  exports.quartIn = quartIn;
  exports.quartInOut = quartInOut;
  exports.quartOut = quartOut;
  exports.quintIn = quintIn;
  exports.quintInOut = quintInOut;
  exports.quintOut = quintOut;
  exports.sineIn = sineIn;
  exports.sineInOut = sineInOut;
  exports.sineOut = sineOut;
  });

  unwrapExports(easing);
  var easing_1 = easing.linear;
  var easing_2 = easing.backIn;
  var easing_3 = easing.backInOut;
  var easing_4 = easing.backOut;
  var easing_5 = easing.bounceIn;
  var easing_6 = easing.bounceInOut;
  var easing_7 = easing.bounceOut;
  var easing_8 = easing.circIn;
  var easing_9 = easing.circInOut;
  var easing_10 = easing.circOut;
  var easing_11 = easing.cubicIn;
  var easing_12 = easing.cubicInOut;
  var easing_13 = easing.cubicOut;
  var easing_14 = easing.elasticIn;
  var easing_15 = easing.elasticInOut;
  var easing_16 = easing.elasticOut;
  var easing_17 = easing.expoIn;
  var easing_18 = easing.expoInOut;
  var easing_19 = easing.expoOut;
  var easing_20 = easing.quadIn;
  var easing_21 = easing.quadInOut;
  var easing_22 = easing.quadOut;
  var easing_23 = easing.quartIn;
  var easing_24 = easing.quartInOut;
  var easing_25 = easing.quartOut;
  var easing_26 = easing.quintIn;
  var easing_27 = easing.quintInOut;
  var easing_28 = easing.quintOut;
  var easing_29 = easing.sineIn;
  var easing_30 = easing.sineInOut;
  var easing_31 = easing.sineOut;

  function fade(node, { delay = 0, duration = 400, easing = easing_1 }) {
      const o = +getComputedStyle(node).opacity;
      return {
          delay,
          duration,
          easing,
          css: t => `opacity: ${t * o}`
      };
  }
  function fly(node, { delay = 0, duration = 400, easing = easing_13, x = 0, y = 0, opacity = 0 }) {
      const style = getComputedStyle(node);
      const target_opacity = +style.opacity;
      const transform = style.transform === 'none' ? '' : style.transform;
      const od = target_opacity * (1 - opacity);
      return {
          delay,
          duration,
          easing,
          css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
      };
  }

  const player = ({
    instrument,
    pattern = []
  }) => () => {
    Tone.context.resume();

    const [note, duration] = pattern;
    instrument.triggerAttackRelease(note, duration);
  };

  const test$1 = player({
    instrument: new Tone.Synth().toMaster(),
    pattern: [`C2`, `8n`]
  });

  const person = player({
    instrument: new Tone.Synth().toMaster(),
    pattern: [`F2`, `16n`]
  });

  const button = player({
    instrument: new Tone.Synth().toMaster(),
    pattern: [`C3`, `8n`]
  });

  const button_press = player({
    instrument: new Tone.Synth().toMaster(),
    pattern: [`A3`, `8n`]
  });

  const card = player({
    instrument: new Tone.MembraneSynth().toMaster(),
    pattern: [`D1`, `16n`]
  });

  const pluck = player({
    instrument: new Tone.PluckSynth().toMaster(),
    pattern: [`C5`, `2n`]
  });

  const filter = new Tone.Filter({
    type: `bandpass`,
    Q: 12
  }).toMaster();

  const wind_noise = new Tone.Noise(`pink`).connect(filter);

  const notes = [`A2`, `B2`, `C2`, `D6`, `E6`, `F6`, `G6`].reverse();
  let last_note;

  position.subscribe(([_, y]) => {
    const yn = Math.floor(y / window.innerHeight * 7);
    if (last_note === notes[yn] || yn < 0 || yn > notes.length - 1) {
      return
    }
    last_note = notes[yn];
    filter.frequency.linearRampToValueAtTime(`${notes[yn]}`, Tone.context.currentTime);
  });

  /* src/ui/app/Intro.svelte generated by Svelte v3.14.1 */
  const file = "src/ui/app/Intro.svelte";

  function create_fragment(ctx) {
  	let div2;
  	let h1;
  	let t1;
  	let h2;
  	let t3;
  	let div0;
  	let button0;
  	let t5;
  	let button1;
  	let t7;
  	let button2;
  	let t9;
  	let div1;
  	let t10;
  	let br;
  	let t11;
  	let a;
  	let div2_outro;
  	let current;
  	let dispose;

  	const block = {
  		c: function create() {
  			div2 = element("div");
  			h1 = element("h1");
  			h1.textContent = "EarthRock";
  			t1 = space();
  			h2 = element("h2");
  			h2.textContent = "The Uncollectable Card Game";
  			t3 = space();
  			div0 = element("div");
  			button0 = element("button");
  			button0.textContent = "WEAVE";
  			t5 = space();
  			button1 = element("button");
  			button1.textContent = "SOCIAL";
  			t7 = space();
  			button2 = element("button");
  			button2.textContent = "CREDITS";
  			t9 = space();
  			div1 = element("div");
  			t10 = text("We don't use cookies or store anything about you server side.\n  ");
  			br = element("br");
  			t11 = space();
  			a = element("a");
  			a.textContent = "[ GPL3 - //github.com/agoblinking/EarthRock]";
  			attr_dev(h1, "class", "title svelte-sh9sbr");
  			add_location(h1, file, 34, 0, 630);
  			attr_dev(h2, "class", "desc svelte-sh9sbr");
  			add_location(h2, file, 35, 0, 663);
  			attr_dev(button0, "class", "svelte-sh9sbr");
  			add_location(button0, file, 48, 4, 952);
  			attr_dev(button1, "class", "svelte-sh9sbr");
  			add_location(button1, file, 53, 4, 1051);
  			attr_dev(button2, "class", "svelte-sh9sbr");
  			add_location(button2, file, 58, 4, 1150);
  			attr_dev(div0, "class", "menu svelte-sh9sbr");
  			add_location(div0, file, 37, 0, 714);
  			add_location(br, file, 66, 2, 1341);
  			attr_dev(a, "class", "link svelte-sh9sbr");
  			attr_dev(a, "target", "_new");
  			attr_dev(a, "href", "https://github.com/AGoblinKing/EarthRock");
  			add_location(a, file, 67, 2, 1349);
  			attr_dev(div1, "class", "notice svelte-sh9sbr");
  			add_location(div1, file, 64, 0, 1254);
  			attr_dev(div2, "class", "intro svelte-sh9sbr");
  			add_location(div2, file, 32, 0, 525);

  			dispose = [
  				listen_dev(button0, "mouseenter", ctx.mouseOver, false, false, false),
  				listen_dev(button0, "click", ctx.develop, false, false, false),
  				listen_dev(button1, "mouseenter", ctx.mouseOver, false, false, false),
  				listen_dev(button1, "click", ctx.discord, false, false, false),
  				listen_dev(button2, "mouseenter", ctx.mouseOver, false, false, false),
  				listen_dev(button2, "click", ctx.credits, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div2, anchor);
  			append_dev(div2, h1);
  			append_dev(div2, t1);
  			append_dev(div2, h2);
  			append_dev(div2, t3);
  			append_dev(div2, div0);
  			append_dev(div0, button0);
  			append_dev(div0, t5);
  			append_dev(div0, button1);
  			append_dev(div0, t7);
  			append_dev(div0, button2);
  			append_dev(div2, t9);
  			append_dev(div2, div1);
  			append_dev(div1, t10);
  			append_dev(div1, br);
  			append_dev(div1, t11);
  			append_dev(div1, a);
  			current = true;
  		},
  		p: noop,
  		i: function intro(local) {
  			if (current) return;
  			if (div2_outro) div2_outro.end(1);
  			current = true;
  		},
  		o: function outro(local) {
  			div2_outro = create_out_transition(div2, fly, {
  				delay: 100,
  				duration: 1000,
  				x: 0,
  				y: 4000,
  				opacity: 0,
  				easing: internal_78
  			});

  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div2);
  			if (detaching && div2_outro) div2_outro.end();
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

  function instance($$self) {
  	const dispatch = target => path.set(target);

  	const mouseOver = () => {
  		button();
  	};

  	const click = () => {
  		button_press();
  	};

  	const discord = () => {
  		window.open(`https://discord.gg/HnvRacKS`, `_blank`);
  		click();
  	};

  	const develop = () => {
  		dispatch(`weave`);
  		click();
  	};

  	const credits = () => {
  		dispatch(`credits`);
  		click();
  	};

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		
  	};

  	return { mouseOver, discord, develop, credits };
  }

  class Intro extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance, create_fragment, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Intro",
  			options,
  			id: create_fragment.name
  		});
  	}
  }

  /* src/ui/app/Tools.svelte generated by Svelte v3.14.1 */
  const file$1 = "src/ui/app/Tools.svelte";

  // (29:4) {#if $path !== false && $path !== ``}
  function create_if_block(ctx) {
  	let div;
  	let dispose;

  	const block = {
  		c: function create() {
  			div = element("div");
  			div.textContent = "X";
  			attr_dev(div, "class", "svelte-f5vnzv");
  			add_location(div, file$1, 29, 8, 492);

  			dispose = [
  				listen_dev(div, "click", ctx.end, false, false, false),
  				listen_dev(div, "mouseenter", button, false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  		},
  		p: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block.name,
  		type: "if",
  		source: "(29:4) {#if $path !== false && $path !== ``}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$1(ctx) {
  	let div1;
  	let t0;
  	let div0;
  	let t1_value = (ctx.audo_playing ? `>` : `!>`) + "";
  	let t1;
  	let dispose;
  	let if_block = ctx.$path !== false && ctx.$path !== `` && create_if_block(ctx);

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			if (if_block) if_block.c();
  			t0 = space();
  			div0 = element("div");
  			t1 = text(t1_value);
  			attr_dev(div0, "class", "svelte-f5vnzv");
  			add_location(div0, file$1, 33, 4, 579);
  			attr_dev(div1, "class", "tools svelte-f5vnzv");
  			add_location(div1, file$1, 26, 0, 417);
  			dispose = listen_dev(div0, "click", ctx.toggle, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			if (if_block) if_block.m(div1, null);
  			append_dev(div1, t0);
  			append_dev(div1, div0);
  			append_dev(div0, t1);
  		},
  		p: function update(changed, ctx) {
  			if (ctx.$path !== false && ctx.$path !== ``) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  				} else {
  					if_block = create_if_block(ctx);
  					if_block.c();
  					if_block.m(div1, t0);
  				}
  			} else if (if_block) {
  				if_block.d(1);
  				if_block = null;
  			}

  			if (changed.audo_playing && t1_value !== (t1_value = (ctx.audo_playing ? `>` : `!>`) + "")) set_data_dev(t1, t1_value);
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div1);
  			if (if_block) if_block.d();
  			dispose();
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
  	let $path;
  	validate_store(path, "path");
  	component_subscribe($$self, path, $$value => $$invalidate("$path", $path = $$value));
  	const audio = new Audio(`/music/earthrock-final-theme.mp3`);
  	audio.loop = true;
  	audio.volume = 0.5;
  	let audo_playing = false;

  	const toggle = () => {
  		if (audo_playing) {
  			audio.pause();
  		} else {
  			audio.play();
  		}

  		$$invalidate("audo_playing", audo_playing = !audo_playing);
  	};

  	const end = () => {
  		path.set(``);
  		button_press();
  	};

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		if ("audo_playing" in $$props) $$invalidate("audo_playing", audo_playing = $$props.audo_playing);
  		if ("$path" in $$props) path.set($path = $$props.$path);
  	};

  	return { audo_playing, toggle, end, $path };
  }

  class Tools extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$1, create_fragment$1, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Tools",
  			options,
  			id: create_fragment$1.name
  		});
  	}
  }

  const SIZE = 16;
  const SPACING = 1;
  const COLUMNS = TILE_COLUMNS.get();
  const COUNT = TILE_COUNT.get();

  const ready = new Promise((resolve) => {
    const tiles = new Image();
    tiles.src = `/sheets/default.png`;

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

    const result = data_canvas.toDataURL(`image/jpeg`);
    if (!random) {
      repo.set(key, result);
    }

    return result
  };

  /* src/ui/image/Tile.svelte generated by Svelte v3.14.1 */
  const file$2 = "src/ui/image/Tile.svelte";

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
  			add_location(img, file$2, 24, 0, 353);
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

  function create_fragment$2(ctx) {
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
  		id: create_fragment$2.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$2($$self, $$props, $$invalidate) {
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

  		init$1(this, options, instance$2, create_fragment$2, safe_not_equal, {
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
  			id: create_fragment$2.name
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

  /* src/ui/Spatial.svelte generated by Svelte v3.14.1 */

  const file$3 = "src/ui/Spatial.svelte";

  function create_fragment$3(ctx) {
  	let div;
  	let current;
  	const default_slot_template = ctx.$$slots.default;
  	const default_slot = create_slot(default_slot_template, ctx, null);

  	const block = {
  		c: function create() {
  			div = element("div");
  			if (default_slot) default_slot.c();
  			attr_dev(div, "class", "spatial svelte-1v8z3iz");
  			attr_dev(div, "style", ctx.style);
  			toggle_class(div, "transition", ctx.transition);
  			add_location(div, file$3, 35, 0, 988);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);

  			if (default_slot) {
  				default_slot.m(div, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (default_slot && default_slot.p && changed.$$scope) {
  				default_slot.p(get_slot_changes(default_slot_template, ctx, changed, null), get_slot_context(default_slot_template, ctx, null));
  			}

  			if (!current || changed.style) {
  				attr_dev(div, "style", ctx.style);
  			}

  			if (changed.transition) {
  				toggle_class(div, "transition", ctx.transition);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (default_slot) default_slot.d(detaching);
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
  	let { position = [0, 0, 0] } = $$props;
  	let { anchor = [50, 50] } = $$props;
  	let { bias = [50, 50] } = $$props;
  	let { area = [1, 1] } = $$props;
  	let { scale = 1 } = $$props;
  	let { rotate = 0 } = $$props;
  	let { zIndex = 0 } = $$props;
  	let { transition = true } = $$props;

  	const writable_props = [
  		"position",
  		"anchor",
  		"bias",
  		"area",
  		"scale",
  		"rotate",
  		"zIndex",
  		"transition"
  	];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Spatial> was created with unknown prop '${key}'`);
  	});

  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$props => {
  		if ("position" in $$props) $$invalidate("position", position = $$props.position);
  		if ("anchor" in $$props) $$invalidate("anchor", anchor = $$props.anchor);
  		if ("bias" in $$props) $$invalidate("bias", bias = $$props.bias);
  		if ("area" in $$props) $$invalidate("area", area = $$props.area);
  		if ("scale" in $$props) $$invalidate("scale", scale = $$props.scale);
  		if ("rotate" in $$props) $$invalidate("rotate", rotate = $$props.rotate);
  		if ("zIndex" in $$props) $$invalidate("zIndex", zIndex = $$props.zIndex);
  		if ("transition" in $$props) $$invalidate("transition", transition = $$props.transition);
  		if ("$$scope" in $$props) $$invalidate("$$scope", $$scope = $$props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			position,
  			anchor,
  			bias,
  			area,
  			scale,
  			rotate,
  			zIndex,
  			transition,
  			offset,
  			tru_scale,
  			tru_position,
  			transform,
  			tru_zIndex,
  			style
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("position" in $$props) $$invalidate("position", position = $$props.position);
  		if ("anchor" in $$props) $$invalidate("anchor", anchor = $$props.anchor);
  		if ("bias" in $$props) $$invalidate("bias", bias = $$props.bias);
  		if ("area" in $$props) $$invalidate("area", area = $$props.area);
  		if ("scale" in $$props) $$invalidate("scale", scale = $$props.scale);
  		if ("rotate" in $$props) $$invalidate("rotate", rotate = $$props.rotate);
  		if ("zIndex" in $$props) $$invalidate("zIndex", zIndex = $$props.zIndex);
  		if ("transition" in $$props) $$invalidate("transition", transition = $$props.transition);
  		if ("offset" in $$props) offset = $$props.offset;
  		if ("tru_scale" in $$props) $$invalidate("tru_scale", tru_scale = $$props.tru_scale);
  		if ("tru_position" in $$props) $$invalidate("tru_position", tru_position = $$props.tru_position);
  		if ("transform" in $$props) $$invalidate("transform", transform = $$props.transform);
  		if ("tru_zIndex" in $$props) $$invalidate("tru_zIndex", tru_zIndex = $$props.tru_zIndex);
  		if ("style" in $$props) $$invalidate("style", style = $$props.style);
  	};

  	let offset;
  	let tru_scale;
  	let tru_position;
  	let transform;
  	let tru_zIndex;
  	let style;

  	$$self.$$.update = (changed = { anchor: 1, bias: 1, area: 1, scale: 1, position: 1, tru_position: 1, rotate: 1, tru_scale: 1, zIndex: 1, tru_zIndex: 1, transform: 1 }) => {
  		if (changed.anchor) {
  			 $$invalidate("anchor", anchor = [
  				anchor[0] <= 50
  				? `left: ${anchor[0]}%;`
  				: `right: ${100 - anchor[0]}%;`,
  				anchor[1] <= 50
  				? `top: ${anchor[1]}%;`
  				: `bottom: ${100 - anchor[1]}%;`
  			].join(` `));
  		}

  		if (changed.bias || changed.area || changed.anchor) {
  			 offset = [
  				bias[0] * 0.01 * area[0] / 2 * (anchor[0] <= 50 ? -1 : 1),
  				bias[1] * 0.01 * area[1] / 2 * (anchor[1] <= 50 ? -1 : 1)
  			];
  		}

  		if (changed.scale) {
  			 $$invalidate("tru_scale", tru_scale = Math.round(100 * scale) / 100);
  		}

  		if (changed.position) {
  			 $$invalidate("tru_position", tru_position = position || [0, 0, 0]);
  		}

  		if (changed.tru_position || changed.rotate || changed.scale || changed.tru_scale) {
  			 $$invalidate("transform", transform = [
  				`transform:`,
  				`translate(${Math.round(tru_position[0])}px, ${Math.round(tru_position[1])}px)`,
  				rotate === 0 ? `` : `rotate(${rotate}deg)`,
  				scale === 1 ? `` : `scale(${tru_scale});`
  			].join(` `));
  		}

  		if (changed.scale || changed.zIndex) {
  			 $$invalidate("tru_zIndex", tru_zIndex = `z-index: ${Math.max(1, Math.round(scale * 100 + zIndex))};`);
  		}

  		if (changed.tru_zIndex || changed.anchor || changed.transform) {
  			 $$invalidate("style", style = [tru_zIndex, anchor, transform].join(` `));
  		}
  	};

  	return {
  		position,
  		anchor,
  		bias,
  		area,
  		scale,
  		rotate,
  		zIndex,
  		transition,
  		style,
  		$$slots,
  		$$scope
  	};
  }

  class Spatial extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init$1(this, options, instance$3, create_fragment$3, safe_not_equal, {
  			position: 0,
  			anchor: 0,
  			bias: 0,
  			area: 0,
  			scale: 0,
  			rotate: 0,
  			zIndex: 0,
  			transition: 0
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Spatial",
  			options,
  			id: create_fragment$3.name
  		});
  	}

  	get position() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set position(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get anchor() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set anchor(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get bias() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set bias(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get area() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set area(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get scale() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set scale(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get rotate() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set rotate(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get zIndex() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set zIndex(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get transition() {
  		throw new Error("<Spatial>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set transition(value) {
  		throw new Error("<Spatial>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/app/Design.svelte generated by Svelte v3.14.1 */
  const file$4 = "src/ui/app/Design.svelte";

  // (23:0) <Spatial      bias={[50, 50]}      anchor={[50, 50]}     area={[-1000, 50]} >
  function create_default_slot(ctx) {
  	let div;
  	let div_outro;
  	let current;

  	const block = {
  		c: function create() {
  			div = element("div");
  			div.textContent = "Still Ruff";
  			attr_dev(div, "class", "design svelte-31mij8");
  			add_location(div, file$4, 27, 4, 480);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			current = true;
  		},
  		p: noop,
  		i: function intro(local) {
  			if (current) return;
  			if (div_outro) div_outro.end(1);
  			current = true;
  		},
  		o: function outro(local) {
  			div_outro = create_out_transition(div, fade, { duration: 100 });
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (detaching && div_outro) div_outro.end();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot.name,
  		type: "slot",
  		source: "(23:0) <Spatial      bias={[50, 50]}      anchor={[50, 50]}     area={[-1000, 50]} >",
  		ctx
  	});

  	return block;
  }

  function create_fragment$4(ctx) {
  	let current;

  	const spatial = new Spatial({
  			props: {
  				bias: [50, 50],
  				anchor: [50, 50],
  				area: [-1000, 50],
  				$$slots: { default: [create_default_slot] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(spatial.$$.fragment);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			mount_component(spatial, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const spatial_changes = {};

  			if (changed.$$scope) {
  				spatial_changes.$$scope = { changed, ctx };
  			}

  			spatial.$set(spatial_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(spatial.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(spatial.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(spatial, detaching);
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

  class Design extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, null, create_fragment$4, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Design",
  			options,
  			id: create_fragment$4.name
  		});
  	}
  }

  /* src/ui/weave/MainScreen.svelte generated by Svelte v3.14.1 */
  const file$5 = "src/ui/weave/MainScreen.svelte";

  function create_fragment$5(ctx) {
  	let div;
  	let insert_action;
  	let dispose;

  	const block = {
  		c: function create() {
  			div = element("div");
  			attr_dev(div, "class", "main svelte-14ndyt8");
  			toggle_class(div, "full", ctx.full);
  			add_location(div, file$5, 23, 0, 375);
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
  		id: create_fragment$5.name,
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
  		init$1(this, options, instance$4, create_fragment$5, safe_not_equal, { full: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "MainScreen",
  			options,
  			id: create_fragment$5.name
  		});
  	}

  	get full() {
  		throw new Error("<MainScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set full(value) {
  		throw new Error("<MainScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
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

  /* src/ui/weave/Controls.svelte generated by Svelte v3.14.1 */
  const file$6 = "src/ui/weave/Controls.svelte";

  // (59:2) {#if $name !== Wheel.SYSTEM}
  function create_if_block$1(ctx) {
  	let div;
  	let dispose;

  	function select_block_type(changed, ctx) {
  		if (ctx.runs) return create_if_block_1;
  		return create_else_block;
  	}

  	let current_block_type = select_block_type(null, ctx);
  	let if_block = current_block_type(ctx);

  	const block = {
  		c: function create() {
  			div = element("div");
  			if_block.c();
  			attr_dev(div, "class", "play svelte-oye7pq");
  			toggle_class(div, "runs", ctx.runs);
  			add_location(div, file$6, 59, 2, 947);
  			dispose = listen_dev(div, "click", ctx.toggle, false, false, false);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			if_block.m(div, null);
  		},
  		p: function update(changed, ctx) {
  			if (current_block_type !== (current_block_type = select_block_type(changed, ctx))) {
  				if_block.d(1);
  				if_block = current_block_type(ctx);

  				if (if_block) {
  					if_block.c();
  					if_block.m(div, null);
  				}
  			}

  			if (changed.runs) {
  				toggle_class(div, "runs", ctx.runs);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if_block.d();
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$1.name,
  		type: "if",
  		source: "(59:2) {#if $name !== Wheel.SYSTEM}",
  		ctx
  	});

  	return block;
  }

  // (63:4) {:else}
  function create_else_block(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("|>");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block.name,
  		type: "else",
  		source: "(63:4) {:else}",
  		ctx
  	});

  	return block;
  }

  // (61:4) {#if runs}
  function create_if_block_1(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("||");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1.name,
  		type: "if",
  		source: "(61:4) {#if runs}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$6(ctx) {
  	let div0;
  	let t0;
  	let div2;
  	let div1;
  	let t2;
  	let dispose;
  	let if_block = ctx.$name !== Wheel.SYSTEM && create_if_block$1(ctx);

  	const block = {
  		c: function create() {
  			div0 = element("div");
  			t0 = space();
  			div2 = element("div");
  			div1 = element("div");
  			div1.textContent = "\\/";
  			t2 = space();
  			if (if_block) if_block.c();
  			attr_dev(div0, "class", "bar svelte-oye7pq");
  			add_location(div0, file$6, 48, 0, 800);
  			attr_dev(div1, "class", "save svelte-oye7pq");
  			add_location(div1, file$6, 52, 2, 851);
  			attr_dev(div2, "class", "controls svelte-oye7pq");
  			add_location(div2, file$6, 51, 0, 826);
  			dispose = listen_dev(div1, "click", ctx.save, false, false, false);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div0, anchor);
  			insert_dev(target, t0, anchor);
  			insert_dev(target, div2, anchor);
  			append_dev(div2, div1);
  			append_dev(div2, t2);
  			if (if_block) if_block.m(div2, null);
  		},
  		p: function update(changed, ctx) {
  			if (ctx.$name !== Wheel.SYSTEM) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  				} else {
  					if_block = create_if_block$1(ctx);
  					if_block.c();
  					if_block.m(div2, null);
  				}
  			} else if (if_block) {
  				if_block.d(1);
  				if_block = null;
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div0);
  			if (detaching) detach_dev(t0);
  			if (detaching) detach_dev(div2);
  			if (if_block) if_block.d();
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

  function instance$5($$self, $$props, $$invalidate) {
  	let $running,
  		$$unsubscribe_running = noop,
  		$$subscribe_running = () => ($$unsubscribe_running(), $$unsubscribe_running = subscribe(running, $$value => $$invalidate("$running", $running = $$value)), running);

  	let $name,
  		$$unsubscribe_name = noop,
  		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

  	let $down;
  	validate_store(down, "down");
  	component_subscribe($$self, down, $$value => $$invalidate("$down", $down = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_running());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	let { weave } = $$props;

  	const toggle = () => {
  		if (runs) {
  			Wheel.stop($name);
  		} else {
  			Wheel.start($name);
  		}

  		$$invalidate("runs", runs = !runs);
  	};

  	const save = async () => {
  		const obj = {
  			"0th": {
  				[piexif.ImageIFD.Make]: JSON.stringify(weave),
  				[piexif.ImageIFD.Software]: `isekai`
  			},
  			Exif: {},
  			GPS: {}
  		};

  		const t = await Tile({
  			width: 2,
  			height: 2,
  			data: `${tile(`/${$name}`)} `.repeat(4)
  		});

  		FileSaver_min.saveAs(piexif.insert(piexif.dump(obj), t), `${$name}.weave.jpg`);
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
  			$down
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("running" in $$props) $$subscribe_running($$invalidate("running", running = $$props.running));
  		if ("runs" in $$props) $$invalidate("runs", runs = $$props.runs);
  		if ("$running" in $$props) running.set($running = $$props.$running);
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$down" in $$props) down.set($down = $$props.$down);
  	};

  	let name;
  	let running;
  	let runs;

  	$$self.$$.update = (changed = { weave: 1, $running: 1, $down: 1 }) => {
  		if (changed.weave) {
  			 $$subscribe_name($$invalidate("name", name = weave.name));
  		}

  		if (changed.$running || changed.weave) {
  			 $$invalidate("runs", runs = $running[weave.name.get()]);
  		}

  		if (changed.$down) {
  			 {
  				if ($down === ` `) toggle();
  			}
  		}
  	};

  	 $$subscribe_running($$invalidate("running", running = Wheel.running));

  	return {
  		weave,
  		toggle,
  		save,
  		name,
  		running,
  		runs,
  		$name
  	};
  }

  class Controls extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$5, create_fragment$6, safe_not_equal, { weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Controls",
  			options,
  			id: create_fragment$6.name
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

  const subscriber_queue = [];
  /**
   * Create a `Writable` store that allows both updating and reading by subscription.
   * @param {*=}value initial value
   * @param {StartStopNotifier=}start start and stop notifications for subscriptions
   */
  function writable$1(value, start = internal_94) {
      let stop;
      const subscribers = [];
      function set(new_value) {
          if (internal_106(value, new_value)) {
              value = new_value;
              if (stop) { // store is ready
                  const run_queue = !subscriber_queue.length;
                  for (let i = 0; i < subscribers.length; i += 1) {
                      const s = subscribers[i];
                      s[1]();
                      subscriber_queue.push(s, value);
                  }
                  if (run_queue) {
                      for (let i = 0; i < subscriber_queue.length; i += 2) {
                          subscriber_queue[i][0](subscriber_queue[i + 1]);
                      }
                      subscriber_queue.length = 0;
                  }
              }
          }
      }
      function update(fn) {
          set(fn(value));
      }
      function subscribe(run, invalidate = internal_94) {
          const subscriber = [run, invalidate];
          subscribers.push(subscriber);
          if (subscribers.length === 1) {
              stop = start(set) || internal_94;
          }
          run(value);
          return () => {
              const index = subscribers.indexOf(subscriber);
              if (index !== -1) {
                  subscribers.splice(index, 1);
              }
              if (subscribers.length === 0) {
                  stop();
                  stop = null;
              }
          };
      }
      return { set, update, subscribe };
  }

  // TODO: This needs refactored

  // editor specific
  // like a real time query
  const first = writable$1(false);
  const second = writable$1(false);
  const match = writable$1(false);
  const del$1 = writable$1(false);

  second.subscribe((value) => {
    const $first = internal_73(first);
    const $second = internal_73(second);

    if (!$first || !$second) return

    match.set([
      $first, $second
    ]);
  });

  // clean up
  mouse_up.subscribe(() => {
    requestAnimationFrame(() => {
      const $first = internal_73(first);
      const $second = internal_73(second);

      if ($first && !$second) del$1.set($first);
      if ($first) first.set(false);
      if ($second) second.set(false);
    });
  });

  /* src/ui/weave/Threads.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1 } = globals;
  const file$7 = "src/ui/weave/Threads.svelte";

  function get_each_context(ctx, list, i) {
  	const child_ctx = Object_1.create(ctx);
  	child_ctx.x = list[i][0];
  	child_ctx.y = list[i][1];
  	child_ctx.x_id = list[i][2];
  	child_ctx.y_id = list[i][3];
  	return child_ctx;
  }

  // (114:2) {#if $first}
  function create_if_block_1$1(ctx) {
  	let line;
  	let line_stroke_value;
  	let line_x__value;
  	let line_y__value;
  	let line_x__value_1;
  	let line_y__value_1;

  	const block = {
  		c: function create() {
  			line = svg_element("line");
  			attr_dev(line, "stroke", line_stroke_value = ctx.get_color(ctx.$first, ctx.$position));
  			attr_dev(line, "x1", line_x__value = ctx.first_rec.x + ctx.first_rec.width / 2);
  			attr_dev(line, "y1", line_y__value = ctx.first_rec.y + ctx.first_rec.height / 2);
  			attr_dev(line, "x2", line_x__value_1 = ctx.$position[0]);
  			attr_dev(line, "y2", line_y__value_1 = ctx.$position[1]);
  			attr_dev(line, "class", "line svelte-1o54c58");
  			add_location(line, file$7, 114, 4, 3008);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, line, anchor);
  		},
  		p: function update(changed, ctx) {
  			if ((changed.$first || changed.$position) && line_stroke_value !== (line_stroke_value = ctx.get_color(ctx.$first, ctx.$position))) {
  				attr_dev(line, "stroke", line_stroke_value);
  			}

  			if (changed.first_rec && line_x__value !== (line_x__value = ctx.first_rec.x + ctx.first_rec.width / 2)) {
  				attr_dev(line, "x1", line_x__value);
  			}

  			if (changed.first_rec && line_y__value !== (line_y__value = ctx.first_rec.y + ctx.first_rec.height / 2)) {
  				attr_dev(line, "y1", line_y__value);
  			}

  			if (changed.$position && line_x__value_1 !== (line_x__value_1 = ctx.$position[0])) {
  				attr_dev(line, "x2", line_x__value_1);
  			}

  			if (changed.$position && line_y__value_1 !== (line_y__value_1 = ctx.$position[1])) {
  				attr_dev(line, "y2", line_y__value_1);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(line);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1$1.name,
  		type: "if",
  		source: "(114:2) {#if $first}",
  		ctx
  	});

  	return block;
  }

  // (136:6) {#if $recent.has(`${x_id}-${y_id}`)}
  function create_if_block$2(ctx) {
  	let line;
  	let line_stroke_value;
  	let line_x__value;
  	let line_y__value;
  	let line_x__value_1;
  	let line_y__value_1;

  	const block = {
  		c: function create() {
  			line = svg_element("line");
  			attr_dev(line, "stroke", line_stroke_value = "url(#" + (ctx.x.x > ctx.y.x ? "linear" : "linear-other") + ")");
  			attr_dev(line, "x1", line_x__value = ctx.x.x + ctx.x.width / 2);
  			attr_dev(line, "y1", line_y__value = ctx.x.y + ctx.x.height / 2);
  			attr_dev(line, "x2", line_x__value_1 = ctx.y.x + ctx.y.width / 2);
  			attr_dev(line, "y2", line_y__value_1 = ctx.y.y + ctx.y.height / 2);
  			attr_dev(line, "class", "active svelte-1o54c58");
  			add_location(line, file$7, 136, 6, 3599);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, line, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.rects && line_stroke_value !== (line_stroke_value = "url(#" + (ctx.x.x > ctx.y.x ? "linear" : "linear-other") + ")")) {
  				attr_dev(line, "stroke", line_stroke_value);
  			}

  			if (changed.rects && line_x__value !== (line_x__value = ctx.x.x + ctx.x.width / 2)) {
  				attr_dev(line, "x1", line_x__value);
  			}

  			if (changed.rects && line_y__value !== (line_y__value = ctx.x.y + ctx.x.height / 2)) {
  				attr_dev(line, "y1", line_y__value);
  			}

  			if (changed.rects && line_x__value_1 !== (line_x__value_1 = ctx.y.x + ctx.y.width / 2)) {
  				attr_dev(line, "x2", line_x__value_1);
  			}

  			if (changed.rects && line_y__value_1 !== (line_y__value_1 = ctx.y.y + ctx.y.height / 2)) {
  				attr_dev(line, "y2", line_y__value_1);
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(line);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$2.name,
  		type: "if",
  		source: "(136:6) {#if $recent.has(`${x_id}-${y_id}`)}",
  		ctx
  	});

  	return block;
  }

  // (126:2) {#each rects as [x, y, x_id, y_id]}
  function create_each_block(ctx) {
  	let line;
  	let line_stroke_value;
  	let line_x__value;
  	let line_y__value;
  	let line_x__value_1;
  	let line_y__value_1;
  	let show_if = ctx.$recent.has(`${ctx.x_id}-${ctx.y_id}`);
  	let if_block_anchor;
  	let if_block = show_if && create_if_block$2(ctx);

  	const block = {
  		c: function create() {
  			line = svg_element("line");
  			if (if_block) if_block.c();
  			if_block_anchor = empty();
  			attr_dev(line, "stroke", line_stroke_value = "url(#" + (ctx.x.x > ctx.y.x ? "linear-dark" : "linear-other-dark") + ")");
  			attr_dev(line, "x1", line_x__value = ctx.x.x + ctx.x.width / 2);
  			attr_dev(line, "y1", line_y__value = ctx.x.y + ctx.x.height / 2);
  			attr_dev(line, "x2", line_x__value_1 = ctx.y.x + ctx.y.width / 2);
  			attr_dev(line, "y2", line_y__value_1 = ctx.y.y + ctx.y.height / 2);
  			attr_dev(line, "class", "line svelte-1o54c58");
  			add_location(line, file$7, 126, 6, 3295);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, line, anchor);
  			if (if_block) if_block.m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.rects && line_stroke_value !== (line_stroke_value = "url(#" + (ctx.x.x > ctx.y.x ? "linear-dark" : "linear-other-dark") + ")")) {
  				attr_dev(line, "stroke", line_stroke_value);
  			}

  			if (changed.rects && line_x__value !== (line_x__value = ctx.x.x + ctx.x.width / 2)) {
  				attr_dev(line, "x1", line_x__value);
  			}

  			if (changed.rects && line_y__value !== (line_y__value = ctx.x.y + ctx.x.height / 2)) {
  				attr_dev(line, "y1", line_y__value);
  			}

  			if (changed.rects && line_x__value_1 !== (line_x__value_1 = ctx.y.x + ctx.y.width / 2)) {
  				attr_dev(line, "x2", line_x__value_1);
  			}

  			if (changed.rects && line_y__value_1 !== (line_y__value_1 = ctx.y.y + ctx.y.height / 2)) {
  				attr_dev(line, "y2", line_y__value_1);
  			}

  			if (changed.$recent || changed.rects) show_if = ctx.$recent.has(`${ctx.x_id}-${ctx.y_id}`);

  			if (show_if) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  				} else {
  					if_block = create_if_block$2(ctx);
  					if_block.c();
  					if_block.m(if_block_anchor.parentNode, if_block_anchor);
  				}
  			} else if (if_block) {
  				if_block.d(1);
  				if_block = null;
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(line);
  			if (if_block) if_block.d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block.name,
  		type: "each",
  		source: "(126:2) {#each rects as [x, y, x_id, y_id]}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$7(ctx) {
  	let svg;
  	let defs;
  	let linearGradient0;
  	let stop0;
  	let stop1;
  	let linearGradient1;
  	let stop2;
  	let stop3;
  	let linearGradient2;
  	let stop4;
  	let stop5;
  	let linearGradient3;
  	let stop6;
  	let stop7;
  	let if_block_anchor;
  	let svg_width_value;
  	let svg_height_value;
  	let if_block = ctx.$first && create_if_block_1$1(ctx);
  	let each_value = ctx.rects;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
  	}

  	const block = {
  		c: function create() {
  			svg = svg_element("svg");
  			defs = svg_element("defs");
  			linearGradient0 = svg_element("linearGradient");
  			stop0 = svg_element("stop");
  			stop1 = svg_element("stop");
  			linearGradient1 = svg_element("linearGradient");
  			stop2 = svg_element("stop");
  			stop3 = svg_element("stop");
  			linearGradient2 = svg_element("linearGradient");
  			stop4 = svg_element("stop");
  			stop5 = svg_element("stop");
  			linearGradient3 = svg_element("linearGradient");
  			stop6 = svg_element("stop");
  			stop7 = svg_element("stop");
  			if (if_block) if_block.c();
  			if_block_anchor = empty();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(stop0, "offset", "30%");
  			attr_dev(stop0, "stop-color", "#F00");
  			add_location(stop0, file$7, 94, 8, 2264);
  			attr_dev(stop1, "offset", "70%");
  			attr_dev(stop1, "stop-color", "#00F");
  			add_location(stop1, file$7, 95, 8, 2311);
  			attr_dev(linearGradient0, "id", "linear");
  			attr_dev(linearGradient0, "x1", "0%");
  			attr_dev(linearGradient0, "y1", "0%");
  			attr_dev(linearGradient0, "x2", "100%");
  			attr_dev(linearGradient0, "y2", "0%");
  			add_location(linearGradient0, file$7, 93, 6, 2193);
  			attr_dev(stop2, "offset", "30%");
  			attr_dev(stop2, "stop-color", "#00F");
  			add_location(stop2, file$7, 98, 10, 2459);
  			attr_dev(stop3, "offset", "70%");
  			attr_dev(stop3, "stop-color", "#F00");
  			add_location(stop3, file$7, 99, 10, 2508);
  			attr_dev(linearGradient1, "id", "linear-other");
  			attr_dev(linearGradient1, "x1", "0%");
  			attr_dev(linearGradient1, "y1", "0%");
  			attr_dev(linearGradient1, "x2", "100%");
  			attr_dev(linearGradient1, "y2", "0%");
  			add_location(linearGradient1, file$7, 97, 6, 2380);
  			attr_dev(stop4, "offset", "5%");
  			attr_dev(stop4, "stop-color", "#F00");
  			add_location(stop4, file$7, 102, 8, 2657);
  			attr_dev(stop5, "offset", "95%");
  			attr_dev(stop5, "stop-color", "#00F");
  			add_location(stop5, file$7, 104, 8, 2706);
  			attr_dev(linearGradient2, "id", "linear-dark");
  			attr_dev(linearGradient2, "x1", "0%");
  			attr_dev(linearGradient2, "y1", "0%");
  			attr_dev(linearGradient2, "x2", "100%");
  			attr_dev(linearGradient2, "y2", "0%");
  			add_location(linearGradient2, file$7, 101, 8, 2581);
  			attr_dev(stop6, "offset", "5%");
  			attr_dev(stop6, "stop-color", "#00F");
  			add_location(stop6, file$7, 107, 10, 2859);
  			attr_dev(stop7, "offset", "95%");
  			attr_dev(stop7, "stop-color", "#F00");
  			add_location(stop7, file$7, 109, 10, 2910);
  			attr_dev(linearGradient3, "id", "linear-other-dark");
  			attr_dev(linearGradient3, "x1", "0%");
  			attr_dev(linearGradient3, "y1", "0%");
  			attr_dev(linearGradient3, "x2", "100%");
  			attr_dev(linearGradient3, "y2", "0%");
  			add_location(linearGradient3, file$7, 106, 6, 2775);
  			add_location(defs, file$7, 92, 4, 2180);
  			attr_dev(svg, "width", svg_width_value = ctx.$size[0]);
  			attr_dev(svg, "height", svg_height_value = ctx.$size[1]);
  			attr_dev(svg, "class", "threads svelte-1o54c58");
  			add_location(svg, file$7, 91, 0, 2119);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, svg, anchor);
  			append_dev(svg, defs);
  			append_dev(defs, linearGradient0);
  			append_dev(linearGradient0, stop0);
  			append_dev(linearGradient0, stop1);
  			append_dev(defs, linearGradient1);
  			append_dev(linearGradient1, stop2);
  			append_dev(linearGradient1, stop3);
  			append_dev(defs, linearGradient2);
  			append_dev(linearGradient2, stop4);
  			append_dev(linearGradient2, stop5);
  			append_dev(defs, linearGradient3);
  			append_dev(linearGradient3, stop6);
  			append_dev(linearGradient3, stop7);
  			if (if_block) if_block.m(svg, null);
  			append_dev(svg, if_block_anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(svg, null);
  			}
  		},
  		p: function update(changed, ctx) {
  			if (ctx.$first) {
  				if (if_block) {
  					if_block.p(changed, ctx);
  				} else {
  					if_block = create_if_block_1$1(ctx);
  					if_block.c();
  					if_block.m(svg, if_block_anchor);
  				}
  			} else if (if_block) {
  				if_block.d(1);
  				if_block = null;
  			}

  			if (changed.$recent || changed.rects) {
  				each_value = ctx.rects;
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  					} else {
  						each_blocks[i] = create_each_block(child_ctx);
  						each_blocks[i].c();
  						each_blocks[i].m(svg, null);
  					}
  				}

  				for (; i < each_blocks.length; i += 1) {
  					each_blocks[i].d(1);
  				}

  				each_blocks.length = each_value.length;
  			}

  			if (changed.$size && svg_width_value !== (svg_width_value = ctx.$size[0])) {
  				attr_dev(svg, "width", svg_width_value);
  			}

  			if (changed.$size && svg_height_value !== (svg_height_value = ctx.$size[1])) {
  				attr_dev(svg, "height", svg_height_value);
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(svg);
  			if (if_block) if_block.d();
  			destroy_each(each_blocks, detaching);
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

  function instance$6($$self, $$props, $$invalidate) {
  	let $position;
  	let $frame;

  	let $threads,
  		$$unsubscribe_threads = noop,
  		$$subscribe_threads = () => ($$unsubscribe_threads(), $$unsubscribe_threads = subscribe(threads, $$value => $$invalidate("$threads", $threads = $$value)), threads);

  	let $first;
  	let $size;
  	let $recent;
  	validate_store(position, "position");
  	component_subscribe($$self, position, $$value => $$invalidate("$position", $position = $$value));
  	validate_store(frame, "frame");
  	component_subscribe($$self, frame, $$value => $$invalidate("$frame", $frame = $$value));
  	validate_store(first, "first");
  	component_subscribe($$self, first, $$value => $$invalidate("$first", $first = $$value));
  	validate_store(size, "size");
  	component_subscribe($$self, size, $$value => $$invalidate("$size", $size = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_threads());
  	let { weave } = $$props;
  	const val = new Set();

  	const recent = read(val, set => {
  		let t = 0;
  		const deletes = {};

  		tick.subscribe(() => {
  			t += 100;
  			const dels = Object.entries(deletes);
  			if (dels.length === 0) return;
  			const r = val;
  			let change = false;

  			dels.forEach(([key, del_t]) => {
  				if (del_t < t) {
  					r.delete(key);
  					delete deletes[key];
  					change = true;
  				}
  			});

  			if (change) set(r);
  		});

  		Wheel.feed.subscribe(({ writer, reader }) => {
  			if (!writer || !reader) return;
  			const [weave_write, ...local_write] = writer.split(`/`);
  			const [weave_read, ...local_read] = reader.split(`/`);
  			const weave_id = weave.name.get();
  			if (weave_id !== weave_write && weave_id !== weave_read) return;
  			const id = `${local_read.join(`/`)}-${local_write.join(`/`)}`;
  			const s_recent = val;

  			if (!s_recent.has(id)) {
  				s_recent.add(id);
  				set(s_recent);
  			}

  			deletes[id] = t + 1000;
  		});
  	});

  	validate_store(recent, "recent");
  	component_subscribe($$self, recent, value => $$invalidate("$recent", $recent = value));
  	const get_pos = id => document.getElementById(id).getBoundingClientRect();

  	const get_color = id => {
  		const loc = document.getElementById(id).getBoundingClientRect();

  		return id.split(`|`).length === 1
  		? `gray`
  		: id.slice(-1) !== `e`
  			? `url(#${loc.x < $position[0] ? `linear-other` : `linear`})`
  			: `url(#${loc.x < $position[0] ? `linear` : `linear-other`})`;
  	};

  	const writable_props = ["weave"];

  	Object_1.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Threads> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  	};

  	$$self.$capture_state = () => {
  		return {
  			weave,
  			$position,
  			threads,
  			$frame,
  			rects,
  			$threads,
  			first_rec,
  			$first,
  			$size,
  			$recent
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("$position" in $$props) position.set($position = $$props.$position);
  		if ("threads" in $$props) $$subscribe_threads($$invalidate("threads", threads = $$props.threads));
  		if ("$frame" in $$props) frame.set($frame = $$props.$frame);
  		if ("rects" in $$props) $$invalidate("rects", rects = $$props.rects);
  		if ("$threads" in $$props) threads.set($threads = $$props.$threads);
  		if ("first_rec" in $$props) $$invalidate("first_rec", first_rec = $$props.first_rec);
  		if ("$first" in $$props) first.set($first = $$props.$first);
  		if ("$size" in $$props) size.set($size = $$props.$size);
  		if ("$recent" in $$props) recent.set($recent = $$props.$recent);
  	};

  	let threads;
  	let rects;
  	let first_rec;

  	$$self.$$.update = (changed = { $frame: 1, weave: 1, $threads: 1, $first: 1 }) => {
  		if (changed.$frame || changed.weave) {
  			 $$subscribe_threads($$invalidate("threads", threads = $frame ? weave.threads : weave.threads));
  		}

  		if (changed.$threads) {
  			 $$invalidate("rects", rects = Object.entries($threads).filter(([x, y]) => document.getElementById(`${x}|read`) && document.getElementById(`${y}|write`)).map(([x, y]) => [
  				document.getElementById(`${x}|read`).getBoundingClientRect(),
  				document.getElementById(`${y}|write`).getBoundingClientRect(),
  				x,
  				y
  			]));
  		}

  		if (changed.$first) {
  			 $$invalidate("first_rec", first_rec = $first ? get_pos($first) : [0, 0]);
  		}
  	};

  	return {
  		weave,
  		recent,
  		get_color,
  		$position,
  		threads,
  		rects,
  		first_rec,
  		$first,
  		$size,
  		$recent
  	};
  }

  class Threads extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$6, create_fragment$7, safe_not_equal, { weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Threads",
  			options,
  			id: create_fragment$7.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Threads> was created without expected prop 'weave'");
  		}
  	}

  	get weave() {
  		throw new Error("<Threads>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Threads>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/Postage.svelte generated by Svelte v3.14.1 */
  const file$8 = "src/ui/weave/Postage.svelte";

  function create_fragment$8(ctx) {
  	let div;
  	let current;
  	let dispose;

  	const tile = new Tile_1({
  			props: { width: 1, height: 1, text: ctx.address },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div = element("div");
  			create_component(tile.$$.fragment);
  			attr_dev(div, "class", "postage no-drag svelte-dtt18w");
  			toggle_class(div, "active", ctx.active);
  			toggle_class(div, "running", ctx.running);
  			add_location(div, file$8, 25, 0, 501);
  			dispose = listen_dev(div, "click", ctx.punch_it, false, false, false);
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

  			if (changed.active) {
  				toggle_class(div, "active", ctx.active);
  			}

  			if (changed.running) {
  				toggle_class(div, "running", ctx.running);
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
  			dispose();
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

  function instance$7($$self, $$props, $$invalidate) {
  	let $runnings,
  		$$unsubscribe_runnings = noop,
  		$$subscribe_runnings = () => ($$unsubscribe_runnings(), $$unsubscribe_runnings = subscribe(runnings, $$value => $$invalidate("$runnings", $runnings = $$value)), runnings);

  	let $woven;
  	let $path;
  	validate_store(woven, "woven");
  	component_subscribe($$self, woven, $$value => $$invalidate("$woven", $woven = $$value));
  	validate_store(path, "path");
  	component_subscribe($$self, path, $$value => $$invalidate("$path", $path = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_runnings());
  	let { address = `` } = $$props;
  	let { nopunch = false } = $$props;

  	const punch_it = e => {
  		e.stopPropagation();
  		e.preventDefault();
  		if (nopunch) return;
  		if ($path[1] === weave) return;
  		path.set(`weave${address}`);
  		return true;
  	};

  	const writable_props = ["address", "nopunch"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Postage> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  		if ("nopunch" in $$props) $$invalidate("nopunch", nopunch = $$props.nopunch);
  	};

  	$$self.$capture_state = () => {
  		return {
  			address,
  			nopunch,
  			runnings,
  			weave,
  			running,
  			$runnings,
  			active,
  			$woven,
  			$path
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  		if ("nopunch" in $$props) $$invalidate("nopunch", nopunch = $$props.nopunch);
  		if ("runnings" in $$props) $$subscribe_runnings($$invalidate("runnings", runnings = $$props.runnings));
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("running" in $$props) $$invalidate("running", running = $$props.running);
  		if ("$runnings" in $$props) runnings.set($runnings = $$props.$runnings);
  		if ("active" in $$props) $$invalidate("active", active = $$props.active);
  		if ("$woven" in $$props) woven.set($woven = $$props.$woven);
  		if ("$path" in $$props) path.set($path = $$props.$path);
  	};

  	let runnings;
  	let weave;
  	let running;
  	let active;

  	$$self.$$.update = (changed = { address: 1, $runnings: 1, weave: 1, $woven: 1 }) => {
  		if (changed.address) {
  			 $$invalidate("weave", weave = address.split(`/`)[1]);
  		}

  		if (changed.$runnings || changed.weave) {
  			 $$invalidate("running", running = $runnings[weave] === true);
  		}

  		if (changed.$woven || changed.weave) {
  			 $$invalidate("active", active = $woven.name.get() === weave);
  		}
  	};

  	 $$subscribe_runnings($$invalidate("runnings", runnings = Wheel.running));

  	return {
  		address,
  		nopunch,
  		punch_it,
  		runnings,
  		running,
  		active
  	};
  }

  class Postage extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$7, create_fragment$8, safe_not_equal, { address: 0, nopunch: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Postage",
  			options,
  			id: create_fragment$8.name
  		});
  	}

  	get address() {
  		throw new Error("<Postage>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set address(value) {
  		throw new Error("<Postage>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get nopunch() {
  		throw new Error("<Postage>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set nopunch(value) {
  		throw new Error("<Postage>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var color$1 = (node, txt_init) => {
    const handler = {
      update: (txt) => {
        const col = Color(color(JSON.stringify(txt)));

        node.style.backgroundColor = col.blend(Color(`#111`), 0.7).toCSS();
      }
    };

    handler.update(txt_init);
    return handler
  };

  var physics = (node, id) => {
    const update = () =>
      bodies.update(($b) => ({
        ...$b,
        [id]: [
          node.offsetWidth,
          node.offsetHeight
        ]
      }));

    update();

    const cancel = tick.listen(() => {
      const [w, h] = bodies.get()[id];

      if (
        w === node.offsetWidth &&
        h === node.offsetHeight
      ) {
        return
      }

      update();
    });

    return {
      destroy: () => {
        cancel();

        bodies.update(($b) => {
          delete $b[id];

          return $b
        });
      }
    }
  };

  /* src/ui/weave/Knot.svelte generated by Svelte v3.14.1 */
  const file$9 = "src/ui/weave/Knot.svelte";

  // (84:0) <Spatial   anchor = {[50, 50]}   position = {tru_position}   transition = {!dragging}   scale = {tru_scale}   {zIndex} >
  function create_default_slot$1(ctx) {
  	let div1;
  	let div0;
  	let physics_action;
  	let current;
  	let dispose;
  	const default_slot_template = ctx.$$slots.default;
  	const default_slot = create_slot(default_slot_template, ctx, null);

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			div0 = element("div");
  			if (default_slot) default_slot.c();
  			attr_dev(div0, "class", "knot svelte-101hgun");
  			add_location(div0, file$9, 95, 4, 1601);
  			attr_dev(div1, "class", "adjust");
  			add_location(div1, file$9, 90, 2, 1484);

  			dispose = [
  				listen_dev(div0, "mousedown", ctx.drag, false, false, false),
  				listen_dev(div1, "mouseover", ctx.mouseover_handler, false, false, false),
  				listen_dev(div1, "mouseout", ctx.mouseout_handler, false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			append_dev(div1, div0);

  			if (default_slot) {
  				default_slot.m(div0, null);
  			}

  			physics_action = physics.call(null, div0, ctx.$id) || ({});
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (default_slot && default_slot.p && changed.$$scope) {
  				default_slot.p(get_slot_changes(default_slot_template, ctx, changed, null), get_slot_context(default_slot_template, ctx, null));
  			}

  			if (is_function(physics_action.update) && changed.$id) physics_action.update.call(null, ctx.$id);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div1);
  			if (default_slot) default_slot.d(detaching);
  			if (physics_action && is_function(physics_action.destroy)) physics_action.destroy();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot$1.name,
  		type: "slot",
  		source: "(84:0) <Spatial   anchor = {[50, 50]}   position = {tru_position}   transition = {!dragging}   scale = {tru_scale}   {zIndex} >",
  		ctx
  	});

  	return block;
  }

  function create_fragment$9(ctx) {
  	let current;

  	const spatial = new Spatial({
  			props: {
  				anchor: [50, 50],
  				position: ctx.tru_position,
  				transition: !ctx.dragging,
  				scale: ctx.tru_scale,
  				zIndex: ctx.zIndex,
  				$$slots: { default: [create_default_slot$1] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(spatial.$$.fragment);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			mount_component(spatial, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const spatial_changes = {};
  			if (changed.tru_position) spatial_changes.position = ctx.tru_position;
  			if (changed.dragging) spatial_changes.transition = !ctx.dragging;
  			if (changed.tru_scale) spatial_changes.scale = ctx.tru_scale;
  			if (changed.zIndex) spatial_changes.zIndex = ctx.zIndex;

  			if (changed.$$scope || changed.$id) {
  				spatial_changes.$$scope = { changed, ctx };
  			}

  			spatial.$set(spatial_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(spatial.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(spatial.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(spatial, detaching);
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

  function instance$8($$self, $$props, $$invalidate) {
  	let $positions;
  	let $Mouse;
  	let $scroll;
  	let $zoom;

  	let $id,
  		$$unsubscribe_id = noop,
  		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

  	validate_store(positions, "positions");
  	component_subscribe($$self, positions, $$value => $$invalidate("$positions", $positions = $$value));
  	validate_store(position, "Mouse");
  	component_subscribe($$self, position, $$value => $$invalidate("$Mouse", $Mouse = $$value));
  	validate_store(scroll$1, "scroll");
  	component_subscribe($$self, scroll$1, $$value => $$invalidate("$scroll", $scroll = $$value));
  	validate_store(zoom, "zoom");
  	component_subscribe($$self, zoom, $$value => $$invalidate("$zoom", $zoom = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
  	let { position: position$1 = [0, 0, 0] } = $$props;
  	let { knot } = $$props;
  	let dragging = false;
  	let zIndex = 7;
  	let tru_position;

  	const update = () => {
  		set_store_value(positions, $positions[knot.id.get()] = position$1, $positions);
  		positions.set($positions);
  	};

  	update();

  	const drag = e => {
  		if (dragging || e.target.classList.contains(`no-drag`) || e.target.tagName === `INPUT` || e.target.tagName === `TEXTAREA`) {
  			return;
  		}

  		$$invalidate("dragging", dragging = true);
  		draggee.set(knot.id.get());

  		const handler = () => {
  			$$invalidate("dragging", dragging = false);
  			$$invalidate("position", position$1 = multiply_scalar([$Mouse[0] - $scroll[0], $Mouse[1] - $scroll[1], 0], 1 / $zoom));
  			update();
  			draggee.set(``);
  			$$invalidate("zIndex", zIndex = drag_count.get());
  			window.removeEventListener(`mouseup`, handler);
  		};

  		window.addEventListener(`mouseup`, handler);
  	};

  	const writable_props = ["position", "knot"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Knot> was created with unknown prop '${key}'`);
  	});

  	let { $$slots = {}, $$scope } = $$props;
  	const mouseover_handler = () => hoveree.set($id);
  	const mouseout_handler = () => hoveree.set(``);

  	$$self.$set = $$props => {
  		if ("position" in $$props) $$invalidate("position", position$1 = $$props.position);
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("$$scope" in $$props) $$invalidate("$$scope", $$scope = $$props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			position: position$1,
  			knot,
  			dragging,
  			zIndex,
  			tru_position,
  			type,
  			id,
  			$positions,
  			$Mouse,
  			$scroll,
  			$zoom,
  			$id,
  			tru_scale
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("position" in $$props) $$invalidate("position", position$1 = $$props.position);
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("dragging" in $$props) $$invalidate("dragging", dragging = $$props.dragging);
  		if ("zIndex" in $$props) $$invalidate("zIndex", zIndex = $$props.zIndex);
  		if ("tru_position" in $$props) $$invalidate("tru_position", tru_position = $$props.tru_position);
  		if ("type" in $$props) type = $$props.type;
  		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
  		if ("$positions" in $$props) positions.set($positions = $$props.$positions);
  		if ("$Mouse" in $$props) position.set($Mouse = $$props.$Mouse);
  		if ("$scroll" in $$props) scroll$1.set($scroll = $$props.$scroll);
  		if ("$zoom" in $$props) zoom.set($zoom = $$props.$zoom);
  		if ("$id" in $$props) id.set($id = $$props.$id);
  		if ("tru_scale" in $$props) $$invalidate("tru_scale", tru_scale = $$props.tru_scale);
  	};

  	let type;
  	let id;
  	let tru_scale;

  	$$self.$$.update = (changed = { knot: 1, dragging: 1, $Mouse: 1, $scroll: 1, $zoom: 1, $positions: 1, $id: 1 }) => {
  		if (changed.knot) {
  			 type = knot.knot;
  		}

  		if (changed.knot) {
  			 $$subscribe_id($$invalidate("id", id = knot.id));
  		}

  		if (changed.dragging || changed.$Mouse || changed.$scroll || changed.$zoom || changed.$positions || changed.$id) {
  			 {
  				if (dragging) {
  					$$invalidate("tru_position", tru_position = multiply_scalar(minus($Mouse, $scroll), 1 / $zoom));
  				} else {
  					$$invalidate("tru_position", tru_position = $positions[$id]);
  				}
  			}
  		}

  		if (changed.dragging) {
  			 $$invalidate("tru_scale", tru_scale = dragging ? 1.168 : 1);
  		}
  	};

  	return {
  		position: position$1,
  		knot,
  		dragging,
  		zIndex,
  		tru_position,
  		drag,
  		id,
  		$id,
  		tru_scale,
  		mouseover_handler,
  		mouseout_handler,
  		$$slots,
  		$$scope
  	};
  }

  class Knot extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$8, create_fragment$9, safe_not_equal, { position: 0, knot: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Knot",
  			options,
  			id: create_fragment$9.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Knot> was created without expected prop 'knot'");
  		}
  	}

  	get position() {
  		throw new Error("<Knot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set position(value) {
  		throw new Error("<Knot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get knot() {
  		throw new Error("<Knot>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Knot>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/Picker.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$1, console: console_1 } = globals;
  const file$a = "src/ui/weave/Picker.svelte";

  function get_each_context$1(ctx, list, i) {
  	const child_ctx = Object_1$1.create(ctx);
  	child_ctx.kind = list[i][0];
  	child_ctx.fn = list[i][1];
  	return child_ctx;
  }

  // (105:0) {#if nameit}
  function create_if_block_1$2(ctx) {
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
  			props: { address: `/${ctx.name}`, nopunch: true },
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
  			div2.textContent = "Play";
  			add_location(h2, file$a, 109, 2, 2005);
  			attr_dev(div0, "class", "spirit svelte-1ilb0s7");
  			add_location(div0, file$a, 111, 2, 2026);
  			attr_dev(input, "class", "nameit svelte-1ilb0s7");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "placeholder", "Name it");
  			add_location(input, file$a, 115, 2, 2111);
  			attr_dev(div1, "class", "false svelte-1ilb0s7");
  			add_location(div1, file$a, 126, 4, 2320);
  			attr_dev(div2, "class", "true svelte-1ilb0s7");
  			add_location(div2, file$a, 127, 4, 2392);
  			attr_dev(div3, "class", "controls svelte-1ilb0s7");
  			add_location(div3, file$a, 125, 2, 2293);
  			attr_dev(div4, "class", "nameprompt svelte-1ilb0s7");
  			add_location(div4, file$a, 105, 0, 1949);

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
  		id: create_if_block_1$2.name,
  		type: "if",
  		source: "(105:0) {#if nameit}",
  		ctx
  	});

  	return block;
  }

  // (151:0) {#if picking}
  function create_if_block$3(ctx) {
  	let current;

  	const knot_1 = new Knot({
  			props: {
  				position: ctx.position,
  				knot: ctx.knot,
  				$$slots: { default: [create_default_slot$2] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(knot_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(knot_1, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const knot_1_changes = {};
  			if (changed.position) knot_1_changes.position = ctx.position;

  			if (changed.$$scope || changed.arr_knots) {
  				knot_1_changes.$$scope = { changed, ctx };
  			}

  			knot_1.$set(knot_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(knot_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(knot_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(knot_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$3.name,
  		type: "if",
  		source: "(151:0) {#if picking}",
  		ctx
  	});

  	return block;
  }

  // (157:6) {#each arr_knots as [kind, fn] (kind)}
  function create_each_block$1(key_1, ctx) {
  	let div;
  	let t0_value = ctx.kind + "";
  	let t0;
  	let t1;
  	let color_action;
  	let dispose;

  	function mouseup_handler(...args) {
  		return ctx.mouseup_handler(ctx, ...args);
  	}

  	const block = {
  		key: key_1,
  		first: null,
  		c: function create() {
  			div = element("div");
  			t0 = text(t0_value);
  			t1 = space();
  			attr_dev(div, "class", "kind svelte-1ilb0s7");
  			add_location(div, file$a, 157, 8, 2948);
  			dispose = listen_dev(div, "mouseup", mouseup_handler, false, false, false);
  			this.first = div;
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  			append_dev(div, t0);
  			append_dev(div, t1);
  			color_action = color$1.call(null, div, ctx.kind) || ({});
  		},
  		p: function update(changed, new_ctx) {
  			ctx = new_ctx;
  			if (changed.arr_knots && t0_value !== (t0_value = ctx.kind + "")) set_data_dev(t0, t0_value);
  			if (is_function(color_action.update) && changed.arr_knots) color_action.update.call(null, ctx.kind);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block$1.name,
  		type: "each",
  		source: "(157:6) {#each arr_knots as [kind, fn] (kind)}",
  		ctx
  	});

  	return block;
  }

  // (152:2) <Knot {position} {knot}>
  function create_default_slot$2(ctx) {
  	let div1;
  	let div0;
  	let t1;
  	let each_blocks = [];
  	let each_1_lookup = new Map();
  	let each_value = ctx.arr_knots;
  	const get_key = ctx => ctx.kind;

  	for (let i = 0; i < each_value.length; i += 1) {
  		let child_ctx = get_each_context$1(ctx, each_value, i);
  		let key = get_key(child_ctx);
  		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
  	}

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			div0 = element("div");
  			div0.textContent = "SPAWN A ...";
  			t1 = space();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div0, "class", "title svelte-1ilb0s7");
  			add_location(div0, file$a, 153, 6, 2844);
  			attr_dev(div1, "class", "prompt");
  			add_location(div1, file$a, 152, 4, 2817);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			append_dev(div1, div0);
  			append_dev(div1, t1);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div1, null);
  			}
  		},
  		p: function update(changed, ctx) {
  			const each_value = ctx.arr_knots;
  			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, div1, destroy_block, create_each_block$1, null, get_each_context$1);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div1);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].d();
  			}
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot$2.name,
  		type: "slot",
  		source: "(152:2) <Knot {position} {knot}>",
  		ctx
  	});

  	return block;
  }

  function create_fragment$a(ctx) {
  	let t0;
  	let div;
  	let input;
  	let t1;
  	let current;
  	let dispose;
  	let if_block0 = ctx.nameit && create_if_block_1$2(ctx);
  	let if_block1 = ctx.picking && create_if_block$3(ctx);

  	const block = {
  		c: function create() {
  			if (if_block0) if_block0.c();
  			t0 = space();
  			div = element("div");
  			input = element("input");
  			t1 = space();
  			if (if_block1) if_block1.c();
  			attr_dev(input, "type", "file");
  			attr_dev(input, "class", "file svelte-1ilb0s7");
  			input.multiple = "multiple";
  			add_location(input, file$a, 141, 0, 2618);
  			attr_dev(div, "class", "picker svelte-1ilb0s7");
  			toggle_class(div, "picking", ctx.picking);
  			toggle_class(div, "dragover", ctx.dragover);
  			add_location(div, file$a, 131, 0, 2462);

  			dispose = [
  				listen_dev(window, "mouseup", ctx.nopick, false, false, false),
  				listen_dev(input, "change", ctx.change_handler, false, false, false),
  				listen_dev(div, "mousedown", ctx.pick, false, false, false),
  				listen_dev(div, "drop", ctx.drop, false, false, false),
  				listen_dev(div, "dragover", ctx.over(true), false, false, false),
  				listen_dev(div, "dragleave", ctx.over(false), false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if (if_block0) if_block0.m(target, anchor);
  			insert_dev(target, t0, anchor);
  			insert_dev(target, div, anchor);
  			append_dev(div, input);
  			ctx.input_binding(input);
  			append_dev(div, t1);
  			if (if_block1) if_block1.m(div, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (ctx.nameit) {
  				if (if_block0) {
  					if_block0.p(changed, ctx);
  					transition_in(if_block0, 1);
  				} else {
  					if_block0 = create_if_block_1$2(ctx);
  					if_block0.c();
  					transition_in(if_block0, 1);
  					if_block0.m(t0.parentNode, t0);
  				}
  			} else if (if_block0) {
  				group_outros();

  				transition_out(if_block0, 1, 1, () => {
  					if_block0 = null;
  				});

  				check_outros();
  			}

  			if (ctx.picking) {
  				if (if_block1) {
  					if_block1.p(changed, ctx);
  					transition_in(if_block1, 1);
  				} else {
  					if_block1 = create_if_block$3(ctx);
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

  			if (changed.picking) {
  				toggle_class(div, "picking", ctx.picking);
  			}

  			if (changed.dragover) {
  				toggle_class(div, "dragover", ctx.dragover);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block0);
  			transition_in(if_block1);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block0);
  			transition_out(if_block1);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (if_block0) if_block0.d(detaching);
  			if (detaching) detach_dev(t0);
  			if (detaching) detach_dev(div);
  			ctx.input_binding(null);
  			if (if_block1) if_block1.d();
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

  function instance$9($$self, $$props, $$invalidate) {
  	let $size;
  	let $scale;
  	validate_store(size, "size");
  	component_subscribe($$self, size, $$value => $$invalidate("$size", $size = $$value));
  	validate_store(scale, "scale");
  	component_subscribe($$self, scale, $$value => $$invalidate("$scale", $scale = $$value));
  	let { weave } = $$props;
  	const knot = Knot_Factory();
  	let position = [0, 0, 0];
  	let picking = false;

  	const pick = e => {
  		$$invalidate("position", position = [e.x - $size[0] / 2 - 5 * $scale, e.y - $size[1] / 2 - 1 * $scale, 0]);
  		$$invalidate("picking", picking = true);
  	};

  	const nopick = () => {
  		$$invalidate("picking", picking = false);
  	};

  	const create = k => {
  		const knot_new = weave.add({ knot: k });
  		const i = knot_new.id.get();
  		const ps = positions.get();
  		ps[i] = [...position];
  		positions.set(ps);
  	};

  	const cancels = [
  		match.subscribe(new_match => {
  			if (!new_match) return;
  			weave.give_thread.set(new_match);
  		}),
  		del$1.subscribe(port => {
  			if (!port) return;
  			const [id, type] = port.split(`|`);
  			if (type === `write`) return;
  			weave.take_thread.set(id);
  		})
  	];

  	let files;
  	let nameit = false;

  	const drop = e => {
  		const files = e.dataTransfer.files;

  		for (let i = 0; i < files.length; i++) {
  			const reader = new FileReader();

  			reader.onloadend = e => {
  				const r = piexif.load(e.target.result);
  				$$invalidate("nameit", nameit = JSON.parse(r[`0th`][piexif.ImageIFD.Make]));
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
  		$$invalidate("dragover", dragover = whether);
  		e.preventDefault();
  		e.stopPropagation();
  	};

  	const play_it = () => {
  		delete nameit.id;
  		Wheel.spawn({ [name]: nameit });
  		woven.set(name);
  		$$invalidate("nameit", nameit = false);
  	};

  	let name;
  	const writable_props = ["weave"];

  	Object_1$1.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Picker> was created with unknown prop '${key}'`);
  	});

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

  	const mouseup_handler = ({ kind }) => create(kind);

  	$$self.$set = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  	};

  	$$self.$capture_state = () => {
  		return {
  			weave,
  			position,
  			picking,
  			files,
  			nameit,
  			dragover,
  			name,
  			$size,
  			$scale,
  			arr_knots
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("position" in $$props) $$invalidate("position", position = $$props.position);
  		if ("picking" in $$props) $$invalidate("picking", picking = $$props.picking);
  		if ("files" in $$props) $$invalidate("files", files = $$props.files);
  		if ("nameit" in $$props) $$invalidate("nameit", nameit = $$props.nameit);
  		if ("dragover" in $$props) $$invalidate("dragover", dragover = $$props.dragover);
  		if ("name" in $$props) $$invalidate("name", name = $$props.name);
  		if ("$size" in $$props) size.set($size = $$props.$size);
  		if ("$scale" in $$props) scale.set($scale = $$props.$scale);
  		if ("arr_knots" in $$props) $$invalidate("arr_knots", arr_knots = $$props.arr_knots);
  	};

  	let arr_knots;
  	 $$invalidate("arr_knots", arr_knots = Object.entries(knots));

  	return {
  		weave,
  		knot,
  		position,
  		picking,
  		pick,
  		nopick,
  		create,
  		files,
  		nameit,
  		drop,
  		dragover,
  		over,
  		play_it,
  		name,
  		arr_knots,
  		input_input_handler,
  		keydown_handler,
  		click_handler,
  		input_binding,
  		change_handler,
  		mouseup_handler
  	};
  }

  class Picker extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$9, create_fragment$a, safe_not_equal, { weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Picker",
  			options,
  			id: create_fragment$a.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console_1.warn("<Picker> was created without expected prop 'weave'");
  		}
  	}

  	get weave() {
  		throw new Error("<Picker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
  		throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/explore/Channel.svelte generated by Svelte v3.14.1 */
  const file$b = "src/ui/weave/explore/Channel.svelte";

  function create_fragment$b(ctx) {
  	let div2;
  	let div0;
  	let t0;
  	let t1;
  	let div1;
  	let t2_value = JSON.stringify(ctx.$value) + "";
  	let t2;
  	let color_action;

  	const block = {
  		c: function create() {
  			div2 = element("div");
  			div0 = element("div");
  			t0 = text(ctx.key);
  			t1 = space();
  			div1 = element("div");
  			t2 = text(t2_value);
  			attr_dev(div0, "class", "key svelte-11l3zy8");
  			add_location(div0, file$b, 12, 2, 153);
  			attr_dev(div1, "class", "value svelte-11l3zy8");
  			add_location(div1, file$b, 15, 2, 192);
  			attr_dev(div2, "class", "channel svelte-11l3zy8");
  			add_location(div2, file$b, 8, 0, 107);
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
  			append_dev(div1, t2);
  			color_action = color$1.call(null, div2, ctx.key) || ({});
  		},
  		p: function update(changed, ctx) {
  			if (changed.key) set_data_dev(t0, ctx.key);
  			if (changed.$value && t2_value !== (t2_value = JSON.stringify(ctx.$value) + "")) set_data_dev(t2, t2_value);
  			if (is_function(color_action.update) && changed.key) color_action.update.call(null, ctx.key);
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div2);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
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

  function instance$a($$self, $$props, $$invalidate) {
  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	let { channel } = $$props;
  	const writable_props = ["channel"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Channel> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  	};

  	$$self.$capture_state = () => {
  		return { channel, key, value, $value };
  	};

  	$$self.$inject_state = $$props => {
  		if ("channel" in $$props) $$invalidate("channel", channel = $$props.channel);
  		if ("key" in $$props) $$invalidate("key", key = $$props.key);
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("$value" in $$props) value.set($value = $$props.$value);
  	};

  	let key;
  	let value;

  	$$self.$$.update = (changed = { channel: 1 }) => {
  		if (changed.channel) {
  			 $$invalidate("key", [key, value] = channel, key, $$subscribe_value($$invalidate("value", value)));
  		}
  	};

  	return { channel, key, value, $value };
  }

  class Channel extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$a, create_fragment$b, safe_not_equal, { channel: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Channel",
  			options,
  			id: create_fragment$b.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.channel === undefined && !("channel" in props)) {
  			console.warn("<Channel> was created without expected prop 'channel'");
  		}
  	}

  	get channel() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set channel(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/explore/Stitch.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$2 } = globals;
  const file$c = "src/ui/weave/explore/Stitch.svelte";

  function get_each_context$2(ctx, list, i) {
  	const child_ctx = Object_1$2.create(ctx);
  	child_ctx.channel = list[i];
  	return child_ctx;
  }

  // (30:0) {#if open}
  function create_if_block$4(ctx) {
  	let div;
  	let current;
  	let each_value = ctx.chans;
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

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div, "class", "chans");
  			add_location(div, file$c, 30, 0, 601);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.filter || changed.chans) {
  				each_value = ctx.chans;
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
  		id: create_if_block$4.name,
  		type: "if",
  		source: "(30:0) {#if open}",
  		ctx
  	});

  	return block;
  }

  // (33:2) {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}
  function create_if_block_1$3(ctx) {
  	let current;

  	const channel = new Channel({
  			props: { channel: ctx.channel },
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
  		source: "(33:2) {#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}",
  		ctx
  	});

  	return block;
  }

  // (32:0) {#each chans as channel}
  function create_each_block$2(ctx) {
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
  		id: create_each_block$2.name,
  		type: "each",
  		source: "(32:0) {#each chans as channel}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$c(ctx) {
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

  	let if_block = ctx.open && create_if_block$4(ctx);

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
  			attr_dev(div0, "class", "postage svelte-16sajlg");
  			add_location(div0, file$c, 23, 2, 493);
  			attr_dev(div1, "class", "stitch svelte-16sajlg");
  			toggle_class(div1, "open", ctx.open);
  			add_location(div1, file$c, 17, 0, 397);
  			dispose = listen_dev(div1, "click", ctx.click_handler, false, false, false);
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
  			if (is_function(color_action.update) && changed.$name) color_action.update.call(null, ctx.$name);

  			if (changed.open) {
  				toggle_class(div1, "open", ctx.open);
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

  function instance$b($$self, $$props, $$invalidate) {
  	let $WEAVE_EXPLORE_OPEN;

  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	let $name,
  		$$unsubscribe_name = noop,
  		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

  	let $w_name,
  		$$unsubscribe_w_name = noop,
  		$$subscribe_w_name = () => ($$unsubscribe_w_name(), $$unsubscribe_w_name = subscribe(w_name, $$value => $$invalidate("$w_name", $w_name = $$value)), w_name);

  	validate_store(WEAVE_EXPLORE_OPEN, "WEAVE_EXPLORE_OPEN");
  	component_subscribe($$self, WEAVE_EXPLORE_OPEN, $$value => $$invalidate("$WEAVE_EXPLORE_OPEN", $WEAVE_EXPLORE_OPEN = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_w_name());
  	let { filter = [] } = $$props;
  	let { stitch } = $$props;
  	let { open = $WEAVE_EXPLORE_OPEN } = $$props;
  	let { weave } = $$props;
  	const writable_props = ["filter", "stitch", "open", "weave"];

  	Object_1$2.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Stitch> was created with unknown prop '${key}'`);
  	});

  	const click_handler = () => {
  		$$invalidate("open", open = !open);
  	};

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
  			value,
  			chans,
  			$value,
  			$name,
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
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("chans" in $$props) $$invalidate("chans", chans = $$props.chans);
  		if ("$value" in $$props) value.set($value = $$props.$value);
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$w_name" in $$props) w_name.set($w_name = $$props.$w_name);
  	};

  	let w_name;
  	let name;
  	let value;
  	let chans;

  	$$self.$$.update = (changed = { weave: 1, stitch: 1, $value: 1 }) => {
  		if (changed.weave) {
  			 $$subscribe_w_name($$invalidate("w_name", w_name = weave.name));
  		}

  		if (changed.stitch) {
  			 $$subscribe_name($$invalidate("name", name = stitch.name));
  		}

  		if (changed.stitch) {
  			 $$subscribe_value($$invalidate("value", value = stitch.value));
  		}

  		if (changed.$value) {
  			 $$invalidate("chans", chans = Object.entries($value));
  		}
  	};

  	return {
  		filter,
  		stitch,
  		open,
  		weave,
  		w_name,
  		name,
  		value,
  		chans,
  		$name,
  		$w_name,
  		click_handler
  	};
  }

  class Stitch extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$b, create_fragment$c, safe_not_equal, { filter: 0, stitch: 0, open: 0, weave: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Stitch",
  			options,
  			id: create_fragment$c.name
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

  /* src/ui/weave/explore/Weave.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$3 } = globals;
  const file$d = "src/ui/weave/explore/Weave.svelte";

  function get_each_context$3(ctx, list, i) {
  	const child_ctx = Object_1$3.create(ctx);
  	child_ctx.stitch = list[i];
  	return child_ctx;
  }

  // (41:0) {#if open}
  function create_if_block$5(ctx) {
  	let div;
  	let current;
  	let each_value = ctx.stitches;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
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

  			attr_dev(div, "class", "stitches");
  			add_location(div, file$d, 41, 2, 732);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.filter || changed.stitches || changed.super_open || changed.weave) {
  				each_value = ctx.stitches;
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
  		source: "(41:0) {#if open}",
  		ctx
  	});

  	return block;
  }

  // (44:6) {#if          filter.length === 0 ||         stitch.name.get().indexOf(filter[0]) !== -1       }
  function create_if_block_1$4(ctx) {
  	let current;

  	const stitch = new Stitch({
  			props: {
  				stitch: ctx.stitch,
  				filter: ctx.filter.slice(1),
  				open: ctx.super_open,
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
  		source: "(44:6) {#if          filter.length === 0 ||         stitch.name.get().indexOf(filter[0]) !== -1       }",
  		ctx
  	});

  	return block;
  }

  // (43:4) {#each stitches as stitch}
  function create_each_block$3(ctx) {
  	let show_if = ctx.filter.length === 0 || ctx.stitch.name.get().indexOf(ctx.filter[0]) !== -1;
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
  			if (changed.filter || changed.stitches) show_if = ctx.filter.length === 0 || ctx.stitch.name.get().indexOf(ctx.filter[0]) !== -1;

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
  		id: create_each_block$3.name,
  		type: "each",
  		source: "(43:4) {#each stitches as stitch}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$d(ctx) {
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
  			props: { address: `/${ctx.$name}` },
  			$$inline: true
  		});

  	let if_block = ctx.open && create_if_block$5(ctx);

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
  			attr_dev(div0, "class", "postage svelte-t5xhn");
  			add_location(div0, file$d, 32, 2, 620);
  			attr_dev(div1, "class", "weave svelte-t5xhn");
  			toggle_class(div1, "open", ctx.open);
  			add_location(div1, file$d, 18, 0, 427);
  			dispose = listen_dev(div1, "click", ctx.click_handler, false, false, false);
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
  			if (changed.$name) postage_changes.address = `/${ctx.$name}`;
  			postage.$set(postage_changes);
  			if (!current || changed.$name) set_data_dev(t1, ctx.$name);
  			if (is_function(color_action.update) && changed.$name) color_action.update.call(null, ctx.$name);

  			if (changed.open) {
  				toggle_class(div1, "open", ctx.open);
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
  			if (detaching) detach_dev(div1);
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
  		id: create_fragment$d.name,
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

  	let $keys;
  	validate_store(WEAVE_EXPLORE_OPEN, "WEAVE_EXPLORE_OPEN");
  	component_subscribe($$self, WEAVE_EXPLORE_OPEN, $$value => $$invalidate("$WEAVE_EXPLORE_OPEN", $WEAVE_EXPLORE_OPEN = $$value));
  	validate_store(keys, "keys");
  	component_subscribe($$self, keys, $$value => $$invalidate("$keys", $keys = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_names());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	let { filter = [] } = $$props;
  	let { weave } = $$props;
  	let { open = $WEAVE_EXPLORE_OPEN } = $$props;
  	let super_open = $WEAVE_EXPLORE_OPEN;
  	const writable_props = ["filter", "weave", "open"];

  	Object_1$3.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Weave> was created with unknown prop '${key}'`);
  	});

  	const click_handler = () => {
  		if ($keys.shift) {
  			$$invalidate("open", open = true);
  			$$invalidate("super_open", super_open = !super_open);
  			return;
  		}

  		$$invalidate("open", open = !open);
  	};

  	$$self.$set = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  	};

  	$$self.$capture_state = () => {
  		return {
  			filter,
  			weave,
  			open,
  			super_open,
  			$WEAVE_EXPLORE_OPEN,
  			name,
  			names,
  			stitches,
  			$names,
  			$name,
  			$keys
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("open" in $$props) $$invalidate("open", open = $$props.open);
  		if ("super_open" in $$props) $$invalidate("super_open", super_open = $$props.super_open);
  		if ("$WEAVE_EXPLORE_OPEN" in $$props) WEAVE_EXPLORE_OPEN.set($WEAVE_EXPLORE_OPEN = $$props.$WEAVE_EXPLORE_OPEN);
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("names" in $$props) $$subscribe_names($$invalidate("names", names = $$props.names));
  		if ("stitches" in $$props) $$invalidate("stitches", stitches = $$props.stitches);
  		if ("$names" in $$props) names.set($names = $$props.$names);
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$keys" in $$props) keys.set($keys = $$props.$keys);
  	};

  	let name;
  	let names;
  	let stitches;

  	$$self.$$.update = (changed = { weave: 1, $names: 1 }) => {
  		if (changed.weave) {
  			 $$subscribe_name($$invalidate("name", name = weave.name));
  		}

  		if (changed.weave) {
  			 $$subscribe_names($$invalidate("names", names = weave.names));
  		}

  		if (changed.$names) {
  			 $$invalidate("stitches", stitches = Object.values($names));
  		}
  	};

  	return {
  		filter,
  		weave,
  		open,
  		super_open,
  		name,
  		names,
  		stitches,
  		$name,
  		$keys,
  		click_handler
  	};
  }

  class Weave$1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$c, create_fragment$d, safe_not_equal, { filter: 0, weave: 0, open: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Weave",
  			options,
  			id: create_fragment$d.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.weave === undefined && !("weave" in props)) {
  			console.warn("<Weave> was created without expected prop 'weave'");
  		}
  	}

  	get filter() {
  		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set filter(value) {
  		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get weave() {
  		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set weave(value) {
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

  const { Object: Object_1$4 } = globals;
  const file$e = "src/ui/weave/Explore.svelte";

  function get_each_context$4(ctx, list, i) {
  	const child_ctx = Object_1$4.create(ctx);
  	child_ctx.weave = list[i];
  	return child_ctx;
  }

  // (52:4) {#if        filter === `` ||       weave.name.get().indexOf(parts[0]) !== -1     }
  function create_if_block$6(ctx) {
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
  		id: create_if_block$6.name,
  		type: "if",
  		source: "(52:4) {#if        filter === `` ||       weave.name.get().indexOf(parts[0]) !== -1     }",
  		ctx
  	});

  	return block;
  }

  // (51:2) {#each ws as weave}
  function create_each_block$4(ctx) {
  	let show_if = ctx.filter === `` || ctx.weave.name.get().indexOf(ctx.parts[0]) !== -1;
  	let if_block_anchor;
  	let current;
  	let if_block = show_if && create_if_block$6(ctx);

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
  					if_block = create_if_block$6(ctx);
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
  		id: create_each_block$4.name,
  		type: "each",
  		source: "(51:2) {#each ws as weave}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$e(ctx) {
  	let div1;
  	let input;
  	let t;
  	let div0;
  	let current;
  	let dispose;
  	let each_value = ctx.ws;
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
  	}

  	const out = i => transition_out(each_blocks[i], 1, 1, () => {
  		each_blocks[i] = null;
  	});

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			input = element("input");
  			t = space();
  			div0 = element("div");

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(input, "type", "text");
  			attr_dev(input, "class", "filter svelte-1nahbom");
  			attr_dev(input, "placeholder", "Filter and +/-name");
  			add_location(input, file$e, 41, 2, 622);
  			attr_dev(div0, "class", "weaves svelte-1nahbom");
  			add_location(div0, file$e, 49, 2, 793);
  			attr_dev(div1, "class", "explore svelte-1nahbom");
  			add_location(div1, file$e, 40, 0, 598);

  			dispose = [
  				listen_dev(input, "input", ctx.input_input_handler),
  				listen_dev(input, "keydown", ctx.keydown_handler, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			append_dev(div1, input);
  			set_input_value(input, ctx.filter);
  			append_dev(div1, t);
  			append_dev(div1, div0);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div0, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (changed.filter && input.value !== ctx.filter) {
  				set_input_value(input, ctx.filter);
  			}

  			if (changed.filter || changed.ws || changed.parts) {
  				each_value = ctx.ws;
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context$4(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  						transition_in(each_blocks[i], 1);
  					} else {
  						each_blocks[i] = create_each_block$4(child_ctx);
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
  			if (detaching) detach_dev(div1);
  			destroy_each(each_blocks, detaching);
  			run_all(dispose);
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

  function instance$d($$self, $$props, $$invalidate) {
  	let $weaves,
  		$$unsubscribe_weaves = noop,
  		$$subscribe_weaves = () => ($$unsubscribe_weaves(), $$unsubscribe_weaves = subscribe(weaves, $$value => $$invalidate("$weaves", $weaves = $$value)), weaves);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_weaves());
  	let filter = ``;

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

  	function input_input_handler() {
  		filter = this.value;
  		$$invalidate("filter", filter);
  	}

  	const keydown_handler = ({ which }) => which === 13 && do_add();

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		if ("filter" in $$props) $$invalidate("filter", filter = $$props.filter);
  		if ("weaves" in $$props) $$subscribe_weaves($$invalidate("weaves", weaves = $$props.weaves));
  		if ("ws" in $$props) $$invalidate("ws", ws = $$props.ws);
  		if ("$weaves" in $$props) weaves.set($weaves = $$props.$weaves);
  		if ("parts" in $$props) $$invalidate("parts", parts = $$props.parts);
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
  		do_add,
  		weaves,
  		ws,
  		parts,
  		input_input_handler,
  		keydown_handler
  	};
  }

  class Explore extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$d, create_fragment$e, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Explore",
  			options,
  			id: create_fragment$e.name
  		});
  	}
  }

  /* src/ui/weave/Port.svelte generated by Svelte v3.14.1 */
  const file$f = "src/ui/weave/Port.svelte";

  function create_fragment$f(ctx) {
  	let div;
  	let dispose;

  	const block = {
  		c: function create() {
  			div = element("div");
  			attr_dev(div, "class", "port no-drag svelte-1erz1ih");
  			attr_dev(div, "id", ctx.address);
  			toggle_class(div, "writable", ctx.writable);
  			toggle_class(div, "name", ctx.name);
  			add_location(div, file$f, 19, 0, 270);

  			dispose = [
  				listen_dev(div, "mousedown", ctx.mousedown, false, false, false),
  				listen_dev(div, "mouseup", ctx.mouseup, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.address) {
  				attr_dev(div, "id", ctx.address);
  			}

  			if (changed.writable) {
  				toggle_class(div, "writable", ctx.writable);
  			}

  			if (changed.name) {
  				toggle_class(div, "name", ctx.name);
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$f.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$e($$self, $$props, $$invalidate) {
  	let { writable = false } = $$props;
  	let { name = false } = $$props;
  	let { address = `` } = $$props;

  	const mousedown = () => {
  		first.set(address);
  	};

  	const mouseup = () => {
  		second.set(address);
  	};

  	const writable_props = ["writable", "name", "address"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Port> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("writable" in $$props) $$invalidate("writable", writable = $$props.writable);
  		if ("name" in $$props) $$invalidate("name", name = $$props.name);
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  	};

  	$$self.$capture_state = () => {
  		return { writable, name, address };
  	};

  	$$self.$inject_state = $$props => {
  		if ("writable" in $$props) $$invalidate("writable", writable = $$props.writable);
  		if ("name" in $$props) $$invalidate("name", name = $$props.name);
  		if ("address" in $$props) $$invalidate("address", address = $$props.address);
  	};

  	return {
  		writable,
  		name,
  		address,
  		mousedown,
  		mouseup
  	};
  }

  class Port extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$e, create_fragment$f, safe_not_equal, { writable: 0, name: 0, address: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Port",
  			options,
  			id: create_fragment$f.name
  		});
  	}

  	get writable() {
  		throw new Error("<Port>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set writable(value) {
  		throw new Error("<Port>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get name() {
  		throw new Error("<Port>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set name(value) {
  		throw new Error("<Port>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get address() {
  		throw new Error("<Port>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set address(value) {
  		throw new Error("<Port>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/knot/Mail.svelte generated by Svelte v3.14.1 */
  const file$g = "src/ui/weave/knot/Mail.svelte";

  function create_fragment$g(ctx) {
  	let div5;
  	let div0;
  	let t0;
  	let div4;
  	let div1;
  	let t1;
  	let div2;
  	let input;
  	let t2;
  	let div3;
  	let color_action;
  	let current;
  	let dispose;

  	const postage = new Postage({
  			props: {
  				address: ctx.$whom.split(`/`).slice(0, 3).join(`/`)
  			},
  			$$inline: true
  		});

  	const port0 = new Port({
  			props: {
  				writable: true,
  				address: `${ctx.$id}|write`
  			},
  			$$inline: true
  		});

  	const port1 = new Port({
  			props: { address: `${ctx.$id}|read` },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div5 = element("div");
  			div0 = element("div");
  			create_component(postage.$$.fragment);
  			t0 = space();
  			div4 = element("div");
  			div1 = element("div");
  			create_component(port0.$$.fragment);
  			t1 = space();
  			div2 = element("div");
  			input = element("input");
  			t2 = space();
  			div3 = element("div");
  			create_component(port1.$$.fragment);
  			attr_dev(div0, "class", "postage svelte-azj26s");
  			add_location(div0, file$g, 12, 2, 252);
  			attr_dev(div1, "class", "port left svelte-azj26s");
  			add_location(div1, file$g, 16, 4, 375);
  			attr_dev(input, "type", "text");
  			attr_dev(input, "placeholder", "AdDrEsS hErE");
  			attr_dev(input, "class", "svelte-azj26s");
  			add_location(input, file$g, 20, 6, 491);
  			attr_dev(div2, "class", "address svelte-azj26s");
  			add_location(div2, file$g, 19, 4, 463);
  			attr_dev(div3, "class", "port right svelte-azj26s");
  			add_location(div3, file$g, 22, 4, 573);
  			attr_dev(div4, "class", "center svelte-azj26s");
  			add_location(div4, file$g, 15, 2, 350);
  			attr_dev(div5, "class", "mail svelte-azj26s");
  			add_location(div5, file$g, 11, 0, 202);
  			dispose = listen_dev(input, "input", ctx.input_input_handler);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div5, anchor);
  			append_dev(div5, div0);
  			mount_component(postage, div0, null);
  			append_dev(div5, t0);
  			append_dev(div5, div4);
  			append_dev(div4, div1);
  			mount_component(port0, div1, null);
  			append_dev(div4, t1);
  			append_dev(div4, div2);
  			append_dev(div2, input);
  			set_input_value(input, ctx.$whom);
  			append_dev(div4, t2);
  			append_dev(div4, div3);
  			mount_component(port1, div3, null);
  			color_action = color$1.call(null, div5, ctx.$whom || `/???/`) || ({});
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const postage_changes = {};
  			if (changed.$whom) postage_changes.address = ctx.$whom.split(`/`).slice(0, 3).join(`/`);
  			postage.$set(postage_changes);
  			const port0_changes = {};
  			if (changed.$id) port0_changes.address = `${ctx.$id}|write`;
  			port0.$set(port0_changes);

  			if (changed.$whom && input.value !== ctx.$whom) {
  				set_input_value(input, ctx.$whom);
  			}

  			const port1_changes = {};
  			if (changed.$id) port1_changes.address = `${ctx.$id}|read`;
  			port1.$set(port1_changes);
  			if (is_function(color_action.update) && changed.$whom) color_action.update.call(null, ctx.$whom || `/???/`);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(postage.$$.fragment, local);
  			transition_in(port0.$$.fragment, local);
  			transition_in(port1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(postage.$$.fragment, local);
  			transition_out(port0.$$.fragment, local);
  			transition_out(port1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div5);
  			destroy_component(postage);
  			destroy_component(port0);
  			destroy_component(port1);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$g.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$f($$self, $$props, $$invalidate) {
  	let $whom,
  		$$unsubscribe_whom = noop,
  		$$subscribe_whom = () => ($$unsubscribe_whom(), $$unsubscribe_whom = subscribe(whom, $$value => $$invalidate("$whom", $whom = $$value)), whom);

  	let $id,
  		$$unsubscribe_id = noop,
  		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_whom());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
  	let { knot } = $$props;
  	const writable_props = ["knot"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Mail> was created with unknown prop '${key}'`);
  	});

  	function input_input_handler() {
  		$whom = this.value;
  		whom.set($whom);
  	}

  	$$self.$set = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  	};

  	$$self.$capture_state = () => {
  		return { knot, whom, id, $whom, $id };
  	};

  	$$self.$inject_state = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("whom" in $$props) $$subscribe_whom($$invalidate("whom", whom = $$props.whom));
  		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
  		if ("$whom" in $$props) whom.set($whom = $$props.$whom);
  		if ("$id" in $$props) id.set($id = $$props.$id);
  	};

  	let whom;
  	let id;

  	$$self.$$.update = (changed = { knot: 1 }) => {
  		if (changed.knot) {
  			 $$subscribe_whom($$invalidate("whom", whom = knot.whom));
  		}

  		if (changed.knot) {
  			 $$subscribe_id($$invalidate("id", id = knot.id));
  		}
  	};

  	return {
  		knot,
  		whom,
  		id,
  		$whom,
  		$id,
  		input_input_handler
  	};
  }

  class Mail extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$f, create_fragment$g, safe_not_equal, { knot: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Mail",
  			options,
  			id: create_fragment$g.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Mail> was created without expected prop 'knot'");
  		}
  	}

  	get knot() {
  		throw new Error("<Mail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Mail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/knot/Math.svelte generated by Svelte v3.14.1 */
  const file$h = "src/ui/weave/knot/Math.svelte";

  function create_fragment$h(ctx) {
  	let div4;
  	let div3;
  	let div0;
  	let t0;
  	let div1;
  	let textarea;
  	let t1;
  	let t2;
  	let t3;
  	let div2;
  	let color_action;
  	let current;
  	let dispose;

  	const port0 = new Port({
  			props: {
  				writable: true,
  				address: `${ctx.$id}|write`
  			},
  			$$inline: true
  		});

  	const port1 = new Port({
  			props: { address: `${ctx.$id}|read` },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div4 = element("div");
  			div3 = element("div");
  			div0 = element("div");
  			create_component(port0.$$.fragment);
  			t0 = space();
  			div1 = element("div");
  			textarea = element("textarea");
  			t1 = space();
  			t2 = text(ctx.$value);
  			t3 = space();
  			div2 = element("div");
  			create_component(port1.$$.fragment);
  			attr_dev(div0, "class", "port svelte-1p8xt2c");
  			add_location(div0, file$h, 17, 4, 312);
  			attr_dev(textarea, "class", "text svelte-1p8xt2c");
  			attr_dev(textarea, "type", "text");
  			attr_dev(textarea, "placeholder", "2 + 2 = ChAiR");
  			add_location(textarea, file$h, 21, 6, 423);
  			attr_dev(div1, "class", "address svelte-1p8xt2c");
  			add_location(div1, file$h, 20, 4, 395);
  			attr_dev(div2, "class", "port svelte-1p8xt2c");
  			add_location(div2, file$h, 29, 4, 580);
  			attr_dev(div3, "class", "center svelte-1p8xt2c");
  			add_location(div3, file$h, 13, 2, 239);
  			attr_dev(div4, "class", "mail svelte-1p8xt2c");
  			add_location(div4, file$h, 12, 0, 218);
  			dispose = listen_dev(textarea, "input", ctx.textarea_input_handler);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div4, anchor);
  			append_dev(div4, div3);
  			append_dev(div3, div0);
  			mount_component(port0, div0, null);
  			append_dev(div3, t0);
  			append_dev(div3, div1);
  			append_dev(div1, textarea);
  			set_input_value(textarea, ctx.$math);
  			append_dev(div1, t1);
  			append_dev(div1, t2);
  			append_dev(div3, t3);
  			append_dev(div3, div2);
  			mount_component(port1, div2, null);
  			color_action = color$1.call(null, div3, JSON.stringify(ctx.$value)) || ({});
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const port0_changes = {};
  			if (changed.$id) port0_changes.address = `${ctx.$id}|write`;
  			port0.$set(port0_changes);

  			if (changed.$math) {
  				set_input_value(textarea, ctx.$math);
  			}

  			if (!current || changed.$value) set_data_dev(t2, ctx.$value);
  			const port1_changes = {};
  			if (changed.$id) port1_changes.address = `${ctx.$id}|read`;
  			port1.$set(port1_changes);
  			if (is_function(color_action.update) && changed.$value) color_action.update.call(null, JSON.stringify(ctx.$value));
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(port0.$$.fragment, local);
  			transition_in(port1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(port0.$$.fragment, local);
  			transition_out(port1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div4);
  			destroy_component(port0);
  			destroy_component(port1);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			dispose();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$h.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$g($$self, $$props, $$invalidate) {
  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	let $id,
  		$$unsubscribe_id = noop,
  		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

  	let $math,
  		$$unsubscribe_math = noop,
  		$$subscribe_math = () => ($$unsubscribe_math(), $$unsubscribe_math = subscribe(math, $$value => $$invalidate("$math", $math = $$value)), math);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_math());
  	let { knot } = $$props;
  	const writable_props = ["knot"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Math> was created with unknown prop '${key}'`);
  	});

  	function textarea_input_handler() {
  		$math = this.value;
  		math.set($math);
  	}

  	$$self.$set = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  	};

  	$$self.$capture_state = () => {
  		return {
  			knot,
  			math,
  			value,
  			id,
  			$value,
  			$id,
  			$math
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("math" in $$props) $$subscribe_math($$invalidate("math", math = $$props.math));
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
  		if ("$value" in $$props) value.set($value = $$props.$value);
  		if ("$id" in $$props) id.set($id = $$props.$id);
  		if ("$math" in $$props) math.set($math = $$props.$math);
  	};

  	let math;
  	let value;
  	let id;

  	$$self.$$.update = (changed = { knot: 1 }) => {
  		if (changed.knot) {
  			 $$subscribe_math($$invalidate("math", math = knot.math));
  		}

  		if (changed.knot) {
  			 $$subscribe_value($$invalidate("value", value = knot.value));
  		}

  		if (changed.knot) {
  			 $$subscribe_id($$invalidate("id", id = knot.id));
  		}
  	};

  	return {
  		knot,
  		math,
  		value,
  		id,
  		$value,
  		$id,
  		$math,
  		textarea_input_handler
  	};
  }

  class Math$1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$g, create_fragment$h, safe_not_equal, { knot: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Math",
  			options,
  			id: create_fragment$h.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Math> was created without expected prop 'knot'");
  		}
  	}

  	get knot() {
  		throw new Error("<Math>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Math>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/knot/stitch/Channel.svelte generated by Svelte v3.14.1 */
  const file$i = "src/ui/weave/knot/stitch/Channel.svelte";

  function create_fragment$i(ctx) {
  	let div2;
  	let t0;
  	let div1;
  	let div0;
  	let t1;
  	let t2;
  	let input;
  	let color_action;
  	let t3;
  	let current;
  	let dispose;

  	const port0 = new Port({
  			props: {
  				writable: true,
  				address: `${ctx.address(ctx.name)}|write`
  			},
  			$$inline: true
  		});

  	const port1 = new Port({
  			props: { address: `${ctx.address(ctx.name)}|read` },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div2 = element("div");
  			create_component(port0.$$.fragment);
  			t0 = space();
  			div1 = element("div");
  			div0 = element("div");
  			t1 = text(ctx.name);
  			t2 = space();
  			input = element("input");
  			t3 = space();
  			create_component(port1.$$.fragment);
  			attr_dev(div0, "class", "name svelte-18j6qdc");
  			add_location(div0, file$i, 27, 4, 542);
  			attr_dev(input, "class", "edit svelte-18j6qdc");
  			attr_dev(input, "type", "text");
  			attr_dev(input, "placeholder", "JSON plz");
  			add_location(input, file$i, 28, 4, 577);
  			attr_dev(div1, "class", "vbox svelte-18j6qdc");
  			add_location(div1, file$i, 26, 2, 486);
  			attr_dev(div2, "class", "channel svelte-18j6qdc");
  			add_location(div2, file$i, 24, 0, 408);

  			dispose = [
  				listen_dev(input, "input", ctx.input_input_handler),
  				listen_dev(input, "blur", ctx.blur_handler, false, false, false),
  				listen_dev(input, "keydown", ctx.keydown_handler, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div2, anchor);
  			mount_component(port0, div2, null);
  			append_dev(div2, t0);
  			append_dev(div2, div1);
  			append_dev(div1, div0);
  			append_dev(div0, t1);
  			append_dev(div1, t2);
  			append_dev(div1, input);
  			set_input_value(input, ctx.edit);
  			color_action = color$1.call(null, div1, JSON.stringify(ctx.name)) || ({});
  			append_dev(div2, t3);
  			mount_component(port1, div2, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const port0_changes = {};
  			if (changed.name) port0_changes.address = `${ctx.address(ctx.name)}|write`;
  			port0.$set(port0_changes);
  			if (!current || changed.name) set_data_dev(t1, ctx.name);

  			if (changed.edit && input.value !== ctx.edit) {
  				set_input_value(input, ctx.edit);
  			}

  			if (is_function(color_action.update) && changed.name) color_action.update.call(null, JSON.stringify(ctx.name));
  			const port1_changes = {};
  			if (changed.name) port1_changes.address = `${ctx.address(ctx.name)}|read`;
  			port1.$set(port1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(port0.$$.fragment, local);
  			transition_in(port1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(port0.$$.fragment, local);
  			transition_out(port1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div2);
  			destroy_component(port0);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			destroy_component(port1);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$i.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$h($$self, $$props, $$invalidate) {
  	let $chan,
  		$$unsubscribe_chan = noop,
  		$$subscribe_chan = () => ($$unsubscribe_chan(), $$unsubscribe_chan = subscribe(chan, $$value => $$invalidate("$chan", $chan = $$value)), chan);

  	let $id,
  		$$unsubscribe_id = noop,
  		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_chan());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
  	let { knot } = $$props;
  	let { chan } = $$props;
  	validate_store(chan, "chan");
  	$$subscribe_chan();
  	let { name } = $$props;

  	const save = () => {
  		let v = $chan;

  		try {
  			v = JSON.parse(edit);
  			chan.set(v);
  		} catch(ex) {
  			$$invalidate("edit", edit = JSON.stringify($chan));
  		}
  	};

  	const address = channel => `${$id}/${channel}`;
  	const writable_props = ["knot", "chan", "name"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Channel> was created with unknown prop '${key}'`);
  	});

  	function input_input_handler() {
  		edit = this.value;
  		($$invalidate("edit", edit), $$invalidate("$chan", $chan));
  	}

  	const blur_handler = () => {
  		save();
  	};

  	const keydown_handler = ({ which }) => {
  		if (which !== 13) return;
  		save();
  	};

  	$$self.$set = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("chan" in $$props) $$subscribe_chan($$invalidate("chan", chan = $$props.chan));
  		if ("name" in $$props) $$invalidate("name", name = $$props.name);
  	};

  	$$self.$capture_state = () => {
  		return { knot, chan, name, edit, $chan, id, $id };
  	};

  	$$self.$inject_state = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("chan" in $$props) $$subscribe_chan($$invalidate("chan", chan = $$props.chan));
  		if ("name" in $$props) $$invalidate("name", name = $$props.name);
  		if ("edit" in $$props) $$invalidate("edit", edit = $$props.edit);
  		if ("$chan" in $$props) chan.set($chan = $$props.$chan);
  		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
  		if ("$id" in $$props) id.set($id = $$props.$id);
  	};

  	let edit;
  	let id;

  	$$self.$$.update = (changed = { $chan: 1, knot: 1 }) => {
  		if (changed.$chan) {
  			 $$invalidate("edit", edit = JSON.stringify($chan));
  		}

  		if (changed.knot) {
  			 $$subscribe_id($$invalidate("id", id = knot.id));
  		}
  	};

  	return {
  		knot,
  		chan,
  		name,
  		save,
  		address,
  		edit,
  		id,
  		input_input_handler,
  		blur_handler,
  		keydown_handler
  	};
  }

  class Channel$1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$h, create_fragment$i, safe_not_equal, { knot: 0, chan: 0, name: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Channel",
  			options,
  			id: create_fragment$i.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Channel> was created without expected prop 'knot'");
  		}

  		if (ctx.chan === undefined && !("chan" in props)) {
  			console.warn("<Channel> was created without expected prop 'chan'");
  		}

  		if (ctx.name === undefined && !("name" in props)) {
  			console.warn("<Channel> was created without expected prop 'name'");
  		}
  	}

  	get knot() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get chan() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set chan(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get name() {
  		throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set name(value) {
  		throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/knot/Stitch.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$5 } = globals;
  const file$j = "src/ui/weave/knot/Stitch.svelte";

  function get_each_context$5(ctx, list, i) {
  	const child_ctx = Object_1$5.create(ctx);
  	child_ctx.chan_name = list[i][0];
  	child_ctx.chan = list[i][1];
  	return child_ctx;
  }

  // (55:4) {:else}
  function create_else_block$1(ctx) {
  	let div;

  	const block = {
  		c: function create() {
  			div = element("div");
  			div.textContent = "/\\/\\";
  			attr_dev(div, "class", "no-stitches svelte-1flykfe");
  			add_location(div, file$j, 55, 6, 1140);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$1.name,
  		type: "else",
  		source: "(55:4) {:else}",
  		ctx
  	});

  	return block;
  }

  // (53:4) {#each Object.entries($value) as [chan_name, chan] (chan_name)}
  function create_each_block$5(key_1, ctx) {
  	let first;
  	let current;

  	const channel = new Channel$1({
  			props: {
  				chan: ctx.chan,
  				knot: ctx.knot,
  				name: ctx.chan_name
  			},
  			$$inline: true
  		});

  	const block = {
  		key: key_1,
  		first: null,
  		c: function create() {
  			first = empty();
  			create_component(channel.$$.fragment);
  			this.first = first;
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, first, anchor);
  			mount_component(channel, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const channel_changes = {};
  			if (changed.$value) channel_changes.chan = ctx.chan;
  			if (changed.knot) channel_changes.knot = ctx.knot;
  			if (changed.$value) channel_changes.name = ctx.chan_name;
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
  			if (detaching) detach_dev(first);
  			destroy_component(channel, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block$5.name,
  		type: "each",
  		source: "(53:4) {#each Object.entries($value) as [chan_name, chan] (chan_name)}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$j(ctx) {
  	let div0;
  	let t0;
  	let div2;
  	let div1;
  	let input0;
  	let color_action;
  	let t1;
  	let div4;
  	let div3;
  	let t2;
  	let each_blocks = [];
  	let each_1_lookup = new Map();
  	let t3;
  	let input1;
  	let input1_placeholder_value;
  	let current;
  	let dispose;

  	const port = new Port({
  			props: { address: `${ctx.$id}|read` },
  			$$inline: true
  		});

  	const postage = new Postage({
  			props: {
  				address: `/${ctx.$woven.name.get()}/${ctx.$name}`
  			},
  			$$inline: true
  		});

  	let each_value = Object.entries(ctx.$value);
  	const get_key = ctx => ctx.chan_name;

  	for (let i = 0; i < each_value.length; i += 1) {
  		let child_ctx = get_each_context$5(ctx, each_value, i);
  		let key = get_key(child_ctx);
  		each_1_lookup.set(key, each_blocks[i] = create_each_block$5(key, child_ctx));
  	}

  	let each_1_else = null;

  	if (!each_value.length) {
  		each_1_else = create_else_block$1(ctx);
  		each_1_else.c();
  	}

  	const block = {
  		c: function create() {
  			div0 = element("div");
  			create_component(port.$$.fragment);
  			t0 = space();
  			div2 = element("div");
  			div1 = element("div");
  			input0 = element("input");
  			t1 = space();
  			div4 = element("div");
  			div3 = element("div");
  			create_component(postage.$$.fragment);
  			t2 = space();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			t3 = space();
  			input1 = element("input");
  			attr_dev(div0, "class", "port svelte-1flykfe");
  			add_location(div0, file$j, 32, 0, 646);
  			attr_dev(input0, "type", "text");
  			attr_dev(input0, "class", "edit svelte-1flykfe");
  			attr_dev(input0, "placeholder", "Name It!");
  			add_location(input0, file$j, 42, 4, 787);
  			attr_dev(div1, "class", "header svelte-1flykfe");
  			add_location(div1, file$j, 38, 2, 732);
  			attr_dev(div2, "class", "nameit svelte-1flykfe");
  			add_location(div2, file$j, 37, 0, 709);
  			attr_dev(div3, "class", "postage svelte-1flykfe");
  			add_location(div3, file$j, 47, 2, 904);
  			attr_dev(input1, "type", "text");
  			attr_dev(input1, "class", "add_channel svelte-1flykfe");
  			attr_dev(input1, "placeholder", input1_placeholder_value = `-${Object.keys(ctx.$value)[0]} to remove!`);
  			add_location(input1, file$j, 58, 4, 1196);
  			attr_dev(div4, "class", "board svelte-1flykfe");
  			add_location(div4, file$j, 46, 0, 882);

  			dispose = [
  				listen_dev(input0, "input", ctx.input0_input_handler),
  				listen_dev(input1, "input", ctx.input1_input_handler),
  				listen_dev(input1, "keypress", ctx.check_add, false, false, false),
  				listen_dev(input1, "blur", ctx.blur_handler, false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div0, anchor);
  			mount_component(port, div0, null);
  			insert_dev(target, t0, anchor);
  			insert_dev(target, div2, anchor);
  			append_dev(div2, div1);
  			append_dev(div1, input0);
  			set_input_value(input0, ctx.$name);
  			color_action = color$1.call(null, div1, ctx.$name) || ({});
  			insert_dev(target, t1, anchor);
  			insert_dev(target, div4, anchor);
  			append_dev(div4, div3);
  			mount_component(postage, div3, null);
  			append_dev(div4, t2);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div4, null);
  			}

  			if (each_1_else) {
  				each_1_else.m(div4, null);
  			}

  			append_dev(div4, t3);
  			append_dev(div4, input1);
  			set_input_value(input1, ctx.weave_add);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const port_changes = {};
  			if (changed.$id) port_changes.address = `${ctx.$id}|read`;
  			port.$set(port_changes);

  			if (changed.$name && input0.value !== ctx.$name) {
  				set_input_value(input0, ctx.$name);
  			}

  			if (is_function(color_action.update) && changed.$name) color_action.update.call(null, ctx.$name);
  			const postage_changes = {};
  			if (changed.$woven || changed.$name) postage_changes.address = `/${ctx.$woven.name.get()}/${ctx.$name}`;
  			postage.$set(postage_changes);
  			const each_value = Object.entries(ctx.$value);
  			group_outros();
  			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, div4, outro_and_destroy_block, create_each_block$5, t3, get_each_context$5);
  			check_outros();

  			if (each_value.length) {
  				if (each_1_else) {
  					each_1_else.d(1);
  					each_1_else = null;
  				}
  			} else if (!each_1_else) {
  				each_1_else = create_else_block$1(ctx);
  				each_1_else.c();
  				each_1_else.m(div4, t3);
  			}

  			if (!current || changed.$value && input1_placeholder_value !== (input1_placeholder_value = `-${Object.keys(ctx.$value)[0]} to remove!`)) {
  				attr_dev(input1, "placeholder", input1_placeholder_value);
  			}

  			if (changed.weave_add && input1.value !== ctx.weave_add) {
  				set_input_value(input1, ctx.weave_add);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(port.$$.fragment, local);
  			transition_in(postage.$$.fragment, local);

  			for (let i = 0; i < each_value.length; i += 1) {
  				transition_in(each_blocks[i]);
  			}

  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(port.$$.fragment, local);
  			transition_out(postage.$$.fragment, local);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				transition_out(each_blocks[i]);
  			}

  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div0);
  			destroy_component(port);
  			if (detaching) detach_dev(t0);
  			if (detaching) detach_dev(div2);
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(div4);
  			destroy_component(postage);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].d();
  			}

  			if (each_1_else) each_1_else.d();
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$j.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$i($$self, $$props, $$invalidate) {
  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	let $id,
  		$$unsubscribe_id = noop,
  		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

  	let $name,
  		$$unsubscribe_name = noop,
  		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

  	let $woven;
  	validate_store(woven, "woven");
  	component_subscribe($$self, woven, $$value => $$invalidate("$woven", $woven = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
  	let { knot } = $$props;
  	let weave_add = ``;

  	const check_add = ({ which }) => {
  		if (which !== 13) return;
  		const val = $value;

  		if (weave_add[0] === `-`) {
  			delete val[weave_add.slice(1)];
  		} else {
  			val[weave_add] = write(random(2));
  		}

  		value.set(val);
  		$$invalidate("weave_add", weave_add = ``);
  	};

  	const writable_props = ["knot"];

  	Object_1$5.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Stitch> was created with unknown prop '${key}'`);
  	});

  	function input0_input_handler() {
  		$name = this.value;
  		name.set($name);
  	}

  	function input1_input_handler() {
  		weave_add = this.value;
  		$$invalidate("weave_add", weave_add);
  	}

  	const blur_handler = () => {
  		$$invalidate("weave_add", weave_add = ``);
  	};

  	$$self.$set = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  	};

  	$$self.$capture_state = () => {
  		return {
  			knot,
  			weave_add,
  			id,
  			value,
  			name,
  			$value,
  			$id,
  			$name,
  			$woven
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("weave_add" in $$props) $$invalidate("weave_add", weave_add = $$props.weave_add);
  		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
  		if ("$value" in $$props) value.set($value = $$props.$value);
  		if ("$id" in $$props) id.set($id = $$props.$id);
  		if ("$name" in $$props) name.set($name = $$props.$name);
  		if ("$woven" in $$props) woven.set($woven = $$props.$woven);
  	};

  	let id;
  	let value;
  	let name;

  	$$self.$$.update = (changed = { knot: 1 }) => {
  		if (changed.knot) {
  			 $$subscribe_id($$invalidate("id", id = knot.id));
  		}

  		if (changed.knot) {
  			 $$subscribe_value($$invalidate("value", value = knot.value));
  		}

  		if (changed.knot) {
  			 $$subscribe_name($$invalidate("name", name = knot.name));
  		}
  	};

  	return {
  		knot,
  		weave_add,
  		check_add,
  		id,
  		value,
  		name,
  		$value,
  		$id,
  		$name,
  		$woven,
  		input0_input_handler,
  		input1_input_handler,
  		blur_handler
  	};
  }

  class Stitch$1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$i, create_fragment$j, safe_not_equal, { knot: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Stitch",
  			options,
  			id: create_fragment$j.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Stitch> was created without expected prop 'knot'");
  		}
  	}

  	get knot() {
  		throw new Error("<Stitch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Stitch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/knot/Stream.svelte generated by Svelte v3.14.1 */
  const file$k = "src/ui/weave/knot/Stream.svelte";

  // (18:6) {#if $value === null}
  function create_if_block$7(ctx) {
  	let div0;
  	let div0_intro;
  	let t1;
  	let div1;
  	let div1_intro;

  	const block = {
  		c: function create() {
  			div0 = element("div");
  			div0.textContent = "\\/\\/";
  			t1 = space();
  			div1 = element("div");
  			div1.textContent = "JSON IT!";
  			attr_dev(div0, "class", "doit svelte-41z4o3");
  			add_location(div0, file$k, 18, 8, 477);
  			attr_dev(div1, "class", "doit svelte-41z4o3");
  			add_location(div1, file$k, 19, 8, 542);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div0, anchor);
  			insert_dev(target, t1, anchor);
  			insert_dev(target, div1, anchor);
  		},
  		i: function intro(local) {
  			if (!div0_intro) {
  				add_render_callback(() => {
  					div0_intro = create_in_transition(div0, fly, ctx.$SVELTE_ANIMATION);
  					div0_intro.start();
  				});
  			}

  			if (!div1_intro) {
  				add_render_callback(() => {
  					div1_intro = create_in_transition(div1, fly, ctx.$SVELTE_ANIMATION);
  					div1_intro.start();
  				});
  			}
  		},
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div0);
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(div1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$7.name,
  		type: "if",
  		source: "(18:6) {#if $value === null}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$k(ctx) {
  	let div2;
  	let t0;
  	let div1;
  	let div0;
  	let pre;
  	let t1_value = JSON.stringify(ctx.$value, null, 2) + "";
  	let t1;
  	let t2;
  	let color_action;
  	let t3;
  	let current;

  	const port0 = new Port({
  			props: {
  				writable: true,
  				address: `${ctx.$id}|write`
  			},
  			$$inline: true
  		});

  	let if_block = ctx.$value === null && create_if_block$7(ctx);

  	const port1 = new Port({
  			props: { address: `${ctx.$id}|read` },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div2 = element("div");
  			create_component(port0.$$.fragment);
  			t0 = space();
  			div1 = element("div");
  			div0 = element("div");
  			pre = element("pre");
  			t1 = text(t1_value);
  			t2 = space();
  			if (if_block) if_block.c();
  			t3 = space();
  			create_component(port1.$$.fragment);
  			attr_dev(pre, "class", "flex svelte-41z4o3");
  			add_location(pre, file$k, 16, 6, 382);
  			attr_dev(div0, "class", "value_add svelte-41z4o3");
  			add_location(div0, file$k, 15, 4, 352);
  			attr_dev(div1, "class", "JSON svelte-41z4o3");
  			add_location(div1, file$k, 14, 2, 310);
  			attr_dev(div2, "class", "box svelte-41z4o3");
  			add_location(div2, file$k, 12, 0, 245);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div2, anchor);
  			mount_component(port0, div2, null);
  			append_dev(div2, t0);
  			append_dev(div2, div1);
  			append_dev(div1, div0);
  			append_dev(div0, pre);
  			append_dev(pre, t1);
  			append_dev(div0, t2);
  			if (if_block) if_block.m(div0, null);
  			color_action = color$1.call(null, div1, ctx.$value) || ({});
  			append_dev(div2, t3);
  			mount_component(port1, div2, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const port0_changes = {};
  			if (changed.$id) port0_changes.address = `${ctx.$id}|write`;
  			port0.$set(port0_changes);
  			if ((!current || changed.$value) && t1_value !== (t1_value = JSON.stringify(ctx.$value, null, 2) + "")) set_data_dev(t1, t1_value);

  			if (ctx.$value === null) {
  				if (!if_block) {
  					if_block = create_if_block$7(ctx);
  					if_block.c();
  					transition_in(if_block, 1);
  					if_block.m(div0, null);
  				} else {
  					transition_in(if_block, 1);
  				}
  			} else if (if_block) {
  				if_block.d(1);
  				if_block = null;
  			}

  			if (is_function(color_action.update) && changed.$value) color_action.update.call(null, ctx.$value);
  			const port1_changes = {};
  			if (changed.$id) port1_changes.address = `${ctx.$id}|read`;
  			port1.$set(port1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(port0.$$.fragment, local);
  			transition_in(if_block);
  			transition_in(port1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(port0.$$.fragment, local);
  			transition_out(port1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div2);
  			destroy_component(port0);
  			if (if_block) if_block.d();
  			if (color_action && is_function(color_action.destroy)) color_action.destroy();
  			destroy_component(port1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$k.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$j($$self, $$props, $$invalidate) {
  	let $id,
  		$$unsubscribe_id = noop,
  		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

  	let $value,
  		$$unsubscribe_value = noop,
  		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

  	let $SVELTE_ANIMATION;
  	validate_store(SVELTE_ANIMATION, "SVELTE_ANIMATION");
  	component_subscribe($$self, SVELTE_ANIMATION, $$value => $$invalidate("$SVELTE_ANIMATION", $SVELTE_ANIMATION = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
  	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
  	let { knot } = $$props;
  	const writable_props = ["knot"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Stream> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  	};

  	$$self.$capture_state = () => {
  		return {
  			knot,
  			value,
  			id,
  			$id,
  			$value,
  			$SVELTE_ANIMATION
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
  		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
  		if ("$id" in $$props) id.set($id = $$props.$id);
  		if ("$value" in $$props) value.set($value = $$props.$value);
  		if ("$SVELTE_ANIMATION" in $$props) SVELTE_ANIMATION.set($SVELTE_ANIMATION = $$props.$SVELTE_ANIMATION);
  	};

  	let value;
  	let id;

  	$$self.$$.update = (changed = { knot: 1 }) => {
  		if (changed.knot) {
  			 $$subscribe_value($$invalidate("value", value = knot.value));
  		}

  		if (changed.knot) {
  			 $$subscribe_id($$invalidate("id", id = knot.id));
  		}
  	};

  	return {
  		knot,
  		value,
  		id,
  		$id,
  		$value,
  		$SVELTE_ANIMATION
  	};
  }

  class Stream extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$j, create_fragment$k, safe_not_equal, { knot: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Stream",
  			options,
  			id: create_fragment$k.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Stream> was created without expected prop 'knot'");
  		}
  	}

  	get knot() {
  		throw new Error("<Stream>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Stream>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/ui/weave/knot/Unknown.svelte generated by Svelte v3.14.1 */

  const file$l = "src/ui/weave/knot/Unknown.svelte";

  function create_fragment$l(ctx) {
  	let h1;
  	let t0;
  	let t1;

  	const block = {
  		c: function create() {
  			h1 = element("h1");
  			t0 = text("Unknown Knot - ");
  			t1 = text(ctx.$type);
  			add_location(h1, file$l, 7, 0, 58);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h1, anchor);
  			append_dev(h1, t0);
  			append_dev(h1, t1);
  		},
  		p: function update(changed, ctx) {
  			if (changed.$type) set_data_dev(t1, ctx.$type);
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$l.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$k($$self, $$props, $$invalidate) {
  	let $type,
  		$$unsubscribe_type = noop,
  		$$subscribe_type = () => ($$unsubscribe_type(), $$unsubscribe_type = subscribe(type, $$value => $$invalidate("$type", $type = $$value)), type);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_type());
  	let { knot } = $$props;
  	const writable_props = ["knot"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Unknown> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  	};

  	$$self.$capture_state = () => {
  		return { knot, type, $type };
  	};

  	$$self.$inject_state = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("type" in $$props) $$subscribe_type($$invalidate("type", type = $$props.type));
  		if ("$type" in $$props) type.set($type = $$props.$type);
  	};

  	let type;

  	$$self.$$.update = (changed = { knot: 1 }) => {
  		if (changed.knot) {
  			 $$subscribe_type($$invalidate("type", type = knot.knot));
  		}
  	};

  	return { knot, type, $type };
  }

  class Unknown extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$k, create_fragment$l, safe_not_equal, { knot: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Unknown",
  			options,
  			id: create_fragment$l.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Unknown> was created without expected prop 'knot'");
  		}
  	}

  	get knot() {
  		throw new Error("<Unknown>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Unknown>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var mirror = (node, canvas) => ({
    destroy: tick.listen(() => {
      // push to the end of the subscribe
      requestAnimationFrame(() => {
        node.src = canvas.toDataURL(`image/jpeg`);
      });
    })
  });

  /* src/ui/weave/knot/Screen.svelte generated by Svelte v3.14.1 */
  const file$m = "src/ui/weave/knot/Screen.svelte";

  function create_fragment$m(ctx) {
  	let div2;
  	let div0;
  	let t0;
  	let img;
  	let mirror_action;
  	let t1;
  	let div1;
  	let current;

  	const port0 = new Port({
  			props: {
  				writable: true,
  				address: `${ctx.$id}|write`
  			},
  			$$inline: true
  		});

  	const port1 = new Port({
  			props: { address: `${ctx.$id}|read` },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			div2 = element("div");
  			div0 = element("div");
  			create_component(port0.$$.fragment);
  			t0 = space();
  			img = element("img");
  			t1 = space();
  			div1 = element("div");
  			create_component(port1.$$.fragment);
  			attr_dev(div0, "class", "port svelte-17c9bqw");
  			add_location(div0, file$m, 14, 2, 226);
  			attr_dev(img, "class", "view svelte-17c9bqw");
  			attr_dev(img, "alt", "mirror");
  			add_location(img, file$m, 18, 2, 304);
  			attr_dev(div1, "class", "port svelte-17c9bqw");
  			add_location(div1, file$m, 20, 2, 365);
  			attr_dev(div2, "class", "main svelte-17c9bqw");
  			add_location(div2, file$m, 13, 0, 205);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div2, anchor);
  			append_dev(div2, div0);
  			mount_component(port0, div0, null);
  			append_dev(div2, t0);
  			append_dev(div2, img);
  			mirror_action = mirror.call(null, img, ctx.value.get()) || ({});
  			append_dev(div2, t1);
  			append_dev(div2, div1);
  			mount_component(port1, div1, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const port0_changes = {};
  			if (changed.$id) port0_changes.address = `${ctx.$id}|write`;
  			port0.$set(port0_changes);
  			if (is_function(mirror_action.update) && changed.value) mirror_action.update.call(null, ctx.value.get());
  			const port1_changes = {};
  			if (changed.$id) port1_changes.address = `${ctx.$id}|read`;
  			port1.$set(port1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(port0.$$.fragment, local);
  			transition_in(port1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(port0.$$.fragment, local);
  			transition_out(port1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div2);
  			destroy_component(port0);
  			if (mirror_action && is_function(mirror_action.destroy)) mirror_action.destroy();
  			destroy_component(port1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$m.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$l($$self, $$props, $$invalidate) {
  	let $id,
  		$$unsubscribe_id = noop,
  		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

  	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
  	let { knot } = $$props;
  	const writable_props = ["knot"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Screen> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  	};

  	$$self.$capture_state = () => {
  		return { knot, id, vertex, fragment, value, $id };
  	};

  	$$self.$inject_state = $$props => {
  		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
  		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
  		if ("vertex" in $$props) vertex = $$props.vertex;
  		if ("fragment" in $$props) fragment = $$props.fragment;
  		if ("value" in $$props) $$invalidate("value", value = $$props.value);
  		if ("$id" in $$props) id.set($id = $$props.$id);
  	};

  	let id;
  	let vertex;
  	let fragment;
  	let value;

  	$$self.$$.update = (changed = { knot: 1 }) => {
  		if (changed.knot) {
  			 $$subscribe_id($$invalidate("id", id = knot.id));
  		}

  		if (changed.knot) {
  			 vertex = knot.vertex;
  		}

  		if (changed.knot) {
  			 fragment = knot.fragment;
  		}

  		if (changed.knot) {
  			 $$invalidate("value", value = knot.value);
  		}
  	};

  	return { knot, id, value, $id };
  }

  class Screen extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$l, create_fragment$m, safe_not_equal, { knot: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Screen",
  			options,
  			id: create_fragment$m.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (ctx.knot === undefined && !("knot" in props)) {
  			console.warn("<Screen> was created without expected prop 'knot'");
  		}
  	}

  	get knot() {
  		throw new Error("<Screen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set knot(value) {
  		throw new Error("<Screen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  // spawnable types

  var knot_kinds = /*#__PURE__*/Object.freeze({
    __proto__: null,
    mail: Mail,
    math: Math$1,
    stitch: Stitch$1,
    stream: Stream,
    unknown: Unknown,
    screen: Screen
  });

  /* src/ui/weave/Weave.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$6 } = globals;
  const file$n = "src/ui/weave/Weave.svelte";

  function get_each_context$6(ctx, list, i) {
  	const child_ctx = Object_1$6.create(ctx);
  	child_ctx.knot = list[i];
  	return child_ctx;
  }

  // (54:2) <Knot      {knot}   >
  function create_default_slot$3(ctx) {
  	let t;
  	let current;
  	var switch_value = ctx.get_ui(ctx.knot);

  	function switch_props(ctx) {
  		return {
  			props: { knot: ctx.knot },
  			$$inline: true
  		};
  	}

  	if (switch_value) {
  		var switch_instance = new switch_value(switch_props(ctx));
  	}

  	const block = {
  		c: function create() {
  			if (switch_instance) create_component(switch_instance.$$.fragment);
  			t = space();
  		},
  		m: function mount(target, anchor) {
  			if (switch_instance) {
  				mount_component(switch_instance, target, anchor);
  			}

  			insert_dev(target, t, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const switch_instance_changes = {};
  			if (changed.$knots) switch_instance_changes.knot = ctx.knot;

  			if (switch_value !== (switch_value = ctx.get_ui(ctx.knot))) {
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
  					mount_component(switch_instance, t.parentNode, t);
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
  			if (switch_instance) destroy_component(switch_instance, detaching);
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot$3.name,
  		type: "slot",
  		source: "(54:2) <Knot      {knot}   >",
  		ctx
  	});

  	return block;
  }

  // (53:0) {#each Object.values($knots) as knot (knot.id.get())}
  function create_each_block$6(key_1, ctx) {
  	let first;
  	let current;

  	const knot = new Knot({
  			props: {
  				knot: ctx.knot,
  				$$slots: { default: [create_default_slot$3] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		key: key_1,
  		first: null,
  		c: function create() {
  			first = empty();
  			create_component(knot.$$.fragment);
  			this.first = first;
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, first, anchor);
  			mount_component(knot, target, anchor);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const knot_changes = {};
  			if (changed.$knots) knot_changes.knot = ctx.knot;

  			if (changed.$$scope || changed.$knots) {
  				knot_changes.$$scope = { changed, ctx };
  			}

  			knot.$set(knot_changes);
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
  			if (detaching) detach_dev(first);
  			destroy_component(knot, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block$6.name,
  		type: "each",
  		source: "(53:0) {#each Object.values($knots) as knot (knot.id.get())}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$n(ctx) {
  	let t0;
  	let t1;
  	let t2;
  	let t3;
  	let t4;
  	let div;
  	let each_blocks = [];
  	let each_1_lookup = new Map();
  	let div_style_value;
  	let current;
  	const mainscreen = new MainScreen({ $$inline: true });

  	const controls = new Controls({
  			props: { weave: ctx.weave },
  			$$inline: true
  		});

  	const threads = new Threads({
  			props: { weave: ctx.weave },
  			$$inline: true
  		});

  	const picker = new Picker({
  			props: { weave: ctx.weave },
  			$$inline: true
  		});

  	const explore = new Explore({ $$inline: true });
  	let each_value = Object.values(ctx.$knots);
  	const get_key = ctx => ctx.knot.id.get();

  	for (let i = 0; i < each_value.length; i += 1) {
  		let child_ctx = get_each_context$6(ctx, each_value, i);
  		let key = get_key(child_ctx);
  		each_1_lookup.set(key, each_blocks[i] = create_each_block$6(key, child_ctx));
  	}

  	const block = {
  		c: function create() {
  			create_component(mainscreen.$$.fragment);
  			t0 = space();
  			create_component(controls.$$.fragment);
  			t1 = space();
  			create_component(threads.$$.fragment);
  			t2 = space();
  			create_component(picker.$$.fragment);
  			t3 = space();
  			create_component(explore.$$.fragment);
  			t4 = space();
  			div = element("div");

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div, "class", "knots svelte-prkmhd");

  			attr_dev(div, "style", div_style_value = [
  				`transform:`,
  				`translate3d(${ctx.$scroll[0]}px, ${ctx.$scroll[1]}px, 0)`,
  				`scale(${ctx.$zoom})`,
  				`;`
  			].join(` `));

  			add_location(div, file$n, 40, 0, 767);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			mount_component(mainscreen, target, anchor);
  			insert_dev(target, t0, anchor);
  			mount_component(controls, target, anchor);
  			insert_dev(target, t1, anchor);
  			mount_component(threads, target, anchor);
  			insert_dev(target, t2, anchor);
  			mount_component(picker, target, anchor);
  			insert_dev(target, t3, anchor);
  			mount_component(explore, target, anchor);
  			insert_dev(target, t4, anchor);
  			insert_dev(target, div, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div, null);
  			}

  			current = true;
  		},
  		p: function update(changed, ctx) {
  			const controls_changes = {};
  			if (changed.weave) controls_changes.weave = ctx.weave;
  			controls.$set(controls_changes);
  			const threads_changes = {};
  			if (changed.weave) threads_changes.weave = ctx.weave;
  			threads.$set(threads_changes);
  			const picker_changes = {};
  			if (changed.weave) picker_changes.weave = ctx.weave;
  			picker.$set(picker_changes);
  			const each_value = Object.values(ctx.$knots);
  			group_outros();
  			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, div, outro_and_destroy_block, create_each_block$6, null, get_each_context$6);
  			check_outros();

  			if (!current || (changed.$scroll || changed.$zoom) && div_style_value !== (div_style_value = [
  				`transform:`,
  				`translate3d(${ctx.$scroll[0]}px, ${ctx.$scroll[1]}px, 0)`,
  				`scale(${ctx.$zoom})`,
  				`;`
  			].join(` `))) {
  				attr_dev(div, "style", div_style_value);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(mainscreen.$$.fragment, local);
  			transition_in(controls.$$.fragment, local);
  			transition_in(threads.$$.fragment, local);
  			transition_in(picker.$$.fragment, local);
  			transition_in(explore.$$.fragment, local);

  			for (let i = 0; i < each_value.length; i += 1) {
  				transition_in(each_blocks[i]);
  			}

  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(mainscreen.$$.fragment, local);
  			transition_out(controls.$$.fragment, local);
  			transition_out(threads.$$.fragment, local);
  			transition_out(picker.$$.fragment, local);
  			transition_out(explore.$$.fragment, local);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				transition_out(each_blocks[i]);
  			}

  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(mainscreen, detaching);
  			if (detaching) detach_dev(t0);
  			destroy_component(controls, detaching);
  			if (detaching) detach_dev(t1);
  			destroy_component(threads, detaching);
  			if (detaching) detach_dev(t2);
  			destroy_component(picker, detaching);
  			if (detaching) detach_dev(t3);
  			destroy_component(explore, detaching);
  			if (detaching) detach_dev(t4);
  			if (detaching) detach_dev(div);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].d();
  			}
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$n.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$m($$self, $$props, $$invalidate) {
  	let $size;
  	let $woven;
  	let $scroll;
  	let $zoom;

  	let $knots,
  		$$unsubscribe_knots = noop,
  		$$subscribe_knots = () => ($$unsubscribe_knots(), $$unsubscribe_knots = subscribe(knots, $$value => $$invalidate("$knots", $knots = $$value)), knots);

  	validate_store(size, "size");
  	component_subscribe($$self, size, $$value => $$invalidate("$size", $size = $$value));
  	validate_store(woven, "woven");
  	component_subscribe($$self, woven, $$value => $$invalidate("$woven", $woven = $$value));
  	validate_store(scroll$1, "scroll");
  	component_subscribe($$self, scroll$1, $$value => $$invalidate("$scroll", $scroll = $$value));
  	validate_store(zoom, "zoom");
  	component_subscribe($$self, zoom, $$value => $$invalidate("$zoom", $zoom = $$value));
  	$$self.$$.on_destroy.push(() => $$unsubscribe_knots());
  	scroll$1.set([$size[0] / 2, $size[1] / 2, 0]);
  	zoom.set(0.75);

  	const get_ui = knot => {
  		const ui = knot_kinds[knot.knot.get()];
  		return ui === undefined ? Unknown : ui;
  	};

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		if ("$size" in $$props) size.set($size = $$props.$size);
  		if ("knots" in $$props) $$subscribe_knots($$invalidate("knots", knots = $$props.knots));
  		if ("$woven" in $$props) woven.set($woven = $$props.$woven);
  		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
  		if ("$scroll" in $$props) scroll$1.set($scroll = $$props.$scroll);
  		if ("$zoom" in $$props) zoom.set($zoom = $$props.$zoom);
  		if ("$knots" in $$props) knots.set($knots = $$props.$knots);
  	};

  	let knots;
  	let weave;

  	$$self.$$.update = (changed = { $woven: 1 }) => {
  		if (changed.$woven) {
  			 $$subscribe_knots($$invalidate("knots", knots = $woven.knots));
  		}

  		if (changed.$woven) {
  			 $$invalidate("weave", weave = $woven);
  		}
  	};

  	return {
  		get_ui,
  		knots,
  		weave,
  		$scroll,
  		$zoom,
  		$knots
  	};
  }

  class Weave$2 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$m, create_fragment$n, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Weave",
  			options,
  			id: create_fragment$n.name
  		});
  	}
  }

  var scroller = (node, {
    rate = 100
  } = false) => {
    let clutch = false;
    let offset = 0;
    const update = (amount = 0) => {
      if (Number.isNaN(amount)) return
      if (
        Math.abs(offset + amount) > node.offsetHeight ||
        offset + amount > 0
      ) return

      offset += amount;
      node.style.transform = `translate(0, ${offset}px)`;
    };

    const cancels = [
      frame.subscribe(() => {
        if (clutch) return
        update(-1);
      }),

      scroll.subscribe(([, deltaY]) => {
        update(deltaY / 2);
        if (clutch) clearTimeout(clutch);

        clutch = setTimeout(() => {
          clutch = false;
        }, 1000);
      })
    ];

    return {
      destroy: () => cancels.forEach(fn => fn())
    }
  };

  /* src/ui/app/Credits.svelte generated by Svelte v3.14.1 */

  const { Object: Object_1$7 } = globals;
  const file$o = "src/ui/app/Credits.svelte";

  function get_each_context_2(ctx, list, i) {
  	const child_ctx = Object_1$7.create(ctx);
  	child_ctx.h3 = list[i][0];
  	child_ctx.link = list[i][1];
  	return child_ctx;
  }

  function get_each_context_1(ctx, list, i) {
  	const child_ctx = Object_1$7.create(ctx);
  	child_ctx.h2 = list[i][0];
  	child_ctx.sub2 = list[i][1];
  	return child_ctx;
  }

  function get_each_context$7(ctx, list, i) {
  	const child_ctx = Object_1$7.create(ctx);
  	child_ctx.h1 = list[i][0];
  	child_ctx.sub1 = list[i][1];
  	return child_ctx;
  }

  // (75:4) {#each Object.entries(sub2) as [h3, link]}
  function create_each_block_2(ctx) {
  	let h3;
  	let a;
  	let t_value = ctx.h3 + "";
  	let t;
  	let a_href_value;

  	const block = {
  		c: function create() {
  			h3 = element("h3");
  			a = element("a");
  			t = text(t_value);
  			attr_dev(a, "href", a_href_value = ctx.link);
  			attr_dev(a, "target", "_new");
  			add_location(a, file$o, 75, 10, 2041);
  			add_location(h3, file$o, 75, 6, 2037);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h3, anchor);
  			append_dev(h3, a);
  			append_dev(a, t);
  		},
  		p: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h3);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block_2.name,
  		type: "each",
  		source: "(75:4) {#each Object.entries(sub2) as [h3, link]}",
  		ctx
  	});

  	return block;
  }

  // (73:2) {#each Object.entries(sub1) as [h2, sub2]}
  function create_each_block_1(ctx) {
  	let h2;
  	let t0_value = ctx.h2 + "";
  	let t0;
  	let t1;
  	let each_1_anchor;
  	let each_value_2 = Object.entries(ctx.sub2);
  	let each_blocks = [];

  	for (let i = 0; i < each_value_2.length; i += 1) {
  		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
  	}

  	const block = {
  		c: function create() {
  			h2 = element("h2");
  			t0 = text(t0_value);
  			t1 = space();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			each_1_anchor = empty();
  			add_location(h2, file$o, 73, 4, 1970);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h2, anchor);
  			append_dev(h2, t0);
  			insert_dev(target, t1, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(target, anchor);
  			}

  			insert_dev(target, each_1_anchor, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.Object || changed.credits) {
  				each_value_2 = Object.entries(ctx.sub2);
  				let i;

  				for (i = 0; i < each_value_2.length; i += 1) {
  					const child_ctx = get_each_context_2(ctx, each_value_2, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  					} else {
  						each_blocks[i] = create_each_block_2(child_ctx);
  						each_blocks[i].c();
  						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
  					}
  				}

  				for (; i < each_blocks.length; i += 1) {
  					each_blocks[i].d(1);
  				}

  				each_blocks.length = each_value_2.length;
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h2);
  			if (detaching) detach_dev(t1);
  			destroy_each(each_blocks, detaching);
  			if (detaching) detach_dev(each_1_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block_1.name,
  		type: "each",
  		source: "(73:2) {#each Object.entries(sub1) as [h2, sub2]}",
  		ctx
  	});

  	return block;
  }

  // (71:0) {#each Object.entries(credits) as [h1, sub1]}
  function create_each_block$7(ctx) {
  	let h1;
  	let t0_value = ctx.h1 + "";
  	let t0;
  	let t1;
  	let each_1_anchor;
  	let each_value_1 = Object.entries(ctx.sub1);
  	let each_blocks = [];

  	for (let i = 0; i < each_value_1.length; i += 1) {
  		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
  	}

  	const block = {
  		c: function create() {
  			h1 = element("h1");
  			t0 = text(t0_value);
  			t1 = space();

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			each_1_anchor = empty();
  			attr_dev(h1, "class", "svelte-i0dpsc");
  			add_location(h1, file$o, 71, 2, 1907);
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h1, anchor);
  			append_dev(h1, t0);
  			insert_dev(target, t1, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(target, anchor);
  			}

  			insert_dev(target, each_1_anchor, anchor);
  		},
  		p: function update(changed, ctx) {
  			if (changed.Object || changed.credits) {
  				each_value_1 = Object.entries(ctx.sub1);
  				let i;

  				for (i = 0; i < each_value_1.length; i += 1) {
  					const child_ctx = get_each_context_1(ctx, each_value_1, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  					} else {
  						each_blocks[i] = create_each_block_1(child_ctx);
  						each_blocks[i].c();
  						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
  					}
  				}

  				for (; i < each_blocks.length; i += 1) {
  					each_blocks[i].d(1);
  				}

  				each_blocks.length = each_value_1.length;
  			}
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h1);
  			if (detaching) detach_dev(t1);
  			destroy_each(each_blocks, detaching);
  			if (detaching) detach_dev(each_1_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_each_block$7.name,
  		type: "each",
  		source: "(71:0) {#each Object.entries(credits) as [h1, sub1]}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$o(ctx) {
  	let div;
  	let scroller_action;
  	let each_value = Object.entries(ctx.credits);
  	let each_blocks = [];

  	for (let i = 0; i < each_value.length; i += 1) {
  		each_blocks[i] = create_each_block$7(get_each_context$7(ctx, each_value, i));
  	}

  	const block = {
  		c: function create() {
  			div = element("div");

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].c();
  			}

  			attr_dev(div, "class", "credits svelte-i0dpsc");
  			add_location(div, file$o, 69, 0, 1824);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);

  			for (let i = 0; i < each_blocks.length; i += 1) {
  				each_blocks[i].m(div, null);
  			}

  			scroller_action = scroller.call(null, div) || ({});
  		},
  		p: function update(changed, ctx) {
  			if (changed.Object || changed.credits) {
  				each_value = Object.entries(ctx.credits);
  				let i;

  				for (i = 0; i < each_value.length; i += 1) {
  					const child_ctx = get_each_context$7(ctx, each_value, i);

  					if (each_blocks[i]) {
  						each_blocks[i].p(changed, child_ctx);
  					} else {
  						each_blocks[i] = create_each_block$7(child_ctx);
  						each_blocks[i].c();
  						each_blocks[i].m(div, null);
  					}
  				}

  				for (; i < each_blocks.length; i += 1) {
  					each_blocks[i].d(1);
  				}

  				each_blocks.length = each_value.length;
  			}
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			destroy_each(each_blocks, detaching);
  			if (scroller_action && is_function(scroller_action.destroy)) scroller_action.destroy();
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$o.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$n($$self) {
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
  			Programmer: { Glaive: `mailto:glaive@earthrock.run` },
  			Operations: {
  				"These Are All": `mailto:pseudonyms@earthrock.run`
  			}
  		},
  		External: {
  			Assets: { Kenney: `http://assetjesus.com` },
  			Services: { GitHub: `http://github.com/` },
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
  		"Thank You": {}
  	};

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		
  	};

  	return { credits };
  }

  class Credits extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$n, create_fragment$o, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Credits",
  			options,
  			id: create_fragment$o.name
  		});
  	}
  }

  /* src/ui/app/app.svelte generated by Svelte v3.14.1 */
  const file$p = "src/ui/app/app.svelte";

  function create_fragment$p(ctx) {
  	let t0;
  	let t1;
  	let div;
  	let current;
  	var switch_value = ctx.$view;

  	function switch_props(ctx) {
  		return { $$inline: true };
  	}

  	if (switch_value) {
  		var switch_instance = new switch_value(switch_props());
  	}

  	const tools = new Tools({ $$inline: true });

  	const tile = new Tile_1({
  			props: { random: true, width: 5, height: 5 },
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			if (switch_instance) create_component(switch_instance.$$.fragment);
  			t0 = space();
  			create_component(tools.$$.fragment);
  			t1 = space();
  			div = element("div");
  			create_component(tile.$$.fragment);
  			attr_dev(div, "class", "background svelte-1yk8nt3");
  			add_location(div, file$p, 26, 0, 590);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if (switch_instance) {
  				mount_component(switch_instance, target, anchor);
  			}

  			insert_dev(target, t0, anchor);
  			mount_component(tools, target, anchor);
  			insert_dev(target, t1, anchor);
  			insert_dev(target, div, anchor);
  			mount_component(tile, div, null);
  			current = true;
  		},
  		p: function update(changed, ctx) {
  			if (switch_value !== (switch_value = ctx.$view)) {
  				if (switch_instance) {
  					group_outros();
  					const old_component = switch_instance;

  					transition_out(old_component.$$.fragment, 1, 0, () => {
  						destroy_component(old_component, 1);
  					});

  					check_outros();
  				}

  				if (switch_value) {
  					switch_instance = new switch_value(switch_props());
  					create_component(switch_instance.$$.fragment);
  					transition_in(switch_instance.$$.fragment, 1);
  					mount_component(switch_instance, t0.parentNode, t0);
  				} else {
  					switch_instance = null;
  				}
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
  			transition_in(tools.$$.fragment, local);
  			transition_in(tile.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
  			transition_out(tools.$$.fragment, local);
  			transition_out(tile.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (switch_instance) destroy_component(switch_instance, detaching);
  			if (detaching) detach_dev(t0);
  			destroy_component(tools, detaching);
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(div);
  			destroy_component(tile);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$p.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$o($$self, $$props, $$invalidate) {
  	let $view;

  	const paths = {
  		cards: Design,
  		weave: Weave$2,
  		credits: Credits
  	};

  	const view = derived(path, ([$path]) => paths[$path[0]] || Intro);
  	validate_store(view, "view");
  	component_subscribe($$self, view, value => $$invalidate("$view", $view = value));

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		if ("$view" in $$props) view.set($view = $$props.$view);
  	};

  	return { view, $view };
  }

  class App extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init$1(this, options, instance$o, create_fragment$p, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "App",
  			options,
  			id: create_fragment$p.name
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

}(cuid, exprEval, twgl, Tone, Color));
//# sourceMappingURL=bundle.js.map
