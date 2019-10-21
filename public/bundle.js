
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
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
    function subscribe(component, store, callback) {
        const unsub = store.subscribe(callback);
        component.$$.on_destroy.push(unsub.unsubscribe
            ? () => unsub.unsubscribe()
            : unsub);
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
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value) {
        node.style.setProperty(key, value);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            remaining: 0,
            callbacks: []
        };
    }
    function check_outros() {
        if (!outros.remaining) {
            run_all(outros.callbacks);
        }
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
            outros.callbacks.push(() => {
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
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
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
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
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
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
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
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
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

    /* src\Tiles.svelte generated by Svelte v3.6.6 */

    const file = "src\\Tiles.svelte";

    function create_fragment(ctx) {
    	var img;

    	return {
    		c: function create() {
    			img = element("img");
    			attr(img, "class", "tileset svelte-1bdmb53");
    			attr(img, "alt", "tileset image");
    			add_location(img, file, 106, 0, 2545);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, img, anchor);
    			ctx.img_binding(img);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(img);
    			}

    			ctx.img_binding(null);
    		}
    	};
    }

    const SIZE = 16;

    const SPACING = 1;

    const COLUMNS = 32;

    const COUNT = 1024;

    function instance($$self, $$props, $$invalidate) {
    	const repo = new Map();

    const ready = new Promise((resolve) => {
        const tiles = new Image();
        tiles.src = "/sheets/default.png";

        tiles.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = tiles.width;
            canvas.height = tiles.height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(tiles, 0, 0);

            resolve({ctx, canvas});
        };
    });

    let { data = "", width = 10, height = 7, spacing = 0, random = false } = $$props;
    let image;

    const num_random = (min, max) => 
        Math.floor(Math.random() * (Math.abs(min) + Math.abs(max)) - Math.abs(min));

    const randomize = (data_ctx, canvas) => {
        let t_x, t_y;
        let s_x, s_y;

        for(let x = 0; x < width; x++) {
            for(let y = 0; y < height; y++) {
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
    };

    onMount(async () => {
        const { canvas } = await ready;

        if(repo.has(key)) {
            image.src = repo.get(key); $$invalidate('image', image);
            return
        }

        let data_canvas = document.createElement("canvas");
        const data_ctx = data_canvas.getContext("2d");
        
        data_canvas.width = SIZE * width;
        data_canvas.height = SIZE * height;

        if(random) {
            randomize(data_ctx, canvas);
        } else if(data.length > 0) {
            
            let x, y;
            data.split(" ").forEach((loc, i) => {
                x = i % width;
                y = Math.floor(i / width);

                let idx = parseInt(loc, 10);
                let o_x = idx % COLUMNS; 
                let o_y = Math.floor(idx / COLUMNS);

                let t_x = x * SIZE; 
                let t_y = y * SIZE;
                
                let s_x = o_x * (SIZE + SPACING);
                let s_y = o_y * (SIZE + SPACING);

                data_ctx.drawImage(
                    canvas, 
                    s_x, s_y, SIZE, SIZE, 
                    t_x, t_y, SIZE, SIZE
                );
            });

        }

        image.src = data_canvas.toDataURL('image/png'); $$invalidate('image', image);
        repo.set(KeyboardEvent, image.src);
    });

    	const writable_props = ['data', 'width', 'height', 'spacing', 'random'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Tiles> was created with unknown prop '${key}'`);
    	});

    	function img_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('image', image = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ('data' in $$props) $$invalidate('data', data = $$props.data);
    		if ('width' in $$props) $$invalidate('width', width = $$props.width);
    		if ('height' in $$props) $$invalidate('height', height = $$props.height);
    		if ('spacing' in $$props) $$invalidate('spacing', spacing = $$props.spacing);
    		if ('random' in $$props) $$invalidate('random', random = $$props.random);
    	};

    	let key;

    	$$self.$$.update = ($$dirty = { width: 1, height: 1, data: 1 }) => {
    		if ($$dirty.width || $$dirty.height || $$dirty.data) { key = `${width}:${height}:${data}`; }
    	};

    	return {
    		data,
    		width,
    		height,
    		spacing,
    		random,
    		image,
    		img_binding
    	};
    }

    class Tiles extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["data", "width", "height", "spacing", "random"]);
    	}

    	get data() {
    		throw new Error("<Tiles>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<Tiles>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get width() {
    		throw new Error("<Tiles>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Tiles>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Tiles>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Tiles>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get spacing() {
    		throw new Error("<Tiles>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set spacing(value) {
    		throw new Error("<Tiles>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get random() {
    		throw new Error("<Tiles>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set random(value) {
    		throw new Error("<Tiles>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Intro.svelte generated by Svelte v3.6.6 */

    const file$1 = "src\\Intro.svelte";

    function create_fragment$1(ctx) {
    	var div0, t0, h1, t2, h2, t4, button, t6, div1, current, dispose;

    	var tiles = new Tiles({ props: { random: true }, $$inline: true });

    	return {
    		c: function create() {
    			div0 = element("div");
    			tiles.$$.fragment.c();
    			t0 = space();
    			h1 = element("h1");
    			h1.textContent = "EarthRock";
    			t2 = space();
    			h2 = element("h2");
    			h2.textContent = "The Uncollectable Card Game";
    			t4 = space();
    			button = element("button");
    			button.textContent = "START";
    			t6 = space();
    			div1 = element("div");
    			div1.textContent = "We don't use cookies or store anything about you server side.";
    			attr(div0, "class", "background svelte-1ks0xde");
    			add_location(div0, file$1, 72, 0, 1208);
    			attr(h1, "class", "title svelte-1ks0xde");
    			add_location(h1, file$1, 76, 0, 1265);
    			attr(h2, "class", "desc svelte-1ks0xde");
    			add_location(h2, file$1, 77, 0, 1299);
    			attr(button, "class", "svelte-1ks0xde");
    			add_location(button, file$1, 79, 0, 1352);
    			attr(div1, "class", "notice svelte-1ks0xde");
    			add_location(div1, file$1, 81, 0, 1399);
    			dispose = listen(button, "click", ctx.clicked);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div0, anchor);
    			mount_component(tiles, div0, null);
    			insert(target, t0, anchor);
    			insert(target, h1, anchor);
    			insert(target, t2, anchor);
    			insert(target, h2, anchor);
    			insert(target, t4, anchor);
    			insert(target, button, anchor);
    			insert(target, t6, anchor);
    			insert(target, div1, anchor);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			transition_in(tiles.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(tiles.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div0);
    			}

    			destroy_component(tiles, );

    			if (detaching) {
    				detach(t0);
    				detach(h1);
    				detach(t2);
    				detach(h2);
    				detach(t4);
    				detach(button);
    				detach(t6);
    				detach(div1);
    			}

    			dispose();
    		}
    	};
    }

    function instance$1($$self) {
    	

    const clicked = () => {
        alert("Woah there speedy aint got nothing more yet");
    };

    	return { clicked };
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
    	}
    }

    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (!stop) {
                    return; // not ready
                }
                subscribers.forEach((s) => s[1]());
                subscribers.forEach((s) => s[0](value));
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
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

    const TILE_MAX = 1024;
    const NAME_MAX = 5;
    const COST_MAX = 10;
    const EFFECT_MAX = 3;
    const DECK_SIZE = 30;
    const HAND_SIZE_INIT = 7;

    // width * height
    const IMAGE_COUNT = 10 * 10; 
    const BACK_COUNT = 3 * 5;

    // shitty shitty uuid generator but good nuff for our server fake
    const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      
    const tile_random = (count) => {
        const tiles = [];
        for(let i = 0; i < count; i++) {
            tiles.push(Math.floor(Math.random() * TILE_MAX));
        }

        return tiles.join(" ")
    };

    const card_random = () => ({
        id: uuidv4(),
        name: tile_random(NAME_MAX),
        image: tile_random(IMAGE_COUNT),
        cost: Math.floor(Math.random() * COST_MAX),
        effect1: tile_random(EFFECT_MAX),
        effect2: tile_random(EFFECT_MAX),
        effect3: tile_random(EFFECT_MAX)
    });

    const cards_random = (count) => {
        const cards = [];
        for(let i = 0; i < count; i++) {
            cards.push(card_random());
        }

        return cards
    };

    const server_fake = (game) => {
        const tasks = {
            ERROR_404: () => ({
                code: 404,
                text: 'TaSk NoT FoUnD'
            })
        };

        // Setup Game State
        game.do({
            task: 'STATE',
            data: {
                away_deck: cards_random(DECK_SIZE),
                home_deck: cards_random(DECK_SIZE),
                away_hand: cards_random(HAND_SIZE_INIT),
                home_hand: cards_random(HAND_SIZE_INIT),
                away_back: tile_random(BACK_COUNT),
                home_back: tile_random(BACK_COUNT)
            }
        });
       
        return ({
            task,
            data
        }) => {
            if(!tasks[task]) {
                return tasks.ERROR_404()
            }

            return tasks[task](data)
        }
    };

    const game = {
        faked: false,
        tasks: {
            STATE: new Set(),
        },

        state: {
            away_deck: writable([]),
            away_hand: writable([]),
            away_discard: writable([]),
            away_field: writable([]),
            away_back: writable(""),
            home_deck: writable([]),
            home_hand: writable([]),
            home_discard: writable([]),
            home_field: writable([]),
            home_back: writable("")
        },

        // fake out game rules for testing
        server_fake: () => {
            game.faked = server_fake(game);
        },

        do: ({
            task,
            data
        }) => {
            if(game.tasks[task] === undefined) {
                console.error(`Tried to call an undefined task ${task}`);
                return 
            }

            game.tasks[task].forEach((fn) => fn(data));
        },

        do_server: async (action) => {
            if(game.faked) {
                return game.faked(action) 
            }

            const response = await fetch('/do', {
                method: 'POST',
                mode: 'same-origin',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(action)
            });

            return response.json()
        },

        when: (task, callback) => {
            if(game.tasks[task] === undefined) {
                console.error(`Tried to wait for an undefined task ${task}`);
                return 
            }

            game.tasks[task].add(callback);

            return () => {
                game.tasks[task].delete(callback);
            }
        }
    };

    // Replicate STATE actions to the state stores
    game.when('STATE', (changes) => 
        Object.entries(changes).forEach(([key, value]) => 
            game.state[key].set(value)
        )
    );

    /* src\Card.svelte generated by Svelte v3.6.6 */

    const file$2 = "src\\Card.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.line = list[i];
    	return child_ctx;
    }

    // (125:8) {#if borders}
    function create_if_block(ctx) {
    	var div0, t0, div1, t1, div2, t2, div3;

    	return {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = space();
    			div3 = element("div");
    			attr(div0, "class", "border border-top svelte-k754m3");
    			add_location(div0, file$2, 125, 8, 2859);
    			attr(div1, "class", "border border-bottom svelte-k754m3");
    			add_location(div1, file$2, 126, 8, 2902);
    			attr(div2, "class", "border border-left svelte-k754m3");
    			add_location(div2, file$2, 127, 8, 2948);
    			attr(div3, "class", "border border-right svelte-k754m3");
    			add_location(div3, file$2, 128, 8, 2992);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			insert(target, t1, anchor);
    			insert(target, div2, anchor);
    			insert(target, t2, anchor);
    			insert(target, div3, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div0);
    				detach(t0);
    				detach(div1);
    				detach(t1);
    				detach(div2);
    				detach(t2);
    				detach(div3);
    			}
    		}
    	};
    }

    // (156:16) {#each lines as line}
    function create_each_block(ctx) {
    	var div5, div1, div0, t0, div4, div2, t1, t2_value = ctx.vitals[0], t2, t3, div3, t4, t5_value = ctx.vitals[1], t5, current;

    	var tiles0 = new Tiles({
    		props: {
    		width: 1,
    		height: 1,
    		random: true
    	},
    		$$inline: true
    	});

    	var tiles1 = new Tiles({
    		props: {
    		width: 1,
    		height: 1,
    		random: true
    	},
    		$$inline: true
    	});

    	var tiles2 = new Tiles({
    		props: {
    		width: 1,
    		height: 1,
    		random: true
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			div5 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			tiles0.$$.fragment.c();
    			t0 = space();
    			div4 = element("div");
    			div2 = element("div");
    			tiles1.$$.fragment.c();
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			div3 = element("div");
    			tiles2.$$.fragment.c();
    			t4 = space();
    			t5 = text(t5_value);
    			attr(div0, "class", "tile svelte-k754m3");
    			add_location(div0, file$2, 158, 24, 4018);
    			attr(div1, "class", "icon svelte-k754m3");
    			add_location(div1, file$2, 157, 20, 3974);
    			attr(div2, "class", "tile svelte-k754m3");
    			add_location(div2, file$2, 163, 24, 4231);
    			attr(div3, "class", "tile svelte-k754m3");
    			add_location(div3, file$2, 167, 24, 4411);
    			attr(div4, "class", "vitals svelte-k754m3");
    			add_location(div4, file$2, 162, 20, 4185);
    			attr(div5, "class", "line svelte-k754m3");
    			add_location(div5, file$2, 156, 16, 3934);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, div1);
    			append(div1, div0);
    			mount_component(tiles0, div0, null);
    			append(div5, t0);
    			append(div5, div4);
    			append(div4, div2);
    			mount_component(tiles1, div2, null);
    			append(div4, t1);
    			append(div4, t2);
    			append(div4, t3);
    			append(div4, div3);
    			mount_component(tiles2, div3, null);
    			append(div4, t4);
    			append(div4, t5);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if ((!current || changed.vitals) && t2_value !== (t2_value = ctx.vitals[0])) {
    				set_data(t2, t2_value);
    			}

    			if ((!current || changed.vitals) && t5_value !== (t5_value = ctx.vitals[1])) {
    				set_data(t5, t5_value);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(tiles0.$$.fragment, local);

    			transition_in(tiles1.$$.fragment, local);

    			transition_in(tiles2.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(tiles0.$$.fragment, local);
    			transition_out(tiles1.$$.fragment, local);
    			transition_out(tiles2.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div5);
    			}

    			destroy_component(tiles0, );

    			destroy_component(tiles1, );

    			destroy_component(tiles2, );
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	var div11, div10, t0, div0, t1, div9, div4, div1, t2, div2, t3, div3, t4, t5, div5, t6, div7, t7, div6, t8, div8, current, dispose;

    	var if_block = (ctx.borders) && create_if_block();

    	var tiles0 = new Tiles({
    		props: {
    		width: 3,
    		height: 5,
    		data: ctx.back
    	},
    		$$inline: true
    	});

    	var tiles1 = new Tiles({
    		props: {
    		data: ctx.name,
    		width: 5,
    		height: 1
    	},
    		$$inline: true
    	});

    	var tiles2 = new Tiles({
    		props: {
    		width: 10,
    		height: 10,
    		data: ctx.image
    	},
    		$$inline: true
    	});

    	var each_value = ctx.lines;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c: function create() {
    			div11 = element("div");
    			div10 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			tiles0.$$.fragment.c();
    			t1 = space();
    			div9 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			tiles1.$$.fragment.c();
    			t2 = space();
    			div2 = element("div");
    			t3 = space();
    			div3 = element("div");
    			t4 = text(ctx.cost);
    			t5 = space();
    			div5 = element("div");
    			tiles2.$$.fragment.c();
    			t6 = space();
    			div7 = element("div");

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			div6 = element("div");
    			t8 = space();
    			div8 = element("div");
    			div8.textContent = "E A R T H R O C K";
    			attr(div0, "class", "back svelte-k754m3");
    			set_style(div0, "filter", "sepia(1) hue-rotate(" + ctx.color + "deg)");
    			add_location(div0, file$2, 131, 8, 3054);
    			attr(div1, "class", "title svelte-k754m3");
    			add_location(div1, file$2, 141, 16, 3411);
    			attr(div2, "class", "flex svelte-k754m3");
    			add_location(div2, file$2, 148, 16, 3635);
    			attr(div3, "class", "cost svelte-k754m3");
    			add_location(div3, file$2, 149, 16, 3677);
    			attr(div4, "class", "header svelte-k754m3");
    			add_location(div4, file$2, 140, 12, 3373);
    			attr(div5, "class", "image svelte-k754m3");
    			add_location(div5, file$2, 151, 12, 3741);
    			attr(div6, "class", "flex svelte-k754m3");
    			add_location(div6, file$2, 174, 16, 4660);
    			attr(div7, "class", "details svelte-k754m3");
    			add_location(div7, file$2, 154, 12, 3856);
    			attr(div8, "class", "earthrock svelte-k754m3");
    			add_location(div8, file$2, 176, 12, 4718);
    			attr(div9, "class", "front svelte-k754m3");
    			add_location(div9, file$2, 139, 8, 3281);
    			attr(div10, "class", "contents svelte-k754m3");
    			toggle_class(div10, "flip", ctx.flip);
    			add_location(div10, file$2, 123, 4, 2793);
    			attr(div11, "style", ctx.style);
    			attr(div11, "class", "card svelte-k754m3");
    			toggle_class(div11, "dragging", ctx.dragging);
    			add_location(div11, file$2, 122, 0, 2683);

    			dispose = [
    				listen(div0, "click", ctx.beginInteract),
    				listen(div9, "mousedown", ctx.beginInteract),
    				listen(div9, "mouseup", ctx.stopInteract),
    				listen(div11, "mouseenter", ctx.delay_hover.on),
    				listen(div11, "mouseleave", ctx.delay_hover.off)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div11, anchor);
    			append(div11, div10);
    			if (if_block) if_block.m(div10, null);
    			append(div10, t0);
    			append(div10, div0);
    			mount_component(tiles0, div0, null);
    			append(div10, t1);
    			append(div10, div9);
    			append(div9, div4);
    			append(div4, div1);
    			mount_component(tiles1, div1, null);
    			append(div4, t2);
    			append(div4, div2);
    			append(div4, t3);
    			append(div4, div3);
    			append(div3, t4);
    			append(div9, t5);
    			append(div9, div5);
    			mount_component(tiles2, div5, null);
    			append(div9, t6);
    			append(div9, div7);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div7, null);
    			}

    			append(div7, t7);
    			append(div7, div6);
    			append(div9, t8);
    			append(div9, div8);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.borders) {
    				if (!if_block) {
    					if_block = create_if_block();
    					if_block.c();
    					if_block.m(div10, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			var tiles0_changes = {};
    			if (changed.back) tiles0_changes.data = ctx.back;
    			tiles0.$set(tiles0_changes);

    			if (!current || changed.color) {
    				set_style(div0, "filter", "sepia(1) hue-rotate(" + ctx.color + "deg)");
    			}

    			var tiles1_changes = {};
    			if (changed.name) tiles1_changes.data = ctx.name;
    			tiles1.$set(tiles1_changes);

    			if (!current || changed.cost) {
    				set_data(t4, ctx.cost);
    			}

    			var tiles2_changes = {};
    			if (changed.image) tiles2_changes.data = ctx.image;
    			tiles2.$set(tiles2_changes);

    			if (changed.vitals || changed.lines) {
    				each_value = ctx.lines;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div7, t7);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) out(i);
    				check_outros();
    			}

    			if (changed.flip) {
    				toggle_class(div10, "flip", ctx.flip);
    			}

    			if (!current || changed.style) {
    				attr(div11, "style", ctx.style);
    			}

    			if (changed.dragging) {
    				toggle_class(div11, "dragging", ctx.dragging);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(tiles0.$$.fragment, local);

    			transition_in(tiles1.$$.fragment, local);

    			transition_in(tiles2.$$.fragment, local);

    			for (var i = 0; i < each_value.length; i += 1) transition_in(each_blocks[i]);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(tiles0.$$.fragment, local);
    			transition_out(tiles1.$$.fragment, local);
    			transition_out(tiles2.$$.fragment, local);

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) transition_out(each_blocks[i]);

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div11);
    			}

    			if (if_block) if_block.d();

    			destroy_component(tiles0, );

    			destroy_component(tiles1, );

    			destroy_component(tiles2, );

    			destroy_each(each_blocks, detaching);

    			run_all(dispose);
    		}
    	};
    }

    const DRAG_SCALE = 0.5;

    function instance$2($$self, $$props, $$invalidate) {
    	let $mouse_pos;

    	

    // Card Data
    let { deck = ``, id = "foobar", cost = 0, name = "16 55 33 44 55", image = "", effect1 = "", effect2 = "", effect3 = "", back = "", borders = true, vitals = [1, 1], invert = false, interact = true, drag = false, position = [0, 0], rotation = 0, scale = 1, color = 90, card = {}, onclick = () => {} } = $$props;
    let { young = true } = $$props;

    const lines = [effect1, effect2, effect3];
    const mouse_pos = writable([0, 0]); validate_store(mouse_pos, 'mouse_pos'); subscribe($$self, mouse_pos, $$value => { $mouse_pos = $$value; $$invalidate('$mouse_pos', $mouse_pos); });
    const mouse_raw = [0, 0];

    window.addEventListener("mousemove", (e) => {
        mouse_raw[0] = e.clientX;    mouse_raw[1] = e.clientY;});

    setInterval(() => {
        if(mouse_raw[0] !== $mouse_pos[0] || mouse_raw[1] !== $mouse_pos[1]) {
            mouse_pos.set([...mouse_raw]);
        }
    }, 50);

    let flip = true;
    onMount(() => {
        setTimeout(() => {
            $$invalidate('young', young = false);
            $$invalidate('flip', flip = !interact);
        }, 1000);
    });

    const delay = ({
        time = 250,
        on = () => {},
        off = () => {}
    }) => {
        let timeout;
        
        return {
            on: () => {
                if(!interact) {
                    return
                }
                if(timeout) {
                    clearTimeout(timeout);
                }
                on();
            },
            off: () => {
                if(!interact) {
                    return
                }
                if(timeout) {
                    clearTimeout(timeout);
                }

                timeout = setTimeout(() => {
                    timeout = 0;
                    off();
                }, time);
            }
        }
    };

    let dragging = false;
    const beginInteract = () => {
        onclick();
        if(drag) {
            $$invalidate('dragging', dragging = true);
        }
        return
    };

    const stopInteract = () => {
        $$invalidate('dragging', dragging = false);
        return
    };

    const delay_hover = delay({
        time: 250,
        on: () => {
            $$invalidate('hover', hover = true);
        },
        off: () => { const $$result = hover = false; $$invalidate('hover', hover); return $$result; }
    });

    let hover = false;

    	const writable_props = ['deck', 'id', 'cost', 'name', 'image', 'effect1', 'effect2', 'effect3', 'back', 'borders', 'vitals', 'invert', 'interact', 'drag', 'position', 'rotation', 'scale', 'color', 'card', 'onclick', 'young'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('deck' in $$props) $$invalidate('deck', deck = $$props.deck);
    		if ('id' in $$props) $$invalidate('id', id = $$props.id);
    		if ('cost' in $$props) $$invalidate('cost', cost = $$props.cost);
    		if ('name' in $$props) $$invalidate('name', name = $$props.name);
    		if ('image' in $$props) $$invalidate('image', image = $$props.image);
    		if ('effect1' in $$props) $$invalidate('effect1', effect1 = $$props.effect1);
    		if ('effect2' in $$props) $$invalidate('effect2', effect2 = $$props.effect2);
    		if ('effect3' in $$props) $$invalidate('effect3', effect3 = $$props.effect3);
    		if ('back' in $$props) $$invalidate('back', back = $$props.back);
    		if ('borders' in $$props) $$invalidate('borders', borders = $$props.borders);
    		if ('vitals' in $$props) $$invalidate('vitals', vitals = $$props.vitals);
    		if ('invert' in $$props) $$invalidate('invert', invert = $$props.invert);
    		if ('interact' in $$props) $$invalidate('interact', interact = $$props.interact);
    		if ('drag' in $$props) $$invalidate('drag', drag = $$props.drag);
    		if ('position' in $$props) $$invalidate('position', position = $$props.position);
    		if ('rotation' in $$props) $$invalidate('rotation', rotation = $$props.rotation);
    		if ('scale' in $$props) $$invalidate('scale', scale = $$props.scale);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('card' in $$props) $$invalidate('card', card = $$props.card);
    		if ('onclick' in $$props) $$invalidate('onclick', onclick = $$props.onclick);
    		if ('young' in $$props) $$invalidate('young', young = $$props.young);
    	};

    	let tru_scale, style;

    	$$self.$$.update = ($$dirty = { hover: 1, scale: 1, dragging: 1, $mouse_pos: 1, position: 1, invert: 1, rotation: 1, tru_scale: 1 }) => {
    		if ($$dirty.hover || $$dirty.scale) { $$invalidate('tru_scale', tru_scale = hover ? scale * 1.168 : scale); }
    		if ($$dirty.dragging || $$dirty.$mouse_pos || $$dirty.position || $$dirty.hover || $$dirty.invert || $$dirty.rotation || $$dirty.tru_scale) { $$invalidate('style', style = dragging 
                ? `transform: translate(${$mouse_pos[0] - window.innerWidth/2 - 250}px, ${$mouse_pos[1] - window.innerHeight/2 - 400}px) rotate(0deg) scale(${DRAG_SCALE});z-index: 100`
                : `transform: translate(${-50 + position[0]}%, ${-50 + position[1] + (hover ? (invert ? 5 : -5) : 0)}%) rotate(${rotation}deg) scale(${tru_scale}) ; z-index: ${Math.round(tru_scale * 100)}`); }
    	};

    	return {
    		deck,
    		id,
    		cost,
    		name,
    		image,
    		effect1,
    		effect2,
    		effect3,
    		back,
    		borders,
    		vitals,
    		invert,
    		interact,
    		drag,
    		position,
    		rotation,
    		scale,
    		color,
    		card,
    		onclick,
    		young,
    		lines,
    		mouse_pos,
    		flip,
    		dragging,
    		beginInteract,
    		stopInteract,
    		delay_hover,
    		style
    	};
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["deck", "id", "cost", "name", "image", "effect1", "effect2", "effect3", "back", "borders", "vitals", "invert", "interact", "drag", "position", "rotation", "scale", "color", "card", "onclick", "young"]);
    	}

    	get deck() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set deck(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cost() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cost(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get image() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get effect1() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set effect1(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get effect2() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set effect2(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get effect3() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set effect3(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get back() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set back(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get borders() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set borders(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vitals() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vitals(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get invert() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set invert(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get interact() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set interact(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get drag() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set drag(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get position() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set position(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotation() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotation(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scale() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scale(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get card() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set card(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onclick() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onclick(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get young() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set young(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Hand.svelte generated by Svelte v3.6.6 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.card = list[i];
    	child_ctx.index = i;
    	return child_ctx;
    }

    // (31:4) {#if index < max}
    function create_if_block$1(ctx) {
    	var current;

    	var card_spread_levels = [
    		ctx.card,
    		{ scale: ctx.scale },
    		{ invert: ctx.invert },
    		{ interact: ctx.interact },
    		{ color: ctx.color },
    		{ onclick: ctx.onclick },
    		{ card: ctx.card },
    		{ drag: ctx.drag },
    		{ back: ctx.$back },
    		{ position: [
                        ctx.index * ctx.tru_spread * ctx.scale - ctx.tru_length/2 * ctx.tru_spread * ctx.scale + ctx.position[0], 
                        ctx.position[1] + (ctx.invert ? -1 : 1) * Math.abs((ctx.index - ctx.tru_length/2)) * ctx.spread_y
                    ] },
    		{ rotation: (ctx.index - ctx.tru_length/2) * ctx.tru_rotate * (ctx.invert ? -1 : 1) + (ctx.invert ? 180 : 0) }
    	];

    	let card_props = {};
    	for (var i = 0; i < card_spread_levels.length; i += 1) {
    		card_props = assign(card_props, card_spread_levels[i]);
    	}
    	var card = new Card({ props: card_props, $$inline: true });

    	return {
    		c: function create() {
    			card.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var card_changes = (changed.$cards || changed.scale || changed.invert || changed.interact || changed.color || changed.onclick || changed.drag || changed.$back || changed.tru_spread || changed.tru_length || changed.position || changed.spread_y || changed.tru_rotate) ? get_spread_update(card_spread_levels, [
    				(changed.$cards) && ctx.card,
    				(changed.scale) && { scale: ctx.scale },
    				(changed.invert) && { invert: ctx.invert },
    				(changed.interact) && { interact: ctx.interact },
    				(changed.color) && { color: ctx.color },
    				(changed.onclick) && { onclick: ctx.onclick },
    				(changed.$cards) && { card: ctx.card },
    				(changed.drag) && { drag: ctx.drag },
    				(changed.$back) && { back: ctx.$back },
    				(changed.$cards || changed.tru_spread || changed.scale || changed.tru_length || changed.position || changed.invert || changed.spread_y) && { position: [
                        ctx.index * ctx.tru_spread * ctx.scale - ctx.tru_length/2 * ctx.tru_spread * ctx.scale + ctx.position[0], 
                        ctx.position[1] + (ctx.invert ? -1 : 1) * Math.abs((ctx.index - ctx.tru_length/2)) * ctx.spread_y
                    ] },
    				(changed.$cards || changed.tru_length || changed.tru_rotate || changed.invert) && { rotation: (ctx.index - ctx.tru_length/2) * ctx.tru_rotate * (ctx.invert ? -1 : 1) + (ctx.invert ? 180 : 0) }
    			]) : {};
    			card.$set(card_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};
    }

    // (30:0) {#each $cards as card, index (card.id)}
    function create_each_block$1(key_1, ctx) {
    	var first, if_block_anchor, current;

    	var if_block = (ctx.index < ctx.max) && create_if_block$1(ctx);

    	return {
    		key: key_1,

    		first: null,

    		c: function create() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},

    		m: function mount(target, anchor) {
    			insert(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.index < ctx.max) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block$1(ctx);
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
    			if (detaching) {
    				detach(first);
    			}

    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	var each_blocks = [], each_1_lookup = new Map(), each_1_anchor, current;

    	var each_value = ctx.$cards;

    	const get_key = ctx => ctx.card.id;

    	for (var i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	return {
    		c: function create() {
    			for (i = 0; i < each_blocks.length; i += 1) each_blocks[i].c();

    			each_1_anchor = empty();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			for (i = 0; i < each_blocks.length; i += 1) each_blocks[i].m(target, anchor);

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			const each_value = ctx.$cards;

    			group_outros();
    			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block$1, each_1_anchor, get_each_context$1);
    			check_outros();
    		},

    		i: function intro(local) {
    			if (current) return;
    			for (var i = 0; i < each_value.length; i += 1) transition_in(each_blocks[i]);

    			current = true;
    		},

    		o: function outro(local) {
    			for (i = 0; i < each_blocks.length; i += 1) transition_out(each_blocks[i]);

    			current = false;
    		},

    		d: function destroy(detaching) {
    			for (i = 0; i < each_blocks.length; i += 1) each_blocks[i].d(detaching);

    			if (detaching) {
    				detach(each_1_anchor);
    			}
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $cards, $back;

    	

    let { cards = writable([]), max = 10, position = [0, 0], invert = false, scale = 1, drag = false, spread = 16.18, spread_y = 2, interact = true, count_factor = 30, rotate = 16.18, color = 90, onclick = () => {} } = $$props; validate_store(cards, 'cards'); subscribe($$self, cards, $$value => { $cards = $$value; $$invalidate('$cards', $cards); });
    let { back = writable(``) } = $$props; validate_store(back, 'back'); subscribe($$self, back, $$value => { $back = $$value; $$invalidate('$back', $back); });

    	const writable_props = ['cards', 'max', 'position', 'invert', 'scale', 'drag', 'spread', 'spread_y', 'interact', 'count_factor', 'rotate', 'color', 'onclick', 'back'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Hand> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('cards' in $$props) $$invalidate('cards', cards = $$props.cards);
    		if ('max' in $$props) $$invalidate('max', max = $$props.max);
    		if ('position' in $$props) $$invalidate('position', position = $$props.position);
    		if ('invert' in $$props) $$invalidate('invert', invert = $$props.invert);
    		if ('scale' in $$props) $$invalidate('scale', scale = $$props.scale);
    		if ('drag' in $$props) $$invalidate('drag', drag = $$props.drag);
    		if ('spread' in $$props) $$invalidate('spread', spread = $$props.spread);
    		if ('spread_y' in $$props) $$invalidate('spread_y', spread_y = $$props.spread_y);
    		if ('interact' in $$props) $$invalidate('interact', interact = $$props.interact);
    		if ('count_factor' in $$props) $$invalidate('count_factor', count_factor = $$props.count_factor);
    		if ('rotate' in $$props) $$invalidate('rotate', rotate = $$props.rotate);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('onclick' in $$props) $$invalidate('onclick', onclick = $$props.onclick);
    		if ('back' in $$props) $$invalidate('back', back = $$props.back);
    	};

    	let tru_length, x_factor, tru_spread, tru_rotate;

    	$$self.$$.update = ($$dirty = { $cards: 1, max: 1, count_factor: 1, spread: 1, x_factor: 1, rotate: 1 }) => {
    		if ($$dirty.$cards || $$dirty.max) { $$invalidate('tru_length', tru_length = ($cards.length > max ? max : $cards.length)); }
    		if ($$dirty.$cards || $$dirty.count_factor) { $$invalidate('x_factor', x_factor = ($cards.length / count_factor)); }
    		if ($$dirty.spread || $$dirty.x_factor) { $$invalidate('tru_spread', tru_spread = spread / x_factor); }
    		if ($$dirty.rotate || $$dirty.x_factor) { $$invalidate('tru_rotate', tru_rotate = rotate * x_factor); }
    	};

    	return {
    		cards,
    		max,
    		position,
    		invert,
    		scale,
    		drag,
    		spread,
    		spread_y,
    		interact,
    		count_factor,
    		rotate,
    		color,
    		onclick,
    		back,
    		tru_length,
    		$cards,
    		tru_spread,
    		tru_rotate,
    		$back
    	};
    }

    class Hand extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, ["cards", "max", "position", "invert", "scale", "drag", "spread", "spread_y", "interact", "count_factor", "rotate", "color", "onclick", "back"]);
    	}

    	get cards() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cards(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get position() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set position(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get invert() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set invert(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scale() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scale(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get drag() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set drag(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get spread() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set spread(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get spread_y() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set spread_y(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get interact() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set interact(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get count_factor() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set count_factor(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onclick() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onclick(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get back() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set back(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Board.svelte generated by Svelte v3.6.6 */

    function create_fragment$4(ctx) {
    	var t0, t1, t2, current;

    	var hand0 = new Hand({
    		props: {
    		cards: game.state.home_hand,
    		scale: scale,
    		position: [0, 40],
    		back: game.state.home_back,
    		drag: true
    	},
    		$$inline: true
    	});

    	var hand1 = new Hand({
    		props: {
    		cards: game.state.away_hand,
    		scale: scale,
    		position: [0, -40],
    		interact: false,
    		color: 180,
    		invert: true,
    		back: game.state.away_back
    	},
    		$$inline: true
    	});

    	var hand2_spread_levels = [
    		ctx.deck,
    		{ cards: game.state.home_deck },
    		{ position: [90, 40] },
    		{ back: game.state.home_back }
    	];

    	let hand2_props = {};
    	for (var i = 0; i < hand2_spread_levels.length; i += 1) {
    		hand2_props = assign(hand2_props, hand2_spread_levels[i]);
    	}
    	var hand2 = new Hand({ props: hand2_props, $$inline: true });

    	var hand3_spread_levels = [
    		{ invert: true },
    		ctx.deck,
    		{ cards: game.state.away_deck },
    		{ color: 180 },
    		{ position: [90, -40] },
    		{ back: game.state.away_back }
    	];

    	let hand3_props = {};
    	for (var i = 0; i < hand3_spread_levels.length; i += 1) {
    		hand3_props = assign(hand3_props, hand3_spread_levels[i]);
    	}
    	var hand3 = new Hand({ props: hand3_props, $$inline: true });

    	return {
    		c: function create() {
    			hand0.$$.fragment.c();
    			t0 = space();
    			hand1.$$.fragment.c();
    			t1 = space();
    			hand2.$$.fragment.c();
    			t2 = space();
    			hand3.$$.fragment.c();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(hand0, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(hand1, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(hand2, target, anchor);
    			insert(target, t2, anchor);
    			mount_component(hand3, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var hand0_changes = {};
    			if (changed.game) hand0_changes.cards = game.state.home_hand;
    			if (changed.scale) hand0_changes.scale = scale;
    			if (changed.game) hand0_changes.back = game.state.home_back;
    			hand0.$set(hand0_changes);

    			var hand1_changes = {};
    			if (changed.game) hand1_changes.cards = game.state.away_hand;
    			if (changed.scale) hand1_changes.scale = scale;
    			if (changed.game) hand1_changes.back = game.state.away_back;
    			hand1.$set(hand1_changes);

    			var hand2_changes = (changed.deck || changed.game) ? get_spread_update(hand2_spread_levels, [
    				(changed.deck) && ctx.deck,
    				(changed.game) && { cards: game.state.home_deck },
    				{ position: [90, 40] },
    				(changed.game) && { back: game.state.home_back }
    			]) : {};
    			hand2.$set(hand2_changes);

    			var hand3_changes = (changed.deck || changed.game) ? get_spread_update(hand3_spread_levels, [
    				{ invert: true },
    				(changed.deck) && ctx.deck,
    				(changed.game) && { cards: game.state.away_deck },
    				{ color: 180 },
    				{ position: [90, -40] },
    				(changed.game) && { back: game.state.away_back }
    			]) : {};
    			hand3.$set(hand3_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(hand0.$$.fragment, local);

    			transition_in(hand1.$$.fragment, local);

    			transition_in(hand2.$$.fragment, local);

    			transition_in(hand3.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(hand0.$$.fragment, local);
    			transition_out(hand1.$$.fragment, local);
    			transition_out(hand2.$$.fragment, local);
    			transition_out(hand3.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(hand0, detaching);

    			if (detaching) {
    				detach(t0);
    			}

    			destroy_component(hand1, detaching);

    			if (detaching) {
    				detach(t1);
    			}

    			destroy_component(hand2, detaching);

    			if (detaching) {
    				detach(t2);
    			}

    			destroy_component(hand3, detaching);
    		}
    	};
    }

    const scale = 0.25;

    function instance$4($$self) {
    	

    const deck = {
    	scale,
        spread: 0,
        max: 4,
        count_factor: 250,
    	interact: false 
    };

    game.server_fake();

    	return { deck };
    }

    class Board extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, []);
    	}
    }

    /* src\Sound.svelte generated by Svelte v3.6.6 */

    const file$3 = "src\\Sound.svelte";

    function create_fragment$5(ctx) {
    	var div, t_value = ctx.playing ? '🕪' : '🕨', t, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr(div, "class", "sound svelte-niubn2");
    			add_location(div, file$3, 17, 0, 284);
    			dispose = listen(div, "click", ctx.toggle);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.playing) && t_value !== (t_value = ctx.playing ? '🕪' : '🕨')) {
    				set_data(t, t_value);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			dispose();
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	const audio = new Audio("/music/earthrock-final-theme.mp3");
    audio.loop = true;audio.volume = 0.5;let playing = false;

    const toggle = () => {
        if(playing) {
            audio.pause();
        } else {
            audio.play();
        }

        $$invalidate('playing', playing = !playing);
    };

    	return { playing, toggle };
    }

    class Sound extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, []);
    	}
    }

    /* src\App.svelte generated by Svelte v3.6.6 */

    function create_fragment$6(ctx) {
    	var t0, t1, current;

    	var intro = new Intro({ $$inline: true });

    	var sound = new Sound({ $$inline: true });

    	var board = new Board({ $$inline: true });

    	return {
    		c: function create() {
    			intro.$$.fragment.c();
    			t0 = space();
    			sound.$$.fragment.c();
    			t1 = space();
    			board.$$.fragment.c();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(intro, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(sound, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(board, target, anchor);
    			current = true;
    		},

    		p: noop,

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);

    			transition_in(sound.$$.fragment, local);

    			transition_in(board.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			transition_out(sound.$$.fragment, local);
    			transition_out(board.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(intro, detaching);

    			if (detaching) {
    				detach(t0);
    			}

    			destroy_component(sound, detaching);

    			if (detaching) {
    				detach(t1);
    			}

    			destroy_component(board, detaching);
    		}
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$6, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'stage'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
