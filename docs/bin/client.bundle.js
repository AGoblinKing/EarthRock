(function (color, key_js, gamepad_js, text_js, flag_js, nav, Control, Weave, Tile, file_js, warps, store_js, twgl, time_js, shader_js, camera_js, visible_js, object_js, Logo) {
    'use strict';

    color = color && color.hasOwnProperty('default') ? color['default'] : color;
    var nav__default = 'default' in nav ? nav['default'] : nav;
    Control = Control && Control.hasOwnProperty('default') ? Control['default'] : Control;
    Weave = Weave && Weave.hasOwnProperty('default') ? Weave['default'] : Weave;
    Tile = Tile && Tile.hasOwnProperty('default') ? Tile['default'] : Tile;
    Logo = Logo && Logo.hasOwnProperty('default') ? Logo['default'] : Logo;

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
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if (typeof $$scope.dirty === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
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
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
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
                start: now() + delay,
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

    const globals = (typeof window !== 'undefined' ? window : global);
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
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
                block.p(child_ctx, dirty);
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
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
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
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
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
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.19.1' }, detail)));
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
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
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
        $capture_state() { }
        $inject_state() { }
    }

    function cubicInOut(t) {
        return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    }

    function blur(node, { delay = 0, duration = 400, easing = cubicInOut, amount = 5, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const f = style.filter === 'none' ? '' : style.filter;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `opacity: ${target_opacity - (od * u)}; filter: ${f} blur(${u * amount}px);`
        };
    }

    /* src\client\ui\Github.svelte generated by Svelte v3.19.1 */

    const file = "src\\client\\ui\\Github.svelte";

    function create_fragment(ctx) {
    	let svg;
    	let path0;
    	let path1;
    	let path2;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			attr_dev(path0, "class", "bg svelte-op8pzp");
    			attr_dev(path0, "d", "M0 0l115 115h15l12 27 108 108V0z");
    			attr_dev(path0, "fill", "#fff");
    			add_location(path0, file, 1, 2, 161);
    			attr_dev(path1, "class", "octo-arm svelte-op8pzp");
    			attr_dev(path1, "d", "M128 109c-15-9-9-19-9-19 3-7 2-11 2-11-1-7 3-2 3-2 4 5 2 11 2 11-3 10 5 15 9 16");
    			set_style(path1, "-webkit-transform-origin", "130px 106px");
    			set_style(path1, "transform-origin", "130px 106px");
    			add_location(path1, file, 2, 2, 233);
    			attr_dev(path2, "class", "octo-body svelte-op8pzp");
    			attr_dev(path2, "d", "M115 115s4 2 5 0l14-14c3-2 6-3 8-3-8-11-15-24 2-41 5-5 10-7 16-7 1-2 3-7 12-11 0 0 5 3 7 16 4 2 8 5 12 9s7 8 9 12c14 3 17 7 17 7-4 8-9 11-11 11 0 6-2 11-7 16-16 16-30 10-41 2 0 3-1 7-5 11l-12 11c-1 1 1 5 1 5z");
    			add_location(path2, file, 3, 2, 422);
    			attr_dev(svg, "id", "github");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "80");
    			attr_dev(svg, "height", "80");
    			attr_dev(svg, "viewBox", "0 0 250 250");
    			attr_dev(svg, "fill", "#151513");
    			set_style(svg, "position", "absolute");
    			set_style(svg, "top", "0");
    			set_style(svg, "right", "0");
    			attr_dev(svg, "class", "svelte-op8pzp");
    			add_location(svg, file, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
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

    class Github extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Github",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src\client\ui\Picker.svelte generated by Svelte v3.19.1 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$1 = "src\\client\\ui\\Picker.svelte";

    // (91:0) {#if nameit}
    function create_if_block(ctx) {
    	let div1;
    	let div0;
    	let color_action;
    	let t;
    	let input;
    	let color_action_1;
    	let current;
    	let dispose;

    	const tile = new Tile({
    			props: {
    				width: 1,
    				height: 1,
    				text: /*name*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(tile.$$.fragment);
    			t = space();
    			input = element("input");
    			attr_dev(div0, "class", "spirit svelte-40qg3e");
    			add_location(div0, file$1, 98, 1, 1772);
    			attr_dev(input, "class", "nameit svelte-40qg3e");
    			input.autofocus = true;
    			attr_dev(input, "type", "text");
    			attr_dev(input, "autocapitalize", "none");
    			attr_dev(input, "placeholder", "Name it");
    			add_location(input, file$1, 102, 1, 1888);
    			attr_dev(div1, "class", "nameprompt svelte-40qg3e");
    			add_location(div1, file$1, 91, 0, 1663);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(tile, div0, null);
    			append_dev(div1, t);
    			append_dev(div1, input);
    			set_input_value(input, /*name*/ ctx[2]);
    			current = true;
    			input.focus();

    			dispose = [
    				action_destroyer(color_action = color.call(null, div0, `${Wheel.DENOTE}${/*name*/ ctx[2]}`)),
    				action_destroyer(color_action_1 = color.call(null, input, `${Wheel.DENOTE}${/*name*/ ctx[2]}`)),
    				listen_dev(input, "keydown", /*keydown_handler*/ ctx[14], false, false, false),
    				listen_dev(input, "focus", focus_handler, false, false, false),
    				listen_dev(input, "input", /*input_input_handler*/ ctx[15]),
    				listen_dev(div1, "mouseover", mouseover_handler, false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			const tile_changes = {};
    			if (dirty & /*name*/ 4) tile_changes.text = /*name*/ ctx[2];
    			tile.$set(tile_changes);
    			if (color_action && is_function(color_action.update) && dirty & /*name*/ 4) color_action.update.call(null, `${Wheel.DENOTE}${/*name*/ ctx[2]}`);
    			if (color_action_1 && is_function(color_action_1.update) && dirty & /*name*/ 4) color_action_1.update.call(null, `${Wheel.DENOTE}${/*name*/ ctx[2]}`);

    			if (dirty & /*name*/ 4 && input.value !== /*name*/ ctx[2]) {
    				set_input_value(input, /*name*/ ctx[2]);
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
    			if (detaching) detach_dev(div1);
    			destroy_component(tile);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(91:0) {#if nameit}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let t0;
    	let div;
    	let t1;
    	let input;
    	let current;
    	let dispose;
    	let if_block = /*nameit*/ ctx[0] && create_if_block(ctx);
    	const default_slot_template = /*$$slots*/ ctx[13].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], null);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t0 = space();
    			div = element("div");
    			if (default_slot) default_slot.c();
    			t1 = space();
    			input = element("input");
    			attr_dev(div, "class", "picker svelte-40qg3e");
    			add_location(div, file$1, 135, 0, 2460);
    			attr_dev(input, "type", "file");
    			attr_dev(input, "class", "file svelte-40qg3e");
    			input.multiple = "multiple";
    			add_location(input, file$1, 143, 0, 2580);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			insert_dev(target, t1, anchor);
    			insert_dev(target, input, anchor);
    			/*input_binding*/ ctx[16](input);
    			current = true;

    			dispose = [
    				listen_dev(div, "drop", /*drop*/ ctx[3], false, false, false),
    				listen_dev(div, "dragover", /*over*/ ctx[4](true), false, false, false),
    				listen_dev(div, "dragleave", /*over*/ ctx[4](false), false, false, false),
    				listen_dev(input, "change", /*change_handler*/ ctx[17], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*nameit*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
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

    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 4096) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[12], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, null));
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(input);
    			/*input_binding*/ ctx[16](null);
    			run_all(dispose);
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

    const focus_handler = e => {
    	e.target.click();
    	e.target.select();
    };

    const mouseover_handler = e => {
    	e.preventDefault();
    	e.preventPropogation();
    };

    function instance($$self, $$props, $$invalidate) {
    	let $cursor;
    	validate_store(nav.cursor, "cursor");
    	component_subscribe($$self, nav.cursor, $$value => $$invalidate(11, $cursor = $$value));
    	let last = {};
    	let files;
    	let { nameit = false } = $$props;
    	let name;
    	const id = `${Wheel.DENOTE}picker`;

    	const drop = e => {
    		e.preventDefault();
    		e.stopPropagation();
    		const files = e.dataTransfer.files;

    		for (let i = 0; i < files.length; i++) {
    			const reader = new FileReader();

    			reader.onloadend = e => {
    				last = files[i];
    				$$invalidate(0, nameit = file_js.load(e.target.result));
    			};

    			reader.readAsDataURL(files[i]);
    		}
    	};

    	const over = whether => e => {
    		e.dataTransfer.dropEffect = `copy`;
    		e.preventDefault();
    		e.stopPropagation();
    	};

    	const cancel = () => {
    		$$invalidate(0, nameit = false);
    	};

    	const click = () => {
    		play_it();
    	};

    	const play_it = () => {
    		delete nameit.id;
    		$$invalidate(2, name = name.trim().toLowerCase().replace(/ /g, `_`));
    		Wheel.spawn({ [name]: nameit });
    		const weave = Wheel.get(name);

    		weave.write({
    			"!info": {
    				type: `space`,
    				value: last.name
    				? {
    						from: last.name,
    						"save last": last.lastModified,
    						size: last.size
    					}
    				: {}
    			}
    		});

    		Wheel.start(name);
    		$$invalidate(0, nameit = false);
    	};

    	const writable_props = ["nameit"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Picker> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	const keydown_handler = e => {
    		if (e.key.toLowerCase() === `end`) {
    			$$invalidate(0, nameit = false);
    			return;
    		}

    		if (e.key === ` `) {
    			e.preventDefault();

    			requestAnimationFrame(() => {
    				$$invalidate(2, name += `_`);
    				e.target.value = name;
    			});

    			return;
    		}

    		if (e.which !== 13) return;
    		play_it();
    	};

    	function input_input_handler() {
    		name = this.value;
    		($$invalidate(2, name), $$invalidate(0, nameit));
    	}

    	function input_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(1, files = $$value);
    		});
    	}

    	const change_handler = e => {
    		console.log(e.dataTransfer, e.target);
    	};

    	$$self.$set = $$props => {
    		if ("nameit" in $$props) $$invalidate(0, nameit = $$props.nameit);
    		if ("$$scope" in $$props) $$invalidate(12, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		Tile,
    		load: file_js.load,
    		warps,
    		color,
    		cursor: nav.cursor,
    		goto: nav.goto,
    		last,
    		files,
    		nameit,
    		name,
    		id,
    		drop,
    		over,
    		cancel,
    		click,
    		play_it,
    		arr_warps,
    		Object,
    		Wheel,
    		FileReader,
    		$cursor
    	});

    	$$self.$inject_state = $$props => {
    		if ("last" in $$props) last = $$props.last;
    		if ("files" in $$props) $$invalidate(1, files = $$props.files);
    		if ("nameit" in $$props) $$invalidate(0, nameit = $$props.nameit);
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("arr_warps" in $$props) arr_warps = $$props.arr_warps;
    	};

    	let arr_warps;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*nameit*/ 1) {
    			 {
    				if (nameit.name) {
    					$$invalidate(2, name = nameit.name.replace(/ /g, `_`));
    					$$invalidate(0, nameit.name = false, nameit);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*nameit, $cursor*/ 2049) {
    			// prevent a dead zone
    			 {
    				if (nameit === false && $cursor && $cursor.id === `${Wheel.DENOTE}picker`) {
    					nav.goto(Wheel.DENOTE);
    				}
    			}
    		}
    	};

    	 arr_warps = Object.entries(warps);

    	return [
    		nameit,
    		files,
    		name,
    		drop,
    		over,
    		play_it,
    		id,
    		cancel,
    		click,
    		last,
    		arr_warps,
    		$cursor,
    		$$scope,
    		$$slots,
    		keydown_handler,
    		input_input_handler,
    		input_binding,
    		change_handler
    	];
    }

    class Picker extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment$1, safe_not_equal, { nameit: 0, id: 6, cancel: 7, click: 8 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Picker",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get nameit() {
    		throw new Error("<Picker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nameit(value) {
    		throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		return this.$$.ctx[6];
    	}

    	set id(value) {
    		throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cancel() {
    		return this.$$.ctx[7];
    	}

    	set cancel(value) {
    		throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get click() {
    		return this.$$.ctx[8];
    	}

    	set click(value) {
    		throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const defaults = {
    	position: [0, 0, 0],
    	sprite: [0],
    	scale: [1],
    	color: [255, 255, 255, 1],
    	rotation: [0]
    };

    const verts = twgl.primitives.createXYQuadVertices(1);

    let count = 0;

    const buffer = {
    	...object_js.map(verts)(
    		([key, val]) => {
    			val.divisor = 0;
    			return [key, val]
    		}
    	),
    	translate_last: {
    		divisor: 1,
    		data: new Float32Array(3),
    		numComponents: 3
    	},
    	translate: {
    		divisor: 1,
    		data: new Float32Array(3),
    		numComponents: 3
    	},
    	rotation: {
    		numComponents: 1,
    		data: new Float32Array(1),
    		divisor: 1
    	},
    	rotation_last: {
    		numComponents: 1,
    		data: new Float32Array(1),
    		divisor: 1
    	},
    	color: {
    		numComponents: 4,
    		data: new Float32Array([1.0, 1.0, 1.0, 1.0]),
    		divisor: 1
    	},
    	color_last: {
    		numComponents: 4,
    		data: new Float32Array(4),
    		divisor: 1
    	},
    	sprite: {
    		numComponents: 1,
    		data: new Float32Array(1),
    		divisor: 1
    	},
    	scale: {
    		numComponents: 1,
    		data: new Float32Array([1.0]),
    		divisor: 1
    	},
    	scale_last: {
    		numComponents: 1,
    		data: new Float32Array([1.0]),
    		divisor: 1
    	}
    };

    let last_snap = Date.now();

    const get_time = () => {
    	const t = (Date.now() - last_snap) / flag_js.TIME_TICK_RATE.get();

    	return t
    };

    let buffer_info;
    const get_buffer = (gl) => {
    	if (buffer_info) {
    		object_js.each(buffer)(([key, { data, divisor }]) => {
    			if (divisor !== 1) return
    			twgl.setAttribInfoBufferFromArray(
    				gl,
    				buffer_info.attribs[key],
    				data
    			);
    		});

    		return buffer_info
    	}

    	buffer_info = twgl.createBufferInfoFromArrays(
    		gl,
    		buffer
    	);

    	dirty = true;
    	return buffer_info
    };

    let dirty;
    const snapshot = (gl) => {
    	const result = {
    		count,
    		buffer_info: get_buffer(gl),
    		time: get_time(),
    		dirty
    	};

    	if (dirty) dirty = false;
    	return result
    };

    const keydex = {};

    let buffer_count = 0;

    const available = [];

    const expand = (amount = 100) => {
    	buffer_info = false;

    	const count_new = buffer_count + amount;

    	object_js.values(buffer).forEach(({
    		divisor,
    		data,
    		numComponents
    	}) => {
    		if (divisor !== 1) return
    		object_js.each(buffer)(([_, buff]) => {
    			const { data, numComponents, divisor } = buff;
    			if (divisor !== 1) return

    			buff.data = new data.__proto__.constructor(numComponents * count_new);

    			buff.data.set(data, 0);
    		});
    	});

    	available.push(...[...Array(amount)].map((_, i) => buffer_count + i));
    	buffer_count = count_new;
    };

    const to_idx = (key) => {
    	if (keydex[key] === undefined) {
    		// grab an available key
    		if (available.length === 0) {
    			expand();
    		}

    		keydex[key] = available.shift();
    	}

    	return keydex[key]
    };

    // free the key value and make the idx available
    const free = (key) => {
    	const idx = keydex[key];
    	// this key is freEEeee already
    	if (idx === undefined) return

    	available.push(idx);

    	object_js.each(buffer)(([_, { data, numComponents, divisor }]) => {
    		if (divisor !== 1) return

    		// zero it out
    		data.set([...Array(numComponents)].fill(0), idx * numComponents);
    	});
    };

    // setInterval(() => details(0), 5000)

    let last_update;
    // RAF so it happens at end of frame
    time_js.tick.listen(() => requestAnimationFrame(() => {
    	if (!buffer_info) return

    	// grab the shiz
    	const { update, remove, add } = visible_js.visible.hey();
    	const vis = visible_js.visible.get();

    	// add all the defaults for each one
    	add.forEach((key) => {
    		object_js.each(defaults)(([key_d, val]) => {
    			if (buffer[`${key_d}_last`]) {
    				const idx = to_idx(key);
    				const { data, numComponents } = buffer[`${key_d}_last`];

    				data.set([...val], idx * numComponents);
    			}

    			// already set
    			if (update[key] && update[key][key_d] !== undefined) return

    			update[key][key_d] = vis[key][key_d] === undefined
    				? vis[key].get_value(key_d)
    				: [...val];
    		});
    	});

    	object_js.each(update)(([key, space]) => {
    		const idx = to_idx(key);
    		last_update && last_update.delete(key);

    		object_js.each(buffer)(([key_b, { data, divisor, numComponents }]) => {
    			if (divisor !== 1 || key_b.indexOf(`_last`) !== -1) return

    			const bdx = idx * numComponents;

    			// alias positon to translate
    			const space_key = key_b === `translate` ? `position` : key_b;
    			if (!vis[key]) return
    			const twist = vis[key].get_value(space_key);

    			let update_set;
    			// TODO: Maybe store all values in twists as TypeArrays?
    			if (typeof twist === `number`) {
    				update_set = [...Array(numComponents)].fill(twist);
    			} else if (Array.isArray(twist)) {
    				update_set = [...twist.slice(0, numComponents)];
    			} else {
    				// otherwise wtf was that? lets set default
    				update_set = [...data.subarray(bdx, bdx + numComponents)];
    			}

    			// update your last buffer if it exists
    			if (buffer[`${key_b}_last`] !== undefined) {
    				const { data: data_last } = buffer[`${key_b}_last`];

    				data_last.set([...data.subarray(bdx, bdx + numComponents)], bdx);
    			}

    			return data.set(update_set, bdx)
    		});
    	});

    	remove.forEach((key) => {
    		last_update && last_update.delete(key);
    		free(key);
    	});

    	last_update && last_update.forEach((key) => {
    		const idx = to_idx(key);

    		object_js.each(buffer)(([key_b, { data, divisor, numComponents }]) => {
    			if (divisor !== 1 || key_b.indexOf(`_last`) !== -1) return

    			const bdx = idx * numComponents;

    			if (buffer[`${key_b}_last`] !== undefined) {
    				const { data: data_last } = buffer[`${key_b}_last`];

    				data_last.set([...data.subarray(bdx, bdx + numComponents)], bdx);
    			}
    		});
    	});

    	count = buffer_count;
    	last_snap = Date.now();
    	last_update = new Set(object_js.keys(update));
    }));

    const clear_color = store_js.write([0, 0, 0, 1]);

    const { m4 } = twgl;
    const up = [0, 1, 0];

    var webgl = () => {
    	const smooth_position = {
    		last: [0, 0, 0],
    		next: [0, 0, 0],
    		future: [0, 0, 0],

    		update () {
    			smooth_position.last = [...smooth_position.next];
    			smooth_position.next = camera_js.position.get();
    		},

    		get: (t) => {
    			const v = twgl.v3.lerp(
    				smooth_position.last,
    				smooth_position.next,
    				t
    			);

    			if (1 - t < 0.05) {
    				smooth_position.update();
    			}

    			return v
    		}
    	};

    	const canvas = document.createElement(`canvas`);

    	canvas.width = 16 * 100;
    	canvas.height = 16 * 100;

    	const gl = twgl.getContext(canvas);
    	twgl.addExtensionsToContext(gl);

    	const textures = twgl.createTextures(gl, {
    		map: {
    			src: flag_js.SPRITES.get(),
    			mag: gl.NEAREST,
    			min: gl.LINEAR
    		}
    	});

    	const program_info = twgl.createProgramInfo(
    		gl,
    		shader_js.sprite.get()
    	);

    	if (!program_info) return
    	canvas.snap = store_js.write(snapshot(gl));

    	const view = m4.identity();
    	const view_projection = m4.identity();

    	let vertex_info;
    	// lifecycle on warp

    	const drawObjects = [{
    		programInfo: program_info,
    		vertexArrayInfo: vertex_info,
    		uniforms: {},
    		instanceCount: 0
    	}];

    	gl.enable(gl.DEPTH_TEST);
    	gl.enable(gl.BLEND);
    	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    	gl.useProgram(program_info.program);

    	canvas.cancel = time_js.frame.listen(([time, t]) => {
    		const $clear_color = clear_color.get();
    		gl.viewport(0, 0, canvas.width, canvas.height);
    		gl.clearColor(...$clear_color.slice(0, 4));
    		gl.clear(gl.COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT);

    		const snap = snapshot(gl);
    		if (snap.count < 1) return

    		const r = canvas.width / canvas.height;
    		const projection = twgl.m4.ortho(-10 * r, 10 * r, 10, -10, -100, 50);
    		const c = camera_js.camera.get();
    		const $pos = smooth_position.get(snap.time);

    		m4.lookAt($pos, twgl.v3.add($pos, camera_js.look.get()), up, c);
    		m4.inverse(c, view);
    		m4.multiply(projection, view, view_projection);

    		// if (snap.dirty || !drawObjects[0].vertexArrayInfo) {
    		drawObjects[0].vertexArrayInfo = twgl.createVertexArrayInfo(gl, program_info, snap.buffer_info);
    		// }

    		drawObjects[0].instanceCount = snap.count;
    		drawObjects[0].uniforms = {
    			u_map: textures.map,
    			u_time: snap.time,
    			u_sprite_size: 16,
    			u_sprite_columns: 32,
    			u_view_projection: view_projection
    		};

    		twgl.drawObjectList(gl, drawObjects);
    	});

    	return canvas
    };

    const size = store_js.read([window.innerWidth, window.innerHeight], (set) => {
    	window.addEventListener(`resize`, () => {
    		set([window.innerWidth, window.innerHeight]);
    	});
    });

    const scale = store_js.write(1);

    size.subscribe(([width, height]) => {
    	const target = width > height
    		? height
    		: width;

    	scale.set(target / 80);
    	window.document.documentElement.style.fontSize = `${Math.round(scale.get())}px`;
    });

    // main canvas
    const main = store_js.read(webgl());

    /* src\client\ui\MainScreen.svelte generated by Svelte v3.19.1 */
    const file$2 = "src\\client\\ui\\MainScreen.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let insert_action;
    	let sizer_action;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "main svelte-jdwyal");
    			toggle_class(div, "full", /*full*/ ctx[0]);
    			toggle_class(div, "hidden", !/*hidden*/ ctx[1]);
    			add_location(div, file$2, 37, 0, 574);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			dispose = [
    				action_destroyer(insert_action = /*insert*/ ctx[3].call(null, div)),
    				action_destroyer(sizer_action = /*sizer*/ ctx[4].call(null, div)),
    				listen_dev(div, "click", /*toggle*/ ctx[2], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*full*/ 1) {
    				toggle_class(div, "full", /*full*/ ctx[0]);
    			}

    			if (dirty & /*hidden*/ 2) {
    				toggle_class(div, "hidden", !/*hidden*/ ctx[1]);
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { full = false } = $$props;
    	let { hidden } = $$props;

    	const toggle = () => {
    		$$invalidate(0, full = !full);
    	};

    	let c;

    	const insert = node => ({
    		destroy: main.subscribe(canvas => {
    			if (!canvas || !canvas.style) return;
    			c = canvas;

    			while (node.firstChild) {
    				node.removeChild(node.firstChild);
    			}

    			node.appendChild(canvas);
    		})
    	});

    	const sizer = node => ({
    		destroy: size.listen(([w, h]) => {

    			if (c) {
    				c.width = w;
    				c.height = h;
    			}
    		})
    	});

    	const writable_props = ["full", "hidden"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MainScreen> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("full" in $$props) $$invalidate(0, full = $$props.full);
    		if ("hidden" in $$props) $$invalidate(1, hidden = $$props.hidden);
    	};

    	$$self.$capture_state = () => ({
    		main,
    		size,
    		full,
    		hidden,
    		toggle,
    		c,
    		insert,
    		sizer
    	});

    	$$self.$inject_state = $$props => {
    		if ("full" in $$props) $$invalidate(0, full = $$props.full);
    		if ("hidden" in $$props) $$invalidate(1, hidden = $$props.hidden);
    		if ("c" in $$props) c = $$props.c;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [full, hidden, toggle, insert, sizer];
    }

    class MainScreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, { full: 0, hidden: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MainScreen",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*hidden*/ ctx[1] === undefined && !("hidden" in props)) {
    			console.warn("<MainScreen> was created without expected prop 'hidden'");
    		}
    	}

    	get full() {
    		throw new Error("<MainScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set full(value) {
    		throw new Error("<MainScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get hidden() {
    		throw new Error("<MainScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hidden(value) {
    		throw new Error("<MainScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\client\ui\Main.svelte generated by Svelte v3.19.1 */

    const { Object: Object_1$1 } = globals;
    const file$3 = "src\\client\\ui\\Main.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[28] = list[i];
    	child_ctx[30] = i;
    	return child_ctx;
    }

    // (125:4) {#if !hidden}
    function create_if_block$1(ctx) {
    	let div1;
    	let a0;
    	let t0;
    	let div0;
    	let t1;
    	let color_action;
    	let div1_transition;
    	let t2;
    	let div5;
    	let div4;
    	let div2;
    	let t3;
    	let a1;
    	let i0;
    	let t5;
    	let i1;
    	let b;
    	let nav_action;
    	let t8;
    	let div3;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let div5_transition;
    	let current;
    	let dispose;
    	const github = new Github({ $$inline: true });
    	const logo = new Logo({ $$inline: true });
    	let each_value = /*ws*/ ctx[8];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*weave*/ ctx[28].id.get();
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			a0 = element("a");
    			create_component(github.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			t1 = text(/*$workspace*/ ctx[9]);
    			t2 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div2 = element("div");
    			create_component(logo.$$.fragment);
    			t3 = space();
    			a1 = element("a");
    			i0 = element("i");
    			i0.textContent = "E";
    			t5 = text("ARTHROC");
    			i1 = element("i");
    			i1.textContent = "K";
    			b = element("b");
    			b.textContent = "make believe with friends";
    			t8 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(a0, "class", "github svelte-434ebw");
    			attr_dev(a0, "href", "https://github.com/agoblinking/earthrock");
    			attr_dev(a0, "target", "_new");
    			add_location(a0, file$3, 127, 8, 3755);
    			attr_dev(div0, "class", "workspace svelte-434ebw");
    			add_location(div0, file$3, 130, 8, 3883);
    			add_location(div1, file$3, 125, 8, 3687);
    			attr_dev(div2, "class", "logoicon svelte-434ebw");
    			add_location(div2, file$3, 146, 16, 4294);
    			attr_dev(i0, "class", "svelte-434ebw");
    			add_location(i0, file$3, 176, 17, 5449);
    			attr_dev(i1, "class", "svelte-434ebw");
    			add_location(i1, file$3, 176, 32, 5464);
    			attr_dev(b, "class", "svelte-434ebw");
    			add_location(b, file$3, 176, 40, 5472);
    			attr_dev(a1, "class", "logo svelte-434ebw");
    			attr_dev(a1, "href", "https://www.patreon.com/earthrock");
    			attr_dev(a1, "target", "_new");
    			add_location(a1, file$3, 150, 16, 4394);
    			attr_dev(div3, "class", "weaves svelte-434ebw");
    			add_location(div3, file$3, 178, 16, 5544);
    			attr_dev(div4, "class", "partial svelte-434ebw");
    			add_location(div4, file$3, 144, 12, 4249);
    			attr_dev(div5, "class", "explore svelte-434ebw");
    			set_style(div5, "color", /*$THEME_COLOR*/ ctx[10]);
    			toggle_class(div5, "boxed", /*boxed*/ ctx[5]);
    			add_location(div5, file$3, 137, 8, 4029);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, a0);
    			mount_component(github, a0, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			mount_component(logo, div2, null);
    			append_dev(div4, t3);
    			append_dev(div4, a1);
    			append_dev(a1, i0);
    			append_dev(a1, t5);
    			append_dev(a1, i1);
    			append_dev(a1, b);
    			append_dev(div4, t8);
    			append_dev(div4, div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			/*div5_binding*/ ctx[26](div5);
    			current = true;

    			dispose = [
    				action_destroyer(color_action = color.call(null, div0, /*$workspace*/ ctx[9])),
    				listen_dev(a1, "click", /*click_handler*/ ctx[18], false, false, false),
    				action_destroyer(nav_action = nav__default.call(null, a1, {
    					id: Wheel.DENOTE,
    					up: /*nav_function*/ ctx[19],
    					origin: true,
    					down: /*nav_function_1*/ ctx[20],
    					page_up: /*nav_function_2*/ ctx[21],
    					page_down: /*nav_function_3*/ ctx[22],
    					insert: /*nav_function_4*/ ctx[23]
    				}))
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty[0] & /*$workspace*/ 512) set_data_dev(t1, /*$workspace*/ ctx[9]);
    			if (color_action && is_function(color_action.update) && dirty[0] & /*$workspace*/ 512) color_action.update.call(null, /*$workspace*/ ctx[9]);

    			if (nav_action && is_function(nav_action.update) && dirty[0] & /*ws, nameit, picker*/ 268) nav_action.update.call(null, {
    				id: Wheel.DENOTE,
    				up: /*nav_function*/ ctx[19],
    				origin: true,
    				down: /*nav_function_1*/ ctx[20],
    				page_up: /*nav_function_2*/ ctx[21],
    				page_down: /*nav_function_3*/ ctx[22],
    				insert: /*nav_function_4*/ ctx[23]
    			});

    			if (dirty[0] & /*ws, expand*/ 4352) {
    				const each_value = /*ws*/ ctx[8];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div3, outro_and_destroy_block, create_each_block, null, get_each_context);
    				check_outros();
    			}

    			if (!current || dirty[0] & /*$THEME_COLOR*/ 1024) {
    				set_style(div5, "color", /*$THEME_COLOR*/ ctx[10]);
    			}

    			if (dirty[0] & /*boxed*/ 32) {
    				toggle_class(div5, "boxed", /*boxed*/ ctx[5]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(github.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, blur, { duration: 250, amount: 2 }, true);
    				div1_transition.run(1);
    			});

    			transition_in(logo.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			add_render_callback(() => {
    				if (!div5_transition) div5_transition = create_bidirectional_transition(div5, blur, { duration: 250, amount: 2 }, true);
    				div5_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(github.$$.fragment, local);
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, blur, { duration: 250, amount: 2 }, false);
    			div1_transition.run(0);
    			transition_out(logo.$$.fragment, local);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			if (!div5_transition) div5_transition = create_bidirectional_transition(div5, blur, { duration: 250, amount: 2 }, false);
    			div5_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(github);
    			if (detaching && div1_transition) div1_transition.end();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div5);
    			destroy_component(logo);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			/*div5_binding*/ ctx[26](null);
    			if (detaching && div5_transition) div5_transition.end();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(125:4) {#if !hidden}",
    		ctx
    	});

    	return block;
    }

    // (180:20) {#each ws as weave, i (weave.id.get())}
    function create_each_block(key_2, ctx) {
    	let first;
    	let current;

    	function func(...args) {
    		return /*func*/ ctx[24](/*i*/ ctx[30], ...args);
    	}

    	function func_1(...args) {
    		return /*func_1*/ ctx[25](/*i*/ ctx[30], ...args);
    	}

    	const weave = new Weave({
    			props: {
    				weave: /*weave*/ ctx[28],
    				navi: { up: func, down: func_1 }
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_2,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(weave.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(weave, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const weave_changes = {};
    			if (dirty[0] & /*ws*/ 256) weave_changes.weave = /*weave*/ ctx[28];
    			if (dirty[0] & /*ws*/ 256) weave_changes.navi = { up: func, down: func_1 };
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
    			if (detaching) detach_dev(first);
    			destroy_component(weave, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(180:20) {#each ws as weave, i (weave.id.get())}",
    		ctx
    	});

    	return block;
    }

    // (124:4) <Picker {nameit} bind:this={picker}>
    function create_default_slot(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*hidden*/ ctx[0] && create_if_block$1(ctx);

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
    		p: function update(ctx, dirty) {
    			if (!/*hidden*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
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
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(124:4) <Picker {nameit} bind:this={picker}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let t0;
    	let t1;
    	let current;

    	const mainscreen = new MainScreen({
    			props: { hidden: /*hidden*/ ctx[0] },
    			$$inline: true
    		});

    	const control = new Control({ $$inline: true });

    	let picker_1_props = {
    		nameit: /*nameit*/ ctx[2],
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	const picker_1 = new Picker({ props: picker_1_props, $$inline: true });
    	/*picker_1_binding*/ ctx[27](picker_1);

    	const block = {
    		c: function create() {
    			create_component(mainscreen.$$.fragment);
    			t0 = space();
    			create_component(control.$$.fragment);
    			t1 = space();
    			create_component(picker_1.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(mainscreen, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(control, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(picker_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const mainscreen_changes = {};
    			if (dirty[0] & /*hidden*/ 1) mainscreen_changes.hidden = /*hidden*/ ctx[0];
    			mainscreen.$set(mainscreen_changes);
    			const picker_1_changes = {};
    			if (dirty[0] & /*nameit*/ 4) picker_1_changes.nameit = /*nameit*/ ctx[2];

    			if (dirty[0] & /*$THEME_COLOR, explore, boxed, ws, nameit, picker, patreon, $workspace, hidden*/ 1855 | dirty[1] & /*$$scope*/ 1) {
    				picker_1_changes.$$scope = { dirty, ctx };
    			}

    			picker_1.$set(picker_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(mainscreen.$$.fragment, local);
    			transition_in(control.$$.fragment, local);
    			transition_in(picker_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(mainscreen.$$.fragment, local);
    			transition_out(control.$$.fragment, local);
    			transition_out(picker_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(mainscreen, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(control, detaching);
    			if (detaching) detach_dev(t1);
    			/*picker_1_binding*/ ctx[27](null);
    			destroy_component(picker_1, detaching);
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

    function instance$2($$self, $$props, $$invalidate) {
    	let $weaves,
    		$$unsubscribe_weaves = noop,
    		$$subscribe_weaves = () => ($$unsubscribe_weaves(), $$unsubscribe_weaves = subscribe(weaves, $$value => $$invalidate(16, $weaves = $$value)), weaves);

    	let $cursor;

    	let $workspace,
    		$$unsubscribe_workspace = noop,
    		$$subscribe_workspace = () => ($$unsubscribe_workspace(), $$unsubscribe_workspace = subscribe(workspace, $$value => $$invalidate(9, $workspace = $$value)), workspace);

    	let $THEME_COLOR;
    	validate_store(nav.cursor, "cursor");
    	component_subscribe($$self, nav.cursor, $$value => $$invalidate(17, $cursor = $$value));
    	validate_store(flag_js.THEME_COLOR, "THEME_COLOR");
    	component_subscribe($$self, flag_js.THEME_COLOR, $$value => $$invalidate(10, $THEME_COLOR = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_weaves());
    	$$self.$$.on_destroy.push(() => $$unsubscribe_workspace());
    	let explore;
    	let last_cursor;

    	key_js.key.listen(char => {
    		if (char !== `\`` && char !== `pause`) return;
    		$$invalidate(0, hidden = !hidden);

    		if (hidden) {
    			last_cursor = nav.cursor.get().id;
    			nav.cursor.set({ id: `$game` });
    		} else {
    			requestAnimationFrame(() => {
    				nav.goto(last_cursor);
    				const ele = nav.cursor.get();
    				if (!ele) return;
    				const br = ele.getBoundingClientRect();
    				if (!br) return;
    				explore.scrollTo({ top: br.top });
    			});
    		}
    	});

    	gamepad_js.button.listen(button => {
    		if (button !== `select`) return;
    		$$invalidate(0, hidden = !hidden);
    	});

    	let { hidden = window.location.hash.indexOf(`dev`) === -1 } = $$props;
    	let nameit = false;
    	let picker;

    	const top_space = () => {
    		const weave = ws[ws.length - 1];
    		if (!weave) return;
    		const spaces = weave.names.get();
    		const space_keys = Object.keys(spaces);
    		if (space_keys.length < 1) return weave.name.get();
    		const space_key = space_keys[space_keys.length - 1];
    		const twists = Object.keys(spaces[space_key].value.get()).sort();
    		if (twists.length < 1) return `${weave.name.get()}/${space_key}`;
    		return `${weave.name.get()}/${space_key}/${twists[twists.length - 1]}`;
    	};

    	const expand = name => {
    		const weave = Wheel.get(name);
    		if (!weave) return name;
    		const $names = weave.names.get();
    		const name_keys = Object.keys($names).sort();
    		if (name_keys.length === 0) return name;
    		const name_key = name_keys[name_keys.length - 1];
    		const named = $names[name_key];
    		name = `${name}${Wheel.DENOTE}${name_key}`;
    		const v = named.value.get();
    		const v_keys = Object.keys(v).sort();
    		if (v_keys.length === 0) return name;
    		return `${name}${Wheel.DENOTE}${v_keys[v_keys.length - 1]}`;
    	};

    	let last;
    	let patreon;
    	let boxed = false;
    	let attempting = false;
    	const writable_props = ["hidden"];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Main> was created with unknown prop '${key}'`);
    	});

    	const click_handler = e => {
    		if (patreon !== 0) return;
    		$$invalidate(4, patreon++, patreon);
    		e.preventDefault();
    	};

    	const nav_function = () => top_space;
    	const nav_function_1 = () => ws[0].name.get();
    	const nav_function_2 = () => ws[ws.length - 1].name.get();
    	const nav_function_3 = () => ws[0].name.get();

    	const nav_function_4 = () => {
    		// pop up picker with a blank
    		$$invalidate(2, nameit = { name: text_js.random(2) });

    		requestAnimationFrame(() => {
    			nav.cursor.set(picker);
    		});
    	};

    	const func = i => ws[i - 1] ? expand(ws[i - 1].name.get()) : Wheel.DENOTE;
    	const func_1 = i => ws[i + 1] ? ws[i + 1].name.get() : Wheel.DENOTE;

    	function div5_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(1, explore = $$value);
    		});
    	}

    	function picker_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(3, picker = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("hidden" in $$props) $$invalidate(0, hidden = $$props.hidden);
    	};

    	$$self.$capture_state = () => ({
    		color,
    		blur,
    		key: key_js.key,
    		button: gamepad_js.button,
    		random: text_js.random,
    		THEME_COLOR: flag_js.THEME_COLOR,
    		nav: nav__default,
    		cursor: nav.cursor,
    		goto: nav.goto,
    		Control,
    		Weave,
    		Github,
    		Picker,
    		MainScreen,
    		Logo,
    		explore,
    		last_cursor,
    		hidden,
    		nameit,
    		picker,
    		top_space,
    		expand,
    		last,
    		patreon,
    		boxed,
    		attempting,
    		workspace,
    		Wheel,
    		requestAnimationFrame,
    		weaves,
    		ws,
    		Object,
    		$weaves,
    		window,
    		$cursor,
    		$workspace,
    		$THEME_COLOR
    	});

    	$$self.$inject_state = $$props => {
    		if ("explore" in $$props) $$invalidate(1, explore = $$props.explore);
    		if ("last_cursor" in $$props) last_cursor = $$props.last_cursor;
    		if ("hidden" in $$props) $$invalidate(0, hidden = $$props.hidden);
    		if ("nameit" in $$props) $$invalidate(2, nameit = $$props.nameit);
    		if ("picker" in $$props) $$invalidate(3, picker = $$props.picker);
    		if ("last" in $$props) $$invalidate(14, last = $$props.last);
    		if ("patreon" in $$props) $$invalidate(4, patreon = $$props.patreon);
    		if ("boxed" in $$props) $$invalidate(5, boxed = $$props.boxed);
    		if ("attempting" in $$props) $$invalidate(15, attempting = $$props.attempting);
    		if ("workspace" in $$props) $$subscribe_workspace($$invalidate(6, workspace = $$props.workspace));
    		if ("weaves" in $$props) $$subscribe_weaves($$invalidate(7, weaves = $$props.weaves));
    		if ("ws" in $$props) $$invalidate(8, ws = $$props.ws);
    	};

    	let workspace;
    	let weaves;
    	let ws;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$weaves*/ 65536) {
    			 $$invalidate(8, ws = Object.values($weaves).sort(({ name: a }, { name: b }) => {
    				const $a = a.get();
    				const $b = b.get();
    				if ($a > $b) return 1;
    				if ($b > $a) return -1;
    				return 0;
    			}));
    		}

    		if ($$self.$$.dirty[0] & /*$cursor, last*/ 147456) {
    			 {
    				if ($cursor !== last) {
    					$$invalidate(4, patreon = 0);
    				}

    				$$invalidate(14, last = $cursor);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*hidden, boxed, attempting*/ 32801) {
    			 {
    				if (!hidden && !boxed && !attempting) {
    					$$invalidate(15, attempting = true);

    					requestAnimationFrame(() => {
    						$$invalidate(5, boxed = !boxed);
    					});
    				}

    				if (hidden && attempting) {
    					$$invalidate(5, boxed = false);
    					$$invalidate(15, attempting = false);
    				}
    			}
    		}
    	};

    	 $$subscribe_workspace($$invalidate(6, workspace = Wheel.name));
    	 $$subscribe_weaves($$invalidate(7, weaves = Wheel.weaves));

    	return [
    		hidden,
    		explore,
    		nameit,
    		picker,
    		patreon,
    		boxed,
    		workspace,
    		weaves,
    		ws,
    		$workspace,
    		$THEME_COLOR,
    		top_space,
    		expand,
    		last_cursor,
    		last,
    		attempting,
    		$weaves,
    		$cursor,
    		click_handler,
    		nav_function,
    		nav_function_1,
    		nav_function_2,
    		nav_function_3,
    		nav_function_4,
    		func,
    		func_1,
    		div5_binding,
    		picker_1_binding
    	];
    }

    class Main extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, { hidden: 0 }, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Main",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get hidden() {
    		throw new Error("<Main>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hidden(value) {
    		throw new Error("<Main>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const main$1 = new Main({
        target: document.body
    });

}(color, key_js, gamepad_js, text_js, flag_js, nav, Control, Weave, Tile, file_js, warps, store_js, twgl, time_js, shader_js, camera_js, visible_js, object_js, Logo));
//# sourceMappingURL=client.bundle.js.map
