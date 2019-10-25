
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = cb => requestAnimationFrame(cb);

    const tasks = new Set();
    let running = false;
    function run_tasks() {
        tasks.forEach(task => {
            if (!task[0](now())) {
                tasks.delete(task);
                task[1]();
            }
        });
        running = tasks.size > 0;
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
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
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = current_component;
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
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.remaining += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config;
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
                        if (!--group.remaining) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.callbacks);
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
    /**
     * Get the current value from a store by subscribing and immediately unsubscribing.
     * @param store readable
     */
    function get_store_value(store) {
        let value;
        const unsubscribe = store.subscribe(_ => value = _);
        if (unsubscribe.unsubscribe)
            unsubscribe.unsubscribe();
        else
            unsubscribe();
        return value;
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

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
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

    /* src\element\Intro.svelte generated by Svelte v3.6.6 */

    const file = "src\\element\\Intro.svelte";

    function create_fragment(ctx) {
    	var div1, h1, t1, h2, t3, button, t5, div0, div1_outro, current, dispose;

    	return {
    		c: function create() {
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "EarthRock";
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "The Uncollectable Card Game";
    			t3 = space();
    			button = element("button");
    			button.textContent = "START";
    			t5 = space();
    			div0 = element("div");
    			div0.textContent = "We don't use cookies or store anything about you server side.";
    			attr(h1, "class", "title svelte-ai31ys");
    			add_location(h1, file, 71, 0, 1252);
    			attr(h2, "class", "desc svelte-ai31ys");
    			add_location(h2, file, 72, 0, 1286);
    			attr(button, "class", "svelte-ai31ys");
    			add_location(button, file, 74, 0, 1339);
    			attr(div0, "class", "notice svelte-ai31ys");
    			add_location(div0, file, 76, 0, 1402);
    			attr(div1, "class", "intro svelte-ai31ys");
    			add_location(div1, file, 70, 0, 1150);
    			dispose = listen(button, "click", ctx.click_handler);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, h1);
    			append(div1, t1);
    			append(div1, h2);
    			append(div1, t3);
    			append(div1, button);
    			append(div1, t5);
    			append(div1, div0);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			if (div1_outro) div1_outro.end(1);

    			current = true;
    		},

    		o: function outro(local) {
    			div1_outro = create_out_transition(div1, fly, {delay: 100, duration:1000, x: 0, y: 4000, opacity: 0, easing: identity});

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
    				if (div1_outro) div1_outro.end();
    			}

    			dispose();
    		}
    	};
    }

    function instance($$self) {
    	

    const dispatch = createEventDispatcher();

    	function click_handler() {
    		return dispatch("start");
    	}

    	return { dispatch, click_handler };
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, []);
    	}
    }

    const IS_DEV = window.location.host === "localhost:5000";

    /* src\element\Tools.svelte generated by Svelte v3.6.6 */

    const file$1 = "src\\element\\Tools.svelte";

    // (29:4) {#if playing}
    function create_if_block(ctx) {
    	var div, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			div.textContent = "X";
    			attr(div, "class", "svelte-1uluz44");
    			add_location(div, file$1, 29, 8, 590);
    			dispose = listen(div, "click", ctx.click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var div1, div0, t0_value = ctx.audo_playing ? '<>' : '>', t0, t1, dispose;

    	var if_block = (ctx.playing) && create_if_block(ctx);

    	return {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			attr(div0, "class", "svelte-1uluz44");
    			add_location(div0, file$1, 25, 4, 489);
    			attr(div1, "class", "tools svelte-1uluz44");
    			add_location(div1, file$1, 24, 0, 464);
    			dispose = listen(div0, "click", ctx.toggle);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, t0);
    			append(div1, t1);
    			if (if_block) if_block.m(div1, null);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.audo_playing) && t0_value !== (t0_value = ctx.audo_playing ? '<>' : '>')) {
    				set_data(t0, t0_value);
    			}

    			if (ctx.playing) {
    				if (!if_block) {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
    			}

    			if (if_block) if_block.d();
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	

    let { playing = false } = $$props;
    const dispatch = createEventDispatcher();
    const audio = new Audio("/music/earthrock-final-theme.mp3");
    audio.loop = true;audio.volume = 0.5;let audo_playing = false;

    const toggle = () => {
        if(audo_playing) {
            audio.pause();
        } else {
            audio.play();
        }

        $$invalidate('audo_playing', audo_playing = !audo_playing);
    };

    	const writable_props = ['playing'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Tools> was created with unknown prop '${key}'`);
    	});

    	function click_handler() {
    		return dispatch("end");
    	}

    	$$self.$set = $$props => {
    		if ('playing' in $$props) $$invalidate('playing', playing = $$props.playing);
    	};

    	return {
    		playing,
    		dispatch,
    		audo_playing,
    		toggle,
    		click_handler
    	};
    }

    class Tools extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["playing"]);
    	}

    	get playing() {
    		throw new Error("<Tools>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set playing(value) {
    		throw new Error("<Tools>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
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

    const scaling = writable(1);

    const scale = () => {
        const [ width, height ] = [window.innerWidth, window.innerHeight];

        const target = width > height ? height : width;
        // try to peg 10 cards always\
        // ^ well that is a lie. magic numbers below
        scaling.set(target/(500 * 2));
    };

    window.addEventListener("resize", scale);

    scale();

    /* src\element\Spatial.svelte generated by Svelte v3.6.6 */

    const file$2 = "src\\element\\Spatial.svelte";

    function create_fragment$2(ctx) {
    	var div, current;

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, null);

    	return {
    		c: function create() {
    			div = element("div");

    			if (default_slot) default_slot.c();

    			attr(div, "class", "spatial svelte-fablq");
    			attr(div, "style", ctx.style);
    			add_location(div, file$2, 28, 0, 816);
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(div_nodes);
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}

    			if (!current || changed.style) {
    				attr(div, "style", ctx.style);
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
    			if (detaching) {
    				detach(div);
    			}

    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { position = [0, 0], anchor = [50, 50], bias = [50, 50], area = [1, 1], scale = 1, rotate = 0 } = $$props;

    	const writable_props = ['position', 'anchor', 'bias', 'area', 'scale', 'rotate'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Spatial> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ('position' in $$props) $$invalidate('position', position = $$props.position);
    		if ('anchor' in $$props) $$invalidate('anchor', anchor = $$props.anchor);
    		if ('bias' in $$props) $$invalidate('bias', bias = $$props.bias);
    		if ('area' in $$props) $$invalidate('area', area = $$props.area);
    		if ('scale' in $$props) $$invalidate('scale', scale = $$props.scale);
    		if ('rotate' in $$props) $$invalidate('rotate', rotate = $$props.rotate);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	let offset, transform, zIndex, style;

    	$$self.$$.update = ($$dirty = { anchor: 1, bias: 1, area: 1, position: 1, offset: 1, rotate: 1, scale: 1, zIndex: 1, transform: 1 }) => {
    		if ($$dirty.anchor) { $$invalidate('anchor', anchor = [
                (anchor[0] <= 50 ? `left: ${anchor[0]}%;` : `right: ${100 - anchor[0]}%;`),
                (anchor[1] <= 50 ? `top: ${anchor[1]}%;` : `bottom: ${100 - anchor[1]}%;`)
            ].join(" ")); }
    		if ($$dirty.bias || $$dirty.area || $$dirty.anchor) { $$invalidate('offset', offset = [
                bias[0] * .01 * area[0] / 2 * (anchor[0] <= 50 ? -1 : 1),
                bias[1] * .01 * area[1] / 2 * (anchor[1] <= 50 ? -1 : 1)
            ]); }
    		if ($$dirty.position || $$dirty.offset || $$dirty.rotate || $$dirty.scale) { $$invalidate('transform', transform = `transform: translate(${position[0] + offset[0]}px, ${position[1] + offset[1]}px); rotate(${rotate}deg) scale(${scale * scaling});`); }
    		if ($$dirty.scale) { $$invalidate('zIndex', zIndex = `z-index: ${Math.round(scale * 100)};`); }
    		if ($$dirty.zIndex || $$dirty.anchor || $$dirty.transform) { $$invalidate('style', style = [zIndex, anchor, transform].join(" ")); }
    	};

    	return {
    		position,
    		anchor,
    		bias,
    		area,
    		scale,
    		rotate,
    		style,
    		$$slots,
    		$$scope
    	};
    }

    class Spatial extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["position", "anchor", "bias", "area", "scale", "rotate"]);
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
    }

    const TILE_MAX = 1024;
    const NAME_MAX = 5;
    const COST_MAX = 10;
    const EFFECT_MAX = 3;
    const DECK_SIZE = 30;
    const HAND_SIZE_INIT = 5;

    // width * height
    const IMAGE_COUNT = 5 * 5;
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
        const state = {
            away_deck: cards_random(DECK_SIZE),
            home_deck: cards_random(DECK_SIZE),
            away_hand: cards_random(HAND_SIZE_INIT),
            home_hand: cards_random(HAND_SIZE_INIT),
            away_back: tile_random(BACK_COUNT),
            home_back: tile_random(BACK_COUNT),
            home_discard: [],
            home_gems: 0,
            away_discard: [],
            away_gems: 0
        };

        const tasks = {
            PLAY: ({
                id
            }) => {
                const {
                    home_hand,
                    home_discard
                } = state;

                for(let i = 0; i < state.home_hand.length; i++) {
                    const card = state.home_hand[i];

                    if(card.id === id) {
                        home_hand.splice(i, 1);
                        home_discard.unshift(card);
                        game.do({
                            task: 'STATE',
                            data: {
                                home_hand,
                                home_discard
                            }
                        });
                        return tasks.SUCCESS()
                    }
                }
            },
            DRAW: () => {
                const { home_deck, home_hand } = state;

                home_hand.push(home_deck.pop());

                game.do({
                    task: 'STATE',
                    data: {
                        home_deck,
                        home_hand
                    }
                });

                return tasks.SUCCESS()
            },
            SUCCESS: () => ({
                code: 200,
                text: 'SuCcEsS'
            }),
            ERROR_404: () => ({
                code: 404,
                text: 'TaSk NoT FoUnD'
            })
        };

        // Setup Game State
        game.do({
            task: 'STATE',
            data: state
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
            home_back: writable(""),
            home_gems: writable(0),
            away_gems: writable(0)
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

    const mouse_pos = writable([0, 0]);
    const mouse_raw = [0, 0];

    window.addEventListener("mousemove", (e) => {
        mouse_raw[0] = e.clientX;
        mouse_raw[1] = e.clientY;


        if(mouse_raw[0] !== get_store_value(mouse_pos)[0] || mouse_raw[1] !== get_store_value(mouse_pos)[1]) {
            mouse_pos.set([...mouse_raw]);
        }
    });

    const SIZE = 16;
    const SPACING = 1;
    const COLUMNS = 32;
    const COUNT = 1024;

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

        if(!random && repo.has(key)) {
            return repo.get(key)
        }

        let data_canvas = document.createElement("canvas");
        const data_ctx = data_canvas.getContext("2d");

        data_canvas.width = SIZE * width;
        data_canvas.height = SIZE * height;

        if(random) {
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

        const result = data_canvas.toDataURL('image/png');
        if(!random) {
            repo.set(KeyboardEvent, result);
        }

        return result
    };

    /* src\element\Tiles.svelte generated by Svelte v3.6.6 */

    const file$3 = "src\\element\\Tiles.svelte";

    function create_fragment$3(ctx) {
    	var img;

    	return {
    		c: function create() {
    			img = element("img");
    			attr(img, "class", "tileset svelte-1bdmb53");
    			attr(img, "alt", "tileset image");
    			add_location(img, file$3, 23, 0, 363);
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

    function instance$3($$self, $$props, $$invalidate) {
    	

    let { data = "", width = 10, height = 7, spacing = 0, random = false } = $$props;

    let image;

    onMount(async () => {
        image.src = await Tile({
            width, 
            height, 
            data,
            random
        }); $$invalidate('image', image);
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, ["data", "width", "height", "spacing", "random"]);
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

    /* src\element\Card.svelte generated by Svelte v3.6.6 */

    const file$4 = "src\\element\\Card.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.line = list[i];
    	return child_ctx;
    }

    // (133:8) {#if borders}
    function create_if_block$1(ctx) {
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
    			attr(div0, "class", "border border-top svelte-1k8whng");
    			add_location(div0, file$4, 133, 8, 3640);
    			attr(div1, "class", "border border-bottom svelte-1k8whng");
    			add_location(div1, file$4, 134, 8, 3683);
    			attr(div2, "class", "border border-left svelte-1k8whng");
    			add_location(div2, file$4, 135, 8, 3729);
    			attr(div3, "class", "border border-right svelte-1k8whng");
    			add_location(div3, file$4, 136, 8, 3773);
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

    // (164:16) {#each lines as line}
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
    			attr(div0, "class", "tile svelte-1k8whng");
    			add_location(div0, file$4, 166, 24, 4798);
    			attr(div1, "class", "icon svelte-1k8whng");
    			add_location(div1, file$4, 165, 20, 4754);
    			attr(div2, "class", "tile svelte-1k8whng");
    			add_location(div2, file$4, 171, 24, 5011);
    			attr(div3, "class", "tile svelte-1k8whng");
    			add_location(div3, file$4, 175, 24, 5191);
    			attr(div4, "class", "vitals svelte-1k8whng");
    			add_location(div4, file$4, 170, 20, 4965);
    			attr(div5, "class", "line svelte-1k8whng");
    			add_location(div5, file$4, 164, 16, 4714);
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

    function create_fragment$4(ctx) {
    	var div11, div10, t0, div0, t1, div9, div4, div1, t2, div2, t3, div3, t4, t5, div5, t6, div7, t7, div6, t8, div8, current, dispose;

    	var if_block = (ctx.borders) && create_if_block$1();

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
    		width: 5,
    		height: 5,
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
    			attr(div0, "class", "back svelte-1k8whng");
    			set_style(div0, "filter", "sepia(1) hue-rotate(" + ctx.color + "deg) brightness(" + (ctx.fade ? 0.5 : 1) + ")");
    			add_location(div0, file$4, 139, 8, 3835);
    			attr(div1, "class", "title svelte-1k8whng");
    			add_location(div1, file$4, 149, 16, 4193);
    			attr(div2, "class", "flex svelte-1k8whng");
    			add_location(div2, file$4, 156, 16, 4417);
    			attr(div3, "class", "cost svelte-1k8whng");
    			add_location(div3, file$4, 157, 16, 4459);
    			attr(div4, "class", "header svelte-1k8whng");
    			add_location(div4, file$4, 148, 12, 4155);
    			attr(div5, "class", "image svelte-1k8whng");
    			add_location(div5, file$4, 159, 12, 4523);
    			attr(div6, "class", "flex svelte-1k8whng");
    			add_location(div6, file$4, 182, 16, 5440);
    			attr(div7, "class", "details svelte-1k8whng");
    			add_location(div7, file$4, 162, 12, 4636);
    			attr(div8, "class", "earthrock svelte-1k8whng");
    			add_location(div8, file$4, 184, 12, 5498);
    			attr(div9, "class", "front svelte-1k8whng");
    			add_location(div9, file$4, 147, 8, 4091);
    			attr(div10, "class", "contents svelte-1k8whng");
    			toggle_class(div10, "flip", ctx.flip);
    			add_location(div10, file$4, 131, 4, 3574);
    			attr(div11, "style", ctx.style);
    			attr(div11, "class", "card svelte-1k8whng");
    			toggle_class(div11, "fade", ctx.fade);
    			toggle_class(div11, "dragging", ctx.dragging);
    			add_location(div11, file$4, 130, 0, 3453);

    			dispose = [
    				listen(div0, "click", ctx.beginInteract),
    				listen(div9, "mousedown", ctx.beginInteract),
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
    					if_block = create_if_block$1();
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

    			if (!current || changed.color || changed.fade) {
    				set_style(div0, "filter", "sepia(1) hue-rotate(" + ctx.color + "deg) brightness(" + (ctx.fade ? 0.5 : 1) + ")");
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

    			if (changed.fade) {
    				toggle_class(div11, "fade", ctx.fade);
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

    function instance$4($$self, $$props, $$invalidate) {
    	let $mouse_pos;

    	validate_store(mouse_pos, 'mouse_pos');
    	subscribe($$self, mouse_pos, $$value => { $mouse_pos = $$value; $$invalidate('$mouse_pos', $mouse_pos); });

    	

    const dispatch = createEventDispatcher();

    // Card Data
    let { deck = ``, id = "foobar", cost = 0, name = "16 55 33 44 55", image = "", effect1 = "", effect2 = "", effect3 = "", back = "", borders = true, vitals = [1, 1], invert = false, interact = true, drag = false, position = [0, 0], position_raw = false, rotation = 0, scale = 1, color = 90, card = {}, young = true, fade = false, anchor = [50, 50] } = $$props;

    const lines = [effect1, effect2, effect3];

    let flip = true;
    onMount(() => {
        setTimeout(() => {
            $$invalidate('young', young = false);
            $$invalidate('flip', flip = !interact);
        }, 250);
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
        dispatch('click', card);

        if(drag) {
            $$invalidate('dragging', dragging = true);
            const id = window.addEventListener("mouseup", () => {
                dispatch('dragend', card);
                $$invalidate('dragging', dragging = false);
                window.removeEventListener("mouseup", id);
            });
        }

        return
    };

    const delay_hover = delay({
        time: 100,
        on: () => {
            $$invalidate('hover', hover = true);
        },
        off: () => { const $$result = hover = false; $$invalidate('hover', hover); return $$result; }
    });

    let hover = false;

    	const writable_props = ['deck', 'id', 'cost', 'name', 'image', 'effect1', 'effect2', 'effect3', 'back', 'borders', 'vitals', 'invert', 'interact', 'drag', 'position', 'position_raw', 'rotation', 'scale', 'color', 'card', 'young', 'fade', 'anchor'];
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
    		if ('position_raw' in $$props) $$invalidate('position_raw', position_raw = $$props.position_raw);
    		if ('rotation' in $$props) $$invalidate('rotation', rotation = $$props.rotation);
    		if ('scale' in $$props) $$invalidate('scale', scale = $$props.scale);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('card' in $$props) $$invalidate('card', card = $$props.card);
    		if ('young' in $$props) $$invalidate('young', young = $$props.young);
    		if ('fade' in $$props) $$invalidate('fade', fade = $$props.fade);
    		if ('anchor' in $$props) $$invalidate('anchor', anchor = $$props.anchor);
    	};

    	let tru_scale, tru_rotation, tru_invert, tru_anchor, tru_width, tru_height, transforms, style;

    	$$self.$$.update = ($$dirty = { hover: 1, scale: 1, rotation: 1, invert: 1, dragging: 1, anchor: 1, tru_anchor: 1, $mouse_pos: 1, tru_width: 1, tru_height: 1, position_raw: 1, tru_rotation: 1, tru_scale: 1, position: 1, tru_invert: 1, transforms: 1 }) => {
    		if ($$dirty.hover || $$dirty.scale) { $$invalidate('tru_scale', tru_scale = (hover ? scale * 1.168 : scale)); }
    		if ($$dirty.hover || $$dirty.rotation) { $$invalidate('tru_rotation', tru_rotation = hover ? 0 : rotation); }
    		if ($$dirty.invert) { $$invalidate('tru_invert', tru_invert = invert ? -1 : 1); }
    		if ($$dirty.dragging || $$dirty.anchor) { $$invalidate('tru_anchor', tru_anchor = dragging ? [50, 50] : anchor); }
    		if ($$dirty.tru_anchor) { $$invalidate('tru_width', tru_width = 250 * (tru_anchor[0] <= 50 ? -1 : 1)); }
    		if ($$dirty.tru_anchor) { $$invalidate('tru_height', tru_height = 400 * (tru_anchor[1] <= 50 ? -1 : 1)); }
    		if ($$dirty.dragging || $$dirty.$mouse_pos || $$dirty.tru_width || $$dirty.tru_height || $$dirty.position_raw || $$dirty.tru_rotation || $$dirty.tru_scale || $$dirty.position || $$dirty.hover || $$dirty.tru_invert) { $$invalidate('transforms', transforms = dragging 
                ? `transform: translate(${$mouse_pos[0] - window.innerWidth/2 + tru_width}px, ${$mouse_pos[1] - window.innerHeight/2 + tru_height}px) rotate(0deg) scale(${DRAG_SCALE});z-index: 100`
                : position_raw 
                    ? `transform: translate(${position_raw[0] - window.innerWidth/2 - tru_width}px, ${position_raw[1] - window.innerHeight/2 - tru_height}px) rotate(${tru_rotation}deg) scale(${tru_scale}) ; z-index: ${Math.round(tru_scale * 100)}`
                    : `transform: translate(${position[0] * 5 + tru_width}px, ${(position[1] + (hover ? tru_invert * -5 : 0)) * 8 +  tru_height}px) rotate(${tru_rotation}deg) scale(${tru_scale}) ; z-index: ${Math.round(tru_scale * 100)}`); }
    		if ($$dirty.transforms || $$dirty.tru_anchor) { $$invalidate('style', style = [
                transforms,
                (tru_anchor[0] <= 50 ?  `left: ${tru_anchor[0]}%` : `right: ${100 - tru_anchor[0]}%`),
                (tru_anchor[1] <= 50 ?  `top: ${tru_anchor[1]}%` : `bottom: ${100 - tru_anchor[1]}%`)
            ].join(';')); }
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
    		position_raw,
    		rotation,
    		scale,
    		color,
    		card,
    		young,
    		fade,
    		anchor,
    		lines,
    		flip,
    		dragging,
    		beginInteract,
    		delay_hover,
    		style
    	};
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, ["deck", "id", "cost", "name", "image", "effect1", "effect2", "effect3", "back", "borders", "vitals", "invert", "interact", "drag", "position", "position_raw", "rotation", "scale", "color", "card", "young", "fade", "anchor"]);
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

    	get position_raw() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set position_raw(value) {
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

    	get young() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set young(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fade() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fade(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get anchor() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set anchor(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\element\Hand.svelte generated by Svelte v3.6.6 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.card = list[i];
    	child_ctx.index = i;
    	return child_ctx;
    }

    // (37:4) {#if tru_index(index) < max}
    function create_if_block$2(ctx) {
    	var current;

    	var card_spread_levels = [
    		ctx.card,
    		{ scale: ctx.scale * ctx.$scaling },
    		{ invert: ctx.invert },
    		{ interact: ctx.interact },
    		{ color: ctx.color },
    		{ card: ctx.card },
    		{ drag: ctx.drag },
    		{ fade: ctx.fade },
    		{ anchor: ctx.anchor },
    		{ back: ctx.$back },
    		{ position: ctx.Math.abs(ctx.rotation) === 90
                    ?
                     [
                        ctx.position[0], 
                        ctx.position[1] + ctx.tru_index(ctx.index) * ctx.tru_spread - ctx.tru_length/2 * ctx.tru_spread
                     ]
                    : [
                        ctx.position[0] + ctx.tru_index(ctx.index) * ctx.tru_spread - ctx.tru_length/2 * ctx.tru_spread, 
                        ctx.position[1] +  (ctx.invert ? -1 : 1) * ctx.Math.abs((ctx.tru_index(ctx.index) - ctx.tru_length/2)) * ctx.spread_y
                    ] },
    		{ rotation: ctx.rotation + (ctx.tru_index(ctx.index) - ctx.tru_length/2) * ctx.tru_rotate * (ctx.invert ? -1 : 1) + (ctx.invert ? 180 : 0) }
    	];

    	let card_props = {};
    	for (var i = 0; i < card_spread_levels.length; i += 1) {
    		card_props = assign(card_props, card_spread_levels[i]);
    	}
    	var card = new Card({ props: card_props, $$inline: true });
    	card.$on("dragend", ctx.dragend_handler);
    	card.$on("click", ctx.click_handler);

    	return {
    		c: function create() {
    			card.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var card_changes = (changed.$cards || changed.scale || changed.$scaling || changed.invert || changed.interact || changed.color || changed.drag || changed.fade || changed.anchor || changed.$back || changed.Math || changed.rotation || changed.position || changed.tru_index || changed.tru_spread || changed.tru_length || changed.spread_y || changed.tru_rotate) ? get_spread_update(card_spread_levels, [
    				(changed.$cards) && ctx.card,
    				(changed.scale || changed.$scaling) && { scale: ctx.scale * ctx.$scaling },
    				(changed.invert) && { invert: ctx.invert },
    				(changed.interact) && { interact: ctx.interact },
    				(changed.color) && { color: ctx.color },
    				(changed.$cards) && { card: ctx.card },
    				(changed.drag) && { drag: ctx.drag },
    				(changed.fade) && { fade: ctx.fade },
    				(changed.anchor) && { anchor: ctx.anchor },
    				(changed.$back) && { back: ctx.$back },
    				(changed.Math || changed.rotation || changed.position || changed.tru_index || changed.$cards || changed.tru_spread || changed.tru_length || changed.invert || changed.spread_y) && { position: ctx.Math.abs(ctx.rotation) === 90
                    ?
                     [
                        ctx.position[0], 
                        ctx.position[1] + ctx.tru_index(ctx.index) * ctx.tru_spread - ctx.tru_length/2 * ctx.tru_spread
                     ]
                    : [
                        ctx.position[0] + ctx.tru_index(ctx.index) * ctx.tru_spread - ctx.tru_length/2 * ctx.tru_spread, 
                        ctx.position[1] +  (ctx.invert ? -1 : 1) * ctx.Math.abs((ctx.tru_index(ctx.index) - ctx.tru_length/2)) * ctx.spread_y
                    ] },
    				(changed.rotation || changed.tru_index || changed.$cards || changed.tru_length || changed.tru_rotate || changed.invert) && { rotation: ctx.rotation + (ctx.tru_index(ctx.index) - ctx.tru_length/2) * ctx.tru_rotate * (ctx.invert ? -1 : 1) + (ctx.invert ? 180 : 0) }
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

    // (36:0) {#each $cards as card, index (card.id)}
    function create_each_block$1(key_1, ctx) {
    	var first, if_block_anchor, current;

    	var if_block = (ctx.tru_index(ctx.index) < ctx.max) && create_if_block$2(ctx);

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
    			if (ctx.tru_index(ctx.index) < ctx.max) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block$2(ctx);
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

    function create_fragment$5(ctx) {
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

    function instance$5($$self, $$props, $$invalidate) {
    	let $cards, $scaling, $back;

    	validate_store(scaling, 'scaling');
    	subscribe($$self, scaling, $$value => { $scaling = $$value; $$invalidate('$scaling', $scaling); });

    	

    const dispatch = createEventDispatcher();

    let { cards = writable([]), max = 10, position = [0, 0], anchor = [50, 50], invert = false, fade = false, drag = false, reverse = false, scale = 1, spread = 10, spread_y = 1, interact = true, rotate = 3, rotation = 0, color = 90 } = $$props; validate_store(cards, 'cards'); subscribe($$self, cards, $$value => { $cards = $$value; $$invalidate('$cards', $cards); });
    let { back = writable(``) } = $$props; validate_store(back, 'back'); subscribe($$self, back, $$value => { $back = $$value; $$invalidate('$back', $back); });

    const tru_index = (index) => reverse ? $cards.length - index : index;

    	const writable_props = ['cards', 'max', 'position', 'anchor', 'invert', 'fade', 'drag', 'reverse', 'scale', 'spread', 'spread_y', 'interact', 'rotate', 'rotation', 'color', 'back'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Hand> was created with unknown prop '${key}'`);
    	});

    	function dragend_handler({ detail }) {
    		return dispatch('dragend', detail);
    	}

    	function click_handler({ detail }) {
    		return dispatch('click', detail);
    	}

    	$$self.$set = $$props => {
    		if ('cards' in $$props) $$invalidate('cards', cards = $$props.cards);
    		if ('max' in $$props) $$invalidate('max', max = $$props.max);
    		if ('position' in $$props) $$invalidate('position', position = $$props.position);
    		if ('anchor' in $$props) $$invalidate('anchor', anchor = $$props.anchor);
    		if ('invert' in $$props) $$invalidate('invert', invert = $$props.invert);
    		if ('fade' in $$props) $$invalidate('fade', fade = $$props.fade);
    		if ('drag' in $$props) $$invalidate('drag', drag = $$props.drag);
    		if ('reverse' in $$props) $$invalidate('reverse', reverse = $$props.reverse);
    		if ('scale' in $$props) $$invalidate('scale', scale = $$props.scale);
    		if ('spread' in $$props) $$invalidate('spread', spread = $$props.spread);
    		if ('spread_y' in $$props) $$invalidate('spread_y', spread_y = $$props.spread_y);
    		if ('interact' in $$props) $$invalidate('interact', interact = $$props.interact);
    		if ('rotate' in $$props) $$invalidate('rotate', rotate = $$props.rotate);
    		if ('rotation' in $$props) $$invalidate('rotation', rotation = $$props.rotation);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('back' in $$props) $$invalidate('back', back = $$props.back);
    	};

    	let tru_length, x_factor, tru_spread, tru_rotate;

    	$$self.$$.update = ($$dirty = { $cards: 1, max: 1, tru_length: 1, spread: 1, x_factor: 1, $scaling: 1, rotate: 1 }) => {
    		if ($$dirty.$cards || $$dirty.max) { $$invalidate('tru_length', tru_length = ($cards.length > max ? max : $cards.length)); }
    		if ($$dirty.tru_length || $$dirty.max) { $$invalidate('x_factor', x_factor = Math.max(tru_length / max, 0.5)); }
    		if ($$dirty.spread || $$dirty.x_factor || $$dirty.$scaling) { $$invalidate('tru_spread', tru_spread = spread / x_factor * $scaling); }
    		if ($$dirty.rotate || $$dirty.x_factor) { $$invalidate('tru_rotate', tru_rotate = rotate / x_factor); }
    	};

    	return {
    		dispatch,
    		cards,
    		max,
    		position,
    		anchor,
    		invert,
    		fade,
    		drag,
    		reverse,
    		scale,
    		spread,
    		spread_y,
    		interact,
    		rotate,
    		rotation,
    		color,
    		back,
    		tru_index,
    		tru_length,
    		$cards,
    		Math,
    		tru_spread,
    		$scaling,
    		tru_rotate,
    		$back,
    		dragend_handler,
    		click_handler
    	};
    }

    class Hand extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, ["cards", "max", "position", "anchor", "invert", "fade", "drag", "reverse", "scale", "spread", "spread_y", "interact", "rotate", "rotation", "color", "back"]);
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

    	get anchor() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set anchor(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get invert() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set invert(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fade() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fade(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get drag() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set drag(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get reverse() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set reverse(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scale() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scale(value) {
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

    	get rotate() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotation() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotation(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get back() {
    		throw new Error("<Hand>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set back(value) {
    		throw new Error("<Hand>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\element\Gems.svelte generated by Svelte v3.6.6 */

    const file$5 = "src\\element\\Gems.svelte";

    function create_fragment$6(ctx) {
    	var div;

    	return {
    		c: function create() {
    			div = element("div");
    			attr(div, "class", "gems");
    			add_location(div, file$5, 3, 0, 23);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    class Gems extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$6, safe_not_equal, []);
    	}
    }

    /* src\element\Game.svelte generated by Svelte v3.6.6 */

    const file$6 = "src\\element\\Game.svelte";

    // (122:0) <Spatial anchor = {[90, 90]}>
    function create_default_slot(ctx) {
    	var current;

    	var gems = new Gems({
    		props: { count: game.state.home_gems },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			gems.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(gems, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var gems_changes = {};
    			if (changed.game) gems_changes.count = game.state.home_gems;
    			gems.$set(gems_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(gems.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(gems.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(gems, detaching);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	var div, t0, t1, t2, t3, t4, t5, t6, t7, div_outro, current;

    	var hand0 = new Hand({
    		props: {
    		cards: game.state.home_hand,
    		scale: scale$1,
    		position: [0, 0],
    		back: game.state.home_back,
    		drag: true,
    		anchor: [50, 90]
    	},
    		$$inline: true
    	});
    	hand0.$on("dragend", ctx.dragend_handler);

    	var hand1_spread_levels = [
    		ctx.deck,
    		{ anchor: [90, 70] },
    		{ cards: game.state.home_deck },
    		{ position: [0, 0] },
    		{ back: game.state.home_back }
    	];

    	let hand1_props = {};
    	for (var i = 0; i < hand1_spread_levels.length; i += 1) {
    		hand1_props = assign(hand1_props, hand1_spread_levels[i]);
    	}
    	var hand1 = new Hand({ props: hand1_props, $$inline: true });
    	hand1.$on("click", ctx.click_handler);

    	var hand2 = new Hand({
    		props: {
    		cards: ctx.play_home,
    		position: [0, 0],
    		anchor: [50, 50],
    		scale: "0.4",
    		back: game.state.home_back
    	},
    		$$inline: true
    	});

    	var hand3 = new Hand({
    		props: {
    		cards: ctx.play_away,
    		position: [0, 0],
    		anchor: [50, 50],
    		scale: "0.4",
    		back: game.state.away_back
    	},
    		$$inline: true
    	});

    	var hand4_spread_levels = [
    		ctx.discard,
    		{ cards: game.state.home_discard },
    		{ position: [0, 0] },
    		{ anchor: [0, 90] },
    		{ back: game.state.home_back }
    	];

    	let hand4_props = {};
    	for (var i = 0; i < hand4_spread_levels.length; i += 1) {
    		hand4_props = assign(hand4_props, hand4_spread_levels[i]);
    	}
    	var hand4 = new Hand({ props: hand4_props, $$inline: true });

    	var hand5 = new Hand({
    		props: {
    		cards: game.state.away_hand,
    		scale: scale$1,
    		anchor: [50, 0],
    		interact: false,
    		color: 180,
    		invert: true,
    		back: game.state.away_back
    	},
    		$$inline: true
    	});

    	var hand6_spread_levels = [
    		ctx.deck,
    		{ cards: game.state.away_deck },
    		{ color: 180 },
    		{ anchor: [90, 30] },
    		{ back: game.state.away_back }
    	];

    	let hand6_props = {};
    	for (var i = 0; i < hand6_spread_levels.length; i += 1) {
    		hand6_props = assign(hand6_props, hand6_spread_levels[i]);
    	}
    	var hand6 = new Hand({ props: hand6_props, $$inline: true });

    	var hand7_spread_levels = [
    		ctx.discard,
    		{ cards: game.state.away_discard },
    		{ anchor: [0, 10] },
    		{ back: game.state.away_back }
    	];

    	let hand7_props = {};
    	for (var i = 0; i < hand7_spread_levels.length; i += 1) {
    		hand7_props = assign(hand7_props, hand7_spread_levels[i]);
    	}
    	var hand7 = new Hand({ props: hand7_props, $$inline: true });

    	var spatial = new Spatial({
    		props: {
    		anchor: [90, 90],
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			div = element("div");
    			hand0.$$.fragment.c();
    			t0 = space();
    			hand1.$$.fragment.c();
    			t1 = space();
    			hand2.$$.fragment.c();
    			t2 = space();
    			hand3.$$.fragment.c();
    			t3 = space();
    			hand4.$$.fragment.c();
    			t4 = space();
    			hand5.$$.fragment.c();
    			t5 = space();
    			hand6.$$.fragment.c();
    			t6 = space();
    			hand7.$$.fragment.c();
    			t7 = space();
    			spatial.$$.fragment.c();
    			attr(div, "class", "game svelte-1bvhcmr");
    			add_location(div, file$6, 37, 0, 615);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(hand0, div, null);
    			append(div, t0);
    			mount_component(hand1, div, null);
    			append(div, t1);
    			mount_component(hand2, div, null);
    			append(div, t2);
    			mount_component(hand3, div, null);
    			append(div, t3);
    			mount_component(hand4, div, null);
    			append(div, t4);
    			mount_component(hand5, div, null);
    			append(div, t5);
    			mount_component(hand6, div, null);
    			append(div, t6);
    			mount_component(hand7, div, null);
    			append(div, t7);
    			mount_component(spatial, div, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var hand0_changes = {};
    			if (changed.game) hand0_changes.cards = game.state.home_hand;
    			if (changed.scale) hand0_changes.scale = scale$1;
    			if (changed.game) hand0_changes.back = game.state.home_back;
    			hand0.$set(hand0_changes);

    			var hand1_changes = (changed.deck || changed.game) ? get_spread_update(hand1_spread_levels, [
    				(changed.deck) && ctx.deck,
    				{ anchor: [90, 70] },
    				(changed.game) && { cards: game.state.home_deck },
    				{ position: [0, 0] },
    				(changed.game) && { back: game.state.home_back }
    			]) : {};
    			hand1.$set(hand1_changes);

    			var hand2_changes = {};
    			if (changed.play_home) hand2_changes.cards = ctx.play_home;
    			if (changed.game) hand2_changes.back = game.state.home_back;
    			hand2.$set(hand2_changes);

    			var hand3_changes = {};
    			if (changed.play_away) hand3_changes.cards = ctx.play_away;
    			if (changed.game) hand3_changes.back = game.state.away_back;
    			hand3.$set(hand3_changes);

    			var hand4_changes = (changed.discard || changed.game) ? get_spread_update(hand4_spread_levels, [
    				(changed.discard) && ctx.discard,
    				(changed.game) && { cards: game.state.home_discard },
    				{ position: [0, 0] },
    				{ anchor: [0, 90] },
    				(changed.game) && { back: game.state.home_back }
    			]) : {};
    			hand4.$set(hand4_changes);

    			var hand5_changes = {};
    			if (changed.game) hand5_changes.cards = game.state.away_hand;
    			if (changed.scale) hand5_changes.scale = scale$1;
    			if (changed.game) hand5_changes.back = game.state.away_back;
    			hand5.$set(hand5_changes);

    			var hand6_changes = (changed.deck || changed.game) ? get_spread_update(hand6_spread_levels, [
    				(changed.deck) && ctx.deck,
    				(changed.game) && { cards: game.state.away_deck },
    				{ color: 180 },
    				{ anchor: [90, 30] },
    				(changed.game) && { back: game.state.away_back }
    			]) : {};
    			hand6.$set(hand6_changes);

    			var hand7_changes = (changed.discard || changed.game) ? get_spread_update(hand7_spread_levels, [
    				(changed.discard) && ctx.discard,
    				(changed.game) && { cards: game.state.away_discard },
    				{ anchor: [0, 10] },
    				(changed.game) && { back: game.state.away_back }
    			]) : {};
    			hand7.$set(hand7_changes);

    			var spatial_changes = {};
    			if (changed.$$scope) spatial_changes.$$scope = { changed, ctx };
    			spatial.$set(spatial_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(hand0.$$.fragment, local);

    			transition_in(hand1.$$.fragment, local);

    			transition_in(hand2.$$.fragment, local);

    			transition_in(hand3.$$.fragment, local);

    			transition_in(hand4.$$.fragment, local);

    			transition_in(hand5.$$.fragment, local);

    			transition_in(hand6.$$.fragment, local);

    			transition_in(hand7.$$.fragment, local);

    			transition_in(spatial.$$.fragment, local);

    			if (div_outro) div_outro.end(1);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(hand0.$$.fragment, local);
    			transition_out(hand1.$$.fragment, local);
    			transition_out(hand2.$$.fragment, local);
    			transition_out(hand3.$$.fragment, local);
    			transition_out(hand4.$$.fragment, local);
    			transition_out(hand5.$$.fragment, local);
    			transition_out(hand6.$$.fragment, local);
    			transition_out(hand7.$$.fragment, local);
    			transition_out(spatial.$$.fragment, local);

    			div_outro = create_out_transition(div, fly, {delay: 100, duration:1000, x: 0, y: 1000, opacity: 0});

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			destroy_component(hand0, );

    			destroy_component(hand1, );

    			destroy_component(hand2, );

    			destroy_component(hand3, );

    			destroy_component(hand4, );

    			destroy_component(hand5, );

    			destroy_component(hand6, );

    			destroy_component(hand7, );

    			destroy_component(spatial, );

    			if (detaching) {
    				if (div_outro) div_outro.end();
    			}
    		}
    	};
    }

    const scale$1 = 0.25;

    function instance$6($$self) {
    	

    const deck = {
    	scale: scale$1,
        spread: 0,
        max: 4,
        reverse: true,
        interact: false,
    };

    const play_home = writable([]);
    const play_away = writable([]);

    const discard = {
        scale: scale$1,
        spread: 5,
        spread_y: 0,
        rotate: 0,
        rotation: 90,
        fade: true,
        drag: true,
        max: 10
    };

    game.server_fake();

    	function dragend_handler({ detail: { id } }) {
    	        game.do_server({
    	            task: 'PLAY',
    	            data: { id }
    	        });
    	    }

    	function click_handler() {
    	        game.do_server({
    	            task: 'DRAW'
    	        });
    	    }

    	return {
    		deck,
    		play_home,
    		play_away,
    		discard,
    		dragend_handler,
    		click_handler
    	};
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$7, safe_not_equal, []);
    	}
    }

    /* src\element\App.svelte generated by Svelte v3.6.6 */

    const file$7 = "src\\element\\App.svelte";

    // (24:0) {:else}
    function create_else_block(ctx) {
    	var current;

    	var intro = new Intro({ $$inline: true });
    	intro.$on("start", ctx.start);

    	return {
    		c: function create() {
    			intro.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(intro, target, anchor);
    			current = true;
    		},

    		i: function intro_1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(intro, detaching);
    		}
    	};
    }

    // (22:0) {#if playing}
    function create_if_block$3(ctx) {
    	var current;

    	var game = new Game({ $$inline: true });
    	game.$on("end", ctx.end);

    	return {
    		c: function create() {
    			game.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(game, target, anchor);
    			current = true;
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(game, detaching);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	var current_block_type_index, if_block, t0, t1, div, current;

    	var if_block_creators = [
    		create_if_block$3,
    		create_else_block
    	];

    	var if_blocks = [];

    	function select_block_type(ctx) {
    		if (ctx.playing) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	var tools = new Tools({
    		props: { playing: ctx.playing },
    		$$inline: true
    	});
    	tools.$on("end", ctx.end);

    	var tiles = new Tiles({ props: { random: true }, $$inline: true });

    	return {
    		c: function create() {
    			if_block.c();
    			t0 = space();
    			tools.$$.fragment.c();
    			t1 = space();
    			div = element("div");
    			tiles.$$.fragment.c();
    			attr(div, "class", "background svelte-135avyh");
    			add_location(div, file$7, 29, 0, 536);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, t0, anchor);
    			mount_component(tools, target, anchor);
    			insert(target, t1, anchor);
    			insert(target, div, anchor);
    			mount_component(tiles, div, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);
    			if (current_block_type_index !== previous_block_index) {
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
    				if_block.m(t0.parentNode, t0);
    			}

    			var tools_changes = {};
    			if (changed.playing) tools_changes.playing = ctx.playing;
    			tools.$set(tools_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			transition_in(tools.$$.fragment, local);

    			transition_in(tiles.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(tools.$$.fragment, local);
    			transition_out(tiles.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);

    			if (detaching) {
    				detach(t0);
    			}

    			destroy_component(tools, detaching);

    			if (detaching) {
    				detach(t1);
    				detach(div);
    			}

    			destroy_component(tiles, );
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	

    let playing = window.location.pathname === "/play";

    const start = () => {
        $$invalidate('playing', playing = true); 
        history.pushState({page: 1}, "", "/play");
    };

    const end = () => {
        $$invalidate('playing', playing = false); 
        history.pushState({page: 1}, "", "/");
    };

    	return { playing, start, end };
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$8, safe_not_equal, []);
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
