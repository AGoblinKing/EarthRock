var app = (function (Tone, uuid, twgl, expr, Color) {
    'use strict';

    Tone = Tone && Tone.hasOwnProperty('default') ? Tone['default'] : Tone;
    uuid = uuid && uuid.hasOwnProperty('default') ? uuid['default'] : uuid;
    expr = expr && expr.hasOwnProperty('default') ? expr['default'] : expr;
    Color = Color && Color.hasOwnProperty('default') ? Color['default'] : Color;

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

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

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

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe,
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = internal_94) {
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
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = internal_94;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = internal_85(result) ? result : internal_94;
                }
            };
            const unsubscribers = stores_array.map((store, i) => store.subscribe((value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                internal_105(unsubscribers);
                cleanup();
            };
        });
    }

    const json = (store) => {
      store.get = () => internal_73(store);
      store.toJSON = () => internal_73(store);
      store.poke = () => store.set(internal_73(store));
      store.listen = store.subscribe;
      store.set = store.set || (() => {});
      return store
    };

    const write = (thing) => json(writable(thing));
    const read = (thing, handler) => json(readable(thing, handler));

    const transformer = (transform) => {
      const store = write();

      const set = store.set;
      store.set = (update) => {
        set(transform(update));
        return store
      };

      return store
    };

    const derived$1 = (...args) => json(derived(...args));

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

    const player = ({
      instrument,
      pattern = []
    }) => () => {
      Tone.context.resume();

      const [note, duration] = pattern;
      instrument.triggerAttackRelease(note, duration);
    };

    const test = player({
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

    const animation = { delay: 100, duration: 300 };
    const tick_rate = 100;

    const explore_open = write(true);

    const path = writable(window.location.pathname.slice(1));

    path.subscribe((new_path) => {
      if (window.location.pathname === new_path) {
        return
      }

      window.history.pushState({ page: 1 }, ``, `/${new_path}`);
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
    			attr_dev(h1, "class", "title svelte-x93b5j");
    			add_location(h1, file, 45, 0, 786);
    			attr_dev(h2, "class", "desc svelte-x93b5j");
    			add_location(h2, file, 46, 0, 819);
    			attr_dev(button0, "class", "svelte-x93b5j");
    			add_location(button0, file, 59, 4, 1108);
    			attr_dev(button1, "class", "svelte-x93b5j");
    			add_location(button1, file, 64, 4, 1207);
    			attr_dev(button2, "class", "svelte-x93b5j");
    			add_location(button2, file, 69, 4, 1306);
    			attr_dev(div0, "class", "menu svelte-x93b5j");
    			add_location(div0, file, 48, 0, 870);
    			add_location(br, file, 77, 2, 1497);
    			attr_dev(a, "class", "link svelte-x93b5j");
    			attr_dev(a, "target", "_new");
    			attr_dev(a, "href", "https://github.com/AGoblinKing/EarthRock");
    			add_location(a, file, 78, 2, 1505);
    			attr_dev(div1, "class", "notice svelte-x93b5j");
    			add_location(div1, file, 75, 0, 1410);
    			attr_dev(div2, "class", "intro svelte-x93b5j");
    			add_location(div2, file, 44, 0, 682);

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
    		init(this, options, instance, create_fragment, safe_not_equal, {});

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

    // (32:4) {#if $path !== false && $path !== ``}
    function create_if_block(ctx) {
    	let div;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "X";
    			attr_dev(div, "class", "svelte-1t2wqnu");
    			add_location(div, file$1, 32, 8, 561);

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
    		source: "(32:4) {#if $path !== false && $path !== ``}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let t0_value = (ctx.audo_playing ? `>` : `!>`) + "";
    	let t0;
    	let t1;
    	let dispose;
    	let if_block = ctx.$path !== false && ctx.$path !== `` && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "svelte-1t2wqnu");
    			add_location(div0, file$1, 28, 4, 440);
    			attr_dev(div1, "class", "tools svelte-1t2wqnu");
    			add_location(div1, file$1, 27, 0, 416);
    			dispose = listen_dev(div0, "click", ctx.toggle, false, false, false);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div1, t1);
    			if (if_block) if_block.m(div1, null);
    		},
    		p: function update(changed, ctx) {
    			if (changed.audo_playing && t0_value !== (t0_value = (ctx.audo_playing ? `>` : `!>`) + "")) set_data_dev(t0, t0_value);

    			if (ctx.$path !== false && ctx.$path !== ``) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
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
    		path.set("");
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

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
    const COLUMNS = 32;
    const COUNT = 1024;

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

      const result = data_canvas.toDataURL(`image/png`);
      if (!random) {
        repo.set(key, result);
      }

      return result
    };

    /* src/ui/image/Tile.svelte generated by Svelte v3.14.1 */
    const file$2 = "src/ui/image/Tile.svelte";

    // (1:0) <script> import { onMount }
    function create_catch_block(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(1:0) <script> import { onMount }",
    		ctx
    	});

    	return block;
    }

    // (18:28)  <img     class="tileset"      alt="tileset image"     {src}
    function create_then_block(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "tileset svelte-1weudl2");
    			attr_dev(img, "alt", "tileset image");
    			if (img.src !== (img_src_value = ctx.src)) attr_dev(img, "src", img_src_value);
    			add_location(img, file$2, 18, 0, 286);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(18:28)  <img     class=\\\"tileset\\\"      alt=\\\"tileset image\\\"     {src}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script> import { onMount }
    function create_pending_block(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(1:0) <script> import { onMount }",
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
    			info.block.p(changed, assign(assign({}, ctx), info.resolved));
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
    	let { data = "" } = $$props;
    	let { width = 10 } = $$props;
    	let { height = 7 } = $$props;
    	let { random = false } = $$props;
    	let image_src = Tile({ width, height, data, random });
    	const writable_props = ["data", "width", "height", "random"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tile> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("data" in $$props) $$invalidate("data", data = $$props.data);
    		if ("width" in $$props) $$invalidate("width", width = $$props.width);
    		if ("height" in $$props) $$invalidate("height", height = $$props.height);
    		if ("random" in $$props) $$invalidate("random", random = $$props.random);
    	};

    	$$self.$capture_state = () => {
    		return { data, width, height, random, image_src };
    	};

    	$$self.$inject_state = $$props => {
    		if ("data" in $$props) $$invalidate("data", data = $$props.data);
    		if ("width" in $$props) $$invalidate("width", width = $$props.width);
    		if ("height" in $$props) $$invalidate("height", height = $$props.height);
    		if ("random" in $$props) $$invalidate("random", random = $$props.random);
    		if ("image_src" in $$props) $$invalidate("image_src", image_src = $$props.image_src);
    	};

    	return { data, width, height, random, image_src };
    }

    class Tile_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { data: 0, width: 0, height: 0, random: 0 });

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
    			add_location(div, file$3, 28, 0, 869);
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
    		if ("transform" in $$props) $$invalidate("transform", transform = $$props.transform);
    		if ("tru_zIndex" in $$props) $$invalidate("tru_zIndex", tru_zIndex = $$props.tru_zIndex);
    		if ("style" in $$props) $$invalidate("style", style = $$props.style);
    	};

    	let offset;
    	let tru_scale;
    	let transform;
    	let tru_zIndex;
    	let style;

    	$$self.$$.update = (changed = { anchor: 1, bias: 1, area: 1, scale: 1, position: 1, rotate: 1, tru_scale: 1, zIndex: 1, tru_zIndex: 1, transform: 1 }) => {
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

    		if (changed.position || changed.rotate || changed.tru_scale) {
    			 $$invalidate("transform", transform = `transform: translate(${Math.round(position[0])}px, ${Math.round(position[1])}px) rotate(${rotate}deg) scale(${tru_scale});`);
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

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
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
    		init(this, options, null, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Design",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

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

    const random = (count) => Array
      .from(new Array(count))
      .map(() => words[Math.floor(Math.random() * words.length)])
      .join(` `);

    const toJSON = (obj) => Object.fromEntries(
      Object.entries(obj)
        .filter(([key, val]) => {

        })
        .map(([key, val]) => {
          return [key, val.toJSON()]
        })
    );

    const powerToJSON = (obj) => {
      obj.toJSON = () => toJSON(obj);
      return obj
    };

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
      setInterval(() => {
        set(tick.get() + 1);
      }, tick_rate);
    });

    const frame = read([0, 0], (set) => {
      let old;
      const frame_t = (ts) => {
        requestAnimationFrame(frame_t);

        if (old === undefined) old = ts;
        const dt = ts - old;

        set([dt, ts]);
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

    const test$1 = read(breaker([
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
        test$1.get()
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
    } = false) => powerToJSON({
      ...(knots[knot]
        ? knots[knot]({
          ...rest,
          id
        })
        : { knot: read(knot) }
      ),

      id: read(id)
    });

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
        })
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
      w.names = derived$1(w.knots, ($knots) => Object.fromEntries(
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

      scale.set(target / 1618);
    });

    const zoom = derived$1(
      scroll,
      ({ deltaY }) => Math.min(3, Math.max(-0.5, deltaY * 0.01))
    );

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
        zoom: zoom,
        main: main
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
      knots: tie({
        mouse,
        time,
        screen: screen$1
      })
    });

    let feed_set;
    const feed = read({
      reader: ``
    }, (set) => {
      feed_set = set;
    });

    const SYSTEM = `sys`;

    let weaves_set;
    // weaves [name]weave
    const weaves = read({
      [SYSTEM]: system
    }, (set) => {
      weaves_set = set;
    });

    const highways = new Map();

    let running_set;
    // run the system weave by default (safe idle)
    const running$1 = read({
      [SYSTEM]: true
    }, (set) => { running_set = set; });

    const trash = write([]);

    const addr = (address) => {
      let path = address.split(`/`);
      if (path[0] === ``) path = path.slice(1);
      return path
    };
    // put into trash bin
    const del = (path) => {

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

          weaves_set(ws);
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
          console.warn(`knot undefined`);
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
        ...running$1.get(),
        [weave_name]: true
      });
    };

    const stop = (weave_name) => {
      if (weave_name === SYSTEM) {
        throw new Error(`CaN NoT StArT or StOp /${SYSTEM}`)
      }

      const h = highways.get(weave_name);

      const r = running$1.get();
      delete r[weave_name];

      running$1.set(r);

      if (h === undefined) {
        throw new Error(`can't stop ${weave_name}`)
      }

      h.forEach((cancel) => cancel());

      highways.delete(weave_name);
    };

    var Wheel$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        feed: feed,
        weaves: weaves,
        running: running$1,
        trash: trash,
        del: del,
        get: get,
        exists: exists,
        spawn: spawn,
        start: start,
        stop: stop
    });

    const down = read({}, (set) => {
      window.addEventListener(`keydown`, (e) => {
        if (
          e.target.tagName === `INPUT` ||
          e.target.tagName === `TEXTAREA`
        ) {
          return
        }

        e.preventDefault();

        set({
          ...down.get(),
          [e.key.toLowerCase()]: true
        });
      });

      window.addEventListener(`keyup`, (e) => {
        if (
          e.target.tagName === `INPUT` ||
          e.target.tagName === `TEXTAREA`
        ) {
          return
        }

        e.preventDefault();

        set({
          ...down.get(),
          [e.key.toLowerCase()]: false
        });
      });
    });

    // Which weave is being woven
    const woven = transformer((weave_id) =>
      get(weave_id)
    ).set(`sys`);

    const hoveree = write(``);
    const draggee = write(``);
    const drag_count = write(0);
    draggee.listen(() => drag_count.update($d => $d + 1));

    // 50rem between points
    const FORCE_PULL = 2;
    const FORCE_DECAY = 5;
    const MIN_MOVE = 32;
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

          const [[x, y], [o_x, o_y]] = [
            $positions[id],
            $positions[o_id]
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

    // TODO: These will hang around reactive statement?
    const translate_velocity = write([0, 0, 0]);
    const translate = read(translate_velocity.get(), (set) =>
      tick.listen(() => {
        const t = translate_velocity.get();
        const p = translate.get();
        if (length(t) === 0) return

        set([
          t[0] + p[0],
          t[1] + p[1],
          0
        ]);
        translate_velocity.set([0, 0, 0]);
      })
    );

    scroll.listen(([x, y]) => {
      if (down.get().shift) return
      translate_velocity.update(([t_x, t_y]) => [t_x + x, t_y + y, 0]);
    });

    const position_scale = derived$1([
      position,
      scale
    ], ([$position, $scale]) => [
      $position[0] / $scale,
      $position[1] / $scale,
      0
    ]);

    let zoom_val = 1;
    // take into account scale? No
    const zoom$1 = derived$1([
      scroll,
      scale
    ], ([
      $scroll,
      $scale
    ]) => {
      if (down.get().shift) {
        zoom_val = Math.max(0.25, zoom_val + $scroll[1] / 100);
      }

      return zoom_val * $scale
    });

    const zoom_dam = derived$1(tick, zoom$1.get);

    const Basic = () => ({
      knots: {
        mail: {
          knot: `mail`
        },
        stream: {
          knot: `stream`
        },
        math: {
          knot: `math`,
          math: `[v[0]/10, v[1]/10]`
        },
        stitch: {
          name: `player`,
          knot: `stitch`,
          value: {
            position: [0, 0],
            screen: null,
            foo: null
          }
        },
        main: {
          knot: `mail`,
          whom: `/sys/screen/main`
        },
        stream2: {
          knot: `stream`
        },
        screen2: {
          knot: `screen`
        },
        math2: {
          knot: `math`
        },
        math3: {
          knot: `math`
        }
      },
      threads: {
        mail: `stream`,
        stream: `math`,
        math: `stitch/position`,
        screen2: `main`,
        stream2: `stitch/foo`,
        stitch: `screen2`,
        "stitch/screen": `math2`,
        "stitch/foo": `math3`
      }
    });

    /* src/ui/weave/MainScreen.svelte generated by Svelte v3.14.1 */
    const file$5 = "src/ui/weave/MainScreen.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let insert_action;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "main svelte-1ux67z7");
    			toggle_class(div, "full", ctx.full);
    			add_location(div, file$5, 23, 0, 383);
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
    		init(this, options, instance$4, create_fragment$5, safe_not_equal, { full: 0 });

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

    /* src/ui/weave/Controls.svelte generated by Svelte v3.14.1 */
    const file$6 = "src/ui/weave/Controls.svelte";

    // (34:4) {:else}
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
    		source: "(34:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (32:4) {#if runs}
    function create_if_block$1(ctx) {
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
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(32:4) {#if runs}",
    		ctx
    	});

    	return block;
    }

    // (28:0) <Spatial   anchor={[50, 100]} >
    function create_default_slot$1(ctx) {
    	let div;
    	let dispose;

    	function select_block_type(changed, ctx) {
    		if (ctx.runs) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(null, ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "play svelte-xysojq");
    			toggle_class(div, "runs", ctx.runs);
    			add_location(div, file$6, 30, 2, 416);
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
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(28:0) <Spatial   anchor={[50, 100]} >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div;
    	let t;
    	let current;

    	const spatial = new Spatial({
    			props: {
    				anchor: [50, 100],
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			create_component(spatial.$$.fragment);
    			attr_dev(div, "class", "bar svelte-xysojq");
    			add_location(div, file$6, 25, 0, 357);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(spatial, target, anchor);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			const spatial_changes = {};

    			if (changed.$$scope || changed.runs) {
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
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			destroy_component(spatial, detaching);
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
    	let $running;

    	let $name,
    		$$unsubscribe_name = noop,
    		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

    	let $down;
    	validate_store(running$1, "running");
    	component_subscribe($$self, running$1, $$value => $$invalidate("$running", $running = $$value));
    	validate_store(down, "down");
    	component_subscribe($$self, down, $$value => $$invalidate("$down", $down = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
    	let { weave } = $$props;
    	let runs = $running[$name];

    	const toggle = () => {
    		if (runs) {
    			stop($name);
    		} else {
    			start($name);
    		}

    		$$invalidate("runs", runs = !runs);
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
    			runs,
    			name,
    			$running,
    			$name,
    			$down
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
    		if ("runs" in $$props) $$invalidate("runs", runs = $$props.runs);
    		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
    		if ("$running" in $$props) running$1.set($running = $$props.$running);
    		if ("$name" in $$props) name.set($name = $$props.$name);
    		if ("$down" in $$props) down.set($down = $$props.$down);
    	};

    	let name;

    	$$self.$$.update = (changed = { weave: 1, $down: 1 }) => {
    		if (changed.weave) {
    			 $$subscribe_name($$invalidate("name", name = weave.name));
    		}

    		if (changed.$down) {
    			 {
    				if ($down[" "]) toggle();
    			}
    		}
    	};

    	return { weave, runs, toggle, name };
    }

    class Controls extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$6, safe_not_equal, { weave: 0 });

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

    // TODO: This needs refactored

    // editor specific
    // like a real time query
    const first = writable(false);
    const second = writable(false);
    const match = writable(false);
    const del$1 = writable(false);

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

    // (109:2) {#if $first}
    function create_if_block_1(ctx) {
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
    			attr_dev(line, "class", "line svelte-d8klnk");
    			add_location(line, file$7, 109, 4, 3037);
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
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(109:2) {#if $first}",
    		ctx
    	});

    	return block;
    }

    // (131:6) {#if $recent.has(`${x_id}-${y_id}`)}
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
    			attr_dev(line, "class", "active svelte-d8klnk");
    			add_location(line, file$7, 131, 6, 3628);
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
    		source: "(131:6) {#if $recent.has(`${x_id}-${y_id}`)}",
    		ctx
    	});

    	return block;
    }

    // (121:2) {#each rects as [x, y, x_id, y_id]}
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
    			attr_dev(line, "class", "line svelte-d8klnk");
    			add_location(line, file$7, 121, 6, 3324);
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
    		source: "(121:2) {#each rects as [x, y, x_id, y_id]}",
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
    	let if_block = ctx.$first && create_if_block_1(ctx);
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
    			add_location(stop0, file$7, 89, 8, 2293);
    			attr_dev(stop1, "offset", "70%");
    			attr_dev(stop1, "stop-color", "#00F");
    			add_location(stop1, file$7, 90, 8, 2340);
    			attr_dev(linearGradient0, "id", "linear");
    			attr_dev(linearGradient0, "x1", "0%");
    			attr_dev(linearGradient0, "y1", "0%");
    			attr_dev(linearGradient0, "x2", "100%");
    			attr_dev(linearGradient0, "y2", "0%");
    			add_location(linearGradient0, file$7, 88, 6, 2222);
    			attr_dev(stop2, "offset", "30%");
    			attr_dev(stop2, "stop-color", "#00F");
    			add_location(stop2, file$7, 93, 10, 2488);
    			attr_dev(stop3, "offset", "70%");
    			attr_dev(stop3, "stop-color", "#F00");
    			add_location(stop3, file$7, 94, 10, 2537);
    			attr_dev(linearGradient1, "id", "linear-other");
    			attr_dev(linearGradient1, "x1", "0%");
    			attr_dev(linearGradient1, "y1", "0%");
    			attr_dev(linearGradient1, "x2", "100%");
    			attr_dev(linearGradient1, "y2", "0%");
    			add_location(linearGradient1, file$7, 92, 6, 2409);
    			attr_dev(stop4, "offset", "5%");
    			attr_dev(stop4, "stop-color", "#F00");
    			add_location(stop4, file$7, 97, 8, 2686);
    			attr_dev(stop5, "offset", "95%");
    			attr_dev(stop5, "stop-color", "#00F");
    			add_location(stop5, file$7, 99, 8, 2735);
    			attr_dev(linearGradient2, "id", "linear-dark");
    			attr_dev(linearGradient2, "x1", "0%");
    			attr_dev(linearGradient2, "y1", "0%");
    			attr_dev(linearGradient2, "x2", "100%");
    			attr_dev(linearGradient2, "y2", "0%");
    			add_location(linearGradient2, file$7, 96, 8, 2610);
    			attr_dev(stop6, "offset", "5%");
    			attr_dev(stop6, "stop-color", "#00F");
    			add_location(stop6, file$7, 102, 10, 2888);
    			attr_dev(stop7, "offset", "95%");
    			attr_dev(stop7, "stop-color", "#F00");
    			add_location(stop7, file$7, 104, 10, 2939);
    			attr_dev(linearGradient3, "id", "linear-other-dark");
    			attr_dev(linearGradient3, "x1", "0%");
    			attr_dev(linearGradient3, "y1", "0%");
    			attr_dev(linearGradient3, "x2", "100%");
    			attr_dev(linearGradient3, "y2", "0%");
    			add_location(linearGradient3, file$7, 101, 6, 2804);
    			add_location(defs, file$7, 87, 4, 2209);
    			attr_dev(svg, "width", svg_width_value = ctx.$size[0]);
    			attr_dev(svg, "height", svg_height_value = ctx.$size[1]);
    			attr_dev(svg, "class", "threads svelte-d8klnk");
    			add_location(svg, file$7, 86, 0, 2148);
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
    					if_block = create_if_block_1(ctx);
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

    	const recent = read(new Set(), set => {
    		let t = 0;
    		const deletes = {};

    		tick.subscribe(() => {
    			t += 250;
    			const dels = Object.entries(deletes);
    			if (dels.length === 0) return;
    			const r = recent.get();
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

    		feed.subscribe(({ writer, reader }) => {
    			if (!writer || !reader) return;
    			const [weave_write, ...local_write] = writer.split("/");
    			const [weave_read, ...local_read] = reader.split("/");
    			const weave_id = weave.name.get();
    			if (weave_id !== weave_write && weave_id !== weave_read) return;
    			const id = `${local_read.join("/")}-${local_write.join("/")}`;
    			const s_recent = recent.get();

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
    		init(this, options, instance$6, create_fragment$7, safe_not_equal, { weave: 0 });

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

    const whiten = (color, amount) => {
      color.blue += amount;
      color.red += amount;
      color.green += amount;

      return color
    };

    const negate$1 = (color) => {
      color.red = 1 - color.red;
      color.green = 1 - color.green;
      color.blue = 1 - color.blue;
      return color
    };

    var color$1 = (node, txt_init) => {
      const handler = {
        update: (txt) => {
          let col = Color(color(JSON.stringify(txt)));
          if (col.getLuminance() < 0.5) col = whiten(col, 0.5);

          // node.style.color = col.toString()
          negate$1(col);
          col.alpha = 0.5;
          node.style.backgroundColor = col.toCSS();
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

    const file$8 = "src/ui/weave/Knot.svelte";

    // (79:0) <Spatial   anchor = {[50, 50]}   position = {tru_position}   transition = {!dragging}   scale = {tru_scale}   {zIndex} >
    function create_default_slot$2(ctx) {
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
    			attr_dev(div0, "class", "knot svelte-1mdjxg");
    			add_location(div0, file$8, 90, 4, 1567);
    			attr_dev(div1, "class", "adjust");
    			add_location(div1, file$8, 85, 2, 1450);

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
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(79:0) <Spatial   anchor = {[50, 50]}   position = {tru_position}   transition = {!dragging}   scale = {tru_scale}   {zIndex} >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let current;

    	const spatial = new Spatial({
    			props: {
    				anchor: [50, 50],
    				position: ctx.tru_position,
    				transition: !ctx.dragging,
    				scale: ctx.tru_scale,
    				zIndex: ctx.zIndex,
    				$$slots: { default: [create_default_slot$2] },
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
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let $Mouse;
    	let $translate;
    	let $positions;

    	let $id,
    		$$unsubscribe_id = noop,
    		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

    	validate_store(position_scale, "Mouse");
    	component_subscribe($$self, position_scale, $$value => $$invalidate("$Mouse", $Mouse = $$value));
    	validate_store(translate, "translate");
    	component_subscribe($$self, translate, $$value => $$invalidate("$translate", $translate = $$value));
    	validate_store(positions, "positions");
    	component_subscribe($$self, positions, $$value => $$invalidate("$positions", $positions = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_id());
    	let { position = [0, 0, 0] } = $$props;
    	let { knot } = $$props;

    	const update = () => positions.set({
    		...positions.get(),
    		[knot.id.get()]: position
    	});

    	update();
    	let dragging = false;
    	let zIndex = 7;

    	const drag = e => {
    		if (dragging || e.target.classList.contains(`port`) || e.target.tagName === `INPUT` || e.target.tagName === `TEXTAREA`) {
    			return;
    		}

    		$$invalidate("dragging", dragging = true);
    		draggee.set(knot.id.get());

    		const handler = () => {
    			$$invalidate("dragging", dragging = false);
    			$$invalidate("position", position = [$Mouse[0] - $translate[0], $Mouse[1] - $translate[1], 0]);
    			update();
    			draggee.set("");
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
    		if ("position" in $$props) $$invalidate("position", position = $$props.position);
    		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
    		if ("$$scope" in $$props) $$invalidate("$$scope", $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return {
    			position,
    			knot,
    			dragging,
    			zIndex,
    			type,
    			id,
    			$Mouse,
    			$translate,
    			tru_position,
    			$positions,
    			tru_scale,
    			$id
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("position" in $$props) $$invalidate("position", position = $$props.position);
    		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
    		if ("dragging" in $$props) $$invalidate("dragging", dragging = $$props.dragging);
    		if ("zIndex" in $$props) $$invalidate("zIndex", zIndex = $$props.zIndex);
    		if ("type" in $$props) type = $$props.type;
    		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
    		if ("$Mouse" in $$props) position_scale.set($Mouse = $$props.$Mouse);
    		if ("$translate" in $$props) translate.set($translate = $$props.$translate);
    		if ("tru_position" in $$props) $$invalidate("tru_position", tru_position = $$props.tru_position);
    		if ("$positions" in $$props) positions.set($positions = $$props.$positions);
    		if ("tru_scale" in $$props) $$invalidate("tru_scale", tru_scale = $$props.tru_scale);
    		if ("$id" in $$props) id.set($id = $$props.$id);
    	};

    	let type;
    	let id;
    	let tru_position;
    	let tru_scale;

    	$$self.$$.update = (changed = { knot: 1, dragging: 1, $Mouse: 1, $translate: 1, $positions: 1 }) => {
    		if (changed.knot) {
    			 type = knot.knot;
    		}

    		if (changed.knot) {
    			 $$subscribe_id($$invalidate("id", id = knot.id));
    		}

    		if (changed.dragging || changed.$Mouse || changed.$translate || changed.$positions || changed.knot) {
    			 $$invalidate("tru_position", tru_position = add(dragging
    			? minus($Mouse, $translate)
    			: $positions[knot.id.get()]));
    		}

    		if (changed.dragging) {
    			 $$invalidate("tru_scale", tru_scale = dragging ? 1.168 : 1);
    		}
    	};

    	return {
    		position,
    		knot,
    		dragging,
    		zIndex,
    		drag,
    		id,
    		tru_position,
    		tru_scale,
    		$id,
    		mouseover_handler,
    		mouseout_handler,
    		$$slots,
    		$$scope
    	};
    }

    class Knot extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$8, safe_not_equal, { position: 0, knot: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Knot",
    			options,
    			id: create_fragment$8.name
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

    const { Object: Object_1$1 } = globals;
    const file$9 = "src/ui/weave/Picker.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object_1$1.create(ctx);
    	child_ctx.kind = list[i][0];
    	child_ctx.fn = list[i][1];
    	return child_ctx;
    }

    // (65:0) {#if picking}
    function create_if_block$3(ctx) {
    	let current;

    	const knot_1 = new Knot({
    			props: {
    				position: ctx.position,
    				knot: ctx.knot,
    				$$slots: { default: [create_default_slot$3] },
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
    		source: "(65:0) {#if picking}",
    		ctx
    	});

    	return block;
    }

    // (71:6) {#each arr_knots as [kind, fn] (kind)}
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
    			attr_dev(div, "class", "kind svelte-1yi8mbp");
    			add_location(div, file$9, 71, 8, 1366);
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
    		source: "(71:6) {#each arr_knots as [kind, fn] (kind)}",
    		ctx
    	});

    	return block;
    }

    // (66:2) <Knot {position} {knot}>
    function create_default_slot$3(ctx) {
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

    			attr_dev(div0, "class", "title svelte-1yi8mbp");
    			add_location(div0, file$9, 67, 6, 1262);
    			attr_dev(div1, "class", "prompt");
    			add_location(div1, file$9, 66, 4, 1235);
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
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(66:2) <Knot {position} {knot}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div;
    	let current;
    	let dispose;
    	let if_block = ctx.picking && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div, "class", "picker svelte-1yi8mbp");
    			toggle_class(div, "picking", ctx.picking);
    			add_location(div, file$9, 59, 0, 1125);

    			dispose = [
    				listen_dev(window, "mouseup", ctx.nopick, false, false, false),
    				listen_dev(div, "mousedown", ctx.pick, false, false, false)
    			];
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			if (ctx.picking) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (changed.picking) {
    				toggle_class(div, "picking", ctx.picking);
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
    			if (if_block) if_block.d();
    			run_all(dispose);
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
    	let $Scaling;
    	let $size;
    	validate_store(scale, "Scaling");
    	component_subscribe($$self, scale, $$value => $$invalidate("$Scaling", $Scaling = $$value));
    	validate_store(size, "size");
    	component_subscribe($$self, size, $$value => $$invalidate("$size", $size = $$value));
    	let { weave } = $$props;
    	const knot = Knot_Factory();
    	let picking = false;

    	const pick = e => {
    		$$invalidate("position", position = [
    			e.x - 50 * $Scaling - $size[0] / 2 - translate.get()[0],
    			e.y + 10 * $Scaling - $size[1] / 2 - translate.get()[1],
    			0
    		]);

    		$$invalidate("picking", picking = true);
    	};

    	const nopick = () => {
    		$$invalidate("picking", picking = false);
    	};

    	const create = k => weave.add({ knot: k });

    	const cancels = [
    		match.subscribe(new_match => {
    			if (!new_match) return;
    			weave.give_thread.set(new_match);
    		}),
    		del$1.subscribe(port => {
    			if (!port) return;
    			const [id, type] = port.split("|");
    			if (type === "write") return;
    			weave.take_thread.set(id);
    		})
    	];

    	let position = [0, 0, 0];
    	const writable_props = ["weave"];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Picker> was created with unknown prop '${key}'`);
    	});

    	const mouseup_handler = ({ kind }) => create(kind);

    	$$self.$set = $$props => {
    		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
    	};

    	$$self.$capture_state = () => {
    		return {
    			weave,
    			picking,
    			position,
    			$Scaling,
    			$size,
    			arr_knots
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
    		if ("picking" in $$props) $$invalidate("picking", picking = $$props.picking);
    		if ("position" in $$props) $$invalidate("position", position = $$props.position);
    		if ("$Scaling" in $$props) scale.set($Scaling = $$props.$Scaling);
    		if ("$size" in $$props) size.set($size = $$props.$size);
    		if ("arr_knots" in $$props) $$invalidate("arr_knots", arr_knots = $$props.arr_knots);
    	};

    	let arr_knots;
    	 $$invalidate("arr_knots", arr_knots = Object.entries(knots));

    	return {
    		weave,
    		knot,
    		picking,
    		pick,
    		nopick,
    		create,
    		position,
    		arr_knots,
    		mouseup_handler
    	};
    }

    class Picker extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$9, safe_not_equal, { weave: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Picker",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (ctx.weave === undefined && !("weave" in props)) {
    			console.warn("<Picker> was created without expected prop 'weave'");
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
    const file$a = "src/ui/weave/explore/Channel.svelte";

    function create_fragment$a(ctx) {
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
    			attr_dev(div0, "class", "key svelte-1l7n89a");
    			add_location(div0, file$a, 13, 2, 154);
    			attr_dev(div1, "class", "value svelte-1l7n89a");
    			add_location(div1, file$a, 16, 2, 193);
    			attr_dev(div2, "class", "channel svelte-1l7n89a");
    			add_location(div2, file$a, 9, 0, 108);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$9, create_fragment$a, safe_not_equal, { channel: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Channel",
    			options,
    			id: create_fragment$a.name
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
    const file$b = "src/ui/weave/explore/Stitch.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = Object_1$2.create(ctx);
    	child_ctx.channel = list[i];
    	return child_ctx;
    }

    // (24:0) {#if open}
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
    			add_location(div, file$b, 24, 0, 395);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(changed, ctx) {
    			if (changed.chans) {
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
    		source: "(24:0) {#if open}",
    		ctx
    	});

    	return block;
    }

    // (26:0) {#each chans as channel}
    function create_each_block$2(ctx) {
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
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(26:0) {#each chans as channel}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div;
    	let t0;
    	let color_action;
    	let t1;
    	let if_block_anchor;
    	let current;
    	let dispose;
    	let if_block = ctx.open && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(ctx.$name);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div, "class", "stitch svelte-1u5uei9");
    			toggle_class(div, "open", ctx.open);
    			add_location(div, file$b, 14, 0, 276);
    			dispose = listen_dev(div, "click", ctx.click_handler, false, false, false);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			color_action = color$1.call(null, div, ctx.$name) || ({});
    			insert_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			if (!current || changed.$name) set_data_dev(t0, ctx.$name);
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
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (color_action && is_function(color_action.destroy)) color_action.destroy();
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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

    function instance$a($$self, $$props, $$invalidate) {
    	let $explore_open;

    	let $value,
    		$$unsubscribe_value = noop,
    		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

    	let $name,
    		$$unsubscribe_name = noop,
    		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

    	validate_store(explore_open, "explore_open");
    	component_subscribe($$self, explore_open, $$value => $$invalidate("$explore_open", $explore_open = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_value());
    	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
    	let { stitch } = $$props;
    	let { open = $explore_open } = $$props;
    	const writable_props = ["stitch", "open"];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Stitch> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate("open", open = !open);

    	$$self.$set = $$props => {
    		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
    		if ("open" in $$props) $$invalidate("open", open = $$props.open);
    	};

    	$$self.$capture_state = () => {
    		return {
    			stitch,
    			open,
    			$explore_open,
    			name,
    			value,
    			chans,
    			$value,
    			$name
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("stitch" in $$props) $$invalidate("stitch", stitch = $$props.stitch);
    		if ("open" in $$props) $$invalidate("open", open = $$props.open);
    		if ("$explore_open" in $$props) explore_open.set($explore_open = $$props.$explore_open);
    		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
    		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
    		if ("chans" in $$props) $$invalidate("chans", chans = $$props.chans);
    		if ("$value" in $$props) value.set($value = $$props.$value);
    		if ("$name" in $$props) name.set($name = $$props.$name);
    	};

    	let name;
    	let value;
    	let chans;

    	$$self.$$.update = (changed = { stitch: 1, $value: 1 }) => {
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
    		stitch,
    		open,
    		name,
    		value,
    		chans,
    		$name,
    		click_handler
    	};
    }

    class Stitch extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$b, safe_not_equal, { stitch: 0, open: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Stitch",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (ctx.stitch === undefined && !("stitch" in props)) {
    			console.warn("<Stitch> was created without expected prop 'stitch'");
    		}
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
    }

    /* src/ui/weave/explore/Weave.svelte generated by Svelte v3.14.1 */

    const { Object: Object_1$3 } = globals;
    const file$c = "src/ui/weave/explore/Weave.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = Object_1$3.create(ctx);
    	child_ctx.stitch = list[i];
    	return child_ctx;
    }

    // (24:0) {#if open}
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
    			add_location(div, file$c, 24, 2, 394);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(changed, ctx) {
    			if (changed.stitches) {
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
    		source: "(24:0) {#if open}",
    		ctx
    	});

    	return block;
    }

    // (26:4) {#each stitches as stitch}
    function create_each_block$3(ctx) {
    	let current;

    	const stitch = new Stitch({
    			props: { stitch: ctx.stitch },
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
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(26:4) {#each stitches as stitch}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div;
    	let t0;
    	let color_action;
    	let t1;
    	let if_block_anchor;
    	let current;
    	let dispose;
    	let if_block = ctx.open && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(ctx.$name);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div, "class", "weave svelte-7inicu");
    			toggle_class(div, "open", ctx.open);
    			add_location(div, file$c, 14, 0, 274);
    			dispose = listen_dev(div, "click", ctx.click_handler, false, false, false);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			color_action = color$1.call(null, div, ctx.$name) || ({});
    			insert_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			if (!current || changed.$name) set_data_dev(t0, ctx.$name);
    			if (is_function(color_action.update) && changed.$name) color_action.update.call(null, ctx.$name);

    			if (changed.open) {
    				toggle_class(div, "open", ctx.open);
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
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (color_action && is_function(color_action.destroy)) color_action.destroy();
    			if (detaching) detach_dev(t1);
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
    	let $explore_open;

    	let $names,
    		$$unsubscribe_names = noop,
    		$$subscribe_names = () => ($$unsubscribe_names(), $$unsubscribe_names = subscribe(names, $$value => $$invalidate("$names", $names = $$value)), names);

    	let $name,
    		$$unsubscribe_name = noop,
    		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

    	validate_store(explore_open, "explore_open");
    	component_subscribe($$self, explore_open, $$value => $$invalidate("$explore_open", $explore_open = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_names());
    	$$self.$$.on_destroy.push(() => $$unsubscribe_name());
    	let { weave } = $$props;
    	let { open = $explore_open } = $$props;
    	const writable_props = ["weave", "open"];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Weave> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate("open", open = !open);

    	$$self.$set = $$props => {
    		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
    		if ("open" in $$props) $$invalidate("open", open = $$props.open);
    	};

    	$$self.$capture_state = () => {
    		return {
    			weave,
    			open,
    			$explore_open,
    			name,
    			names,
    			stitches,
    			$names,
    			$name
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
    		if ("open" in $$props) $$invalidate("open", open = $$props.open);
    		if ("$explore_open" in $$props) explore_open.set($explore_open = $$props.$explore_open);
    		if ("name" in $$props) $$subscribe_name($$invalidate("name", name = $$props.name));
    		if ("names" in $$props) $$subscribe_names($$invalidate("names", names = $$props.names));
    		if ("stitches" in $$props) $$invalidate("stitches", stitches = $$props.stitches);
    		if ("$names" in $$props) names.set($names = $$props.$names);
    		if ("$name" in $$props) name.set($name = $$props.$name);
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
    		weave,
    		open,
    		name,
    		names,
    		stitches,
    		$name,
    		click_handler
    	};
    }

    class Weave$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$c, safe_not_equal, { weave: 0, open: 0 });

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

    	get open() {
    		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set open(value) {
    		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/ui/weave/Explore.svelte generated by Svelte v3.14.1 */

    const { Object: Object_1$4 } = globals;
    const file$d = "src/ui/weave/Explore.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = Object_1$4.create(ctx);
    	child_ctx.weave = list[i];
    	return child_ctx;
    }

    // (29:2) {#each ws as weave}
    function create_each_block$4(ctx) {
    	let current;

    	const weave_1 = new Weave$1({
    			props: { weave: ctx.weave },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(weave_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(weave_1, target, anchor);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			const weave_1_changes = {};
    			if (changed.ws) weave_1_changes.weave = ctx.weave;
    			weave_1.$set(weave_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(weave_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(weave_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(weave_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(29:2) {#each ws as weave}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let div1;
    	let input0;
    	let t0;
    	let div0;
    	let t1;
    	let input1;
    	let input1_placeholder_value;
    	let current;
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
    			input0 = element("input");
    			t0 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			input1 = element("input");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "filter");
    			attr_dev(input0, "placeholder", "");
    			add_location(input0, file$d, 21, 2, 296);
    			attr_dev(div0, "class", "weaves svelte-trtm7u");
    			add_location(div0, file$d, 27, 2, 365);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", input1_placeholder_value = `-${ctx.ws[ctx.ws.length - 1].name.get()} to delete`);
    			add_location(input1, file$d, 33, 2, 452);
    			attr_dev(div1, "class", "explore svelte-trtm7u");
    			add_location(div1, file$d, 20, 0, 272);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, input0);
    			append_dev(div1, t0);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div1, t1);
    			append_dev(div1, input1);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			if (changed.ws) {
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

    			if (!current || changed.ws && input1_placeholder_value !== (input1_placeholder_value = `-${ctx.ws[ctx.ws.length - 1].name.get()} to delete`)) {
    				attr_dev(input1, "placeholder", input1_placeholder_value);
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
    	let $weaves;
    	validate_store(weaves, "weaves");
    	component_subscribe($$self, weaves, $$value => $$invalidate("$weaves", $weaves = $$value));
    	let { weave } = $$props;
    	const writable_props = ["weave"];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Explore> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
    	};

    	$$self.$capture_state = () => {
    		return { weave, ws, $weaves };
    	};

    	$$self.$inject_state = $$props => {
    		if ("weave" in $$props) $$invalidate("weave", weave = $$props.weave);
    		if ("ws" in $$props) $$invalidate("ws", ws = $$props.ws);
    		if ("$weaves" in $$props) weaves.set($weaves = $$props.$weaves);
    	};

    	let ws;

    	$$self.$$.update = (changed = { $weaves: 1 }) => {
    		if (changed.$weaves) {
    			 $$invalidate("ws", ws = Object.values($weaves));
    		}
    	};

    	return { weave, ws };
    }

    class Explore extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$d, safe_not_equal, { weave: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Explore",
    			options,
    			id: create_fragment$d.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (ctx.weave === undefined && !("weave" in props)) {
    			console.warn("<Explore> was created without expected prop 'weave'");
    		}
    	}

    	get weave() {
    		throw new Error("<Explore>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set weave(value) {
    		throw new Error("<Explore>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/ui/weave/Port.svelte generated by Svelte v3.14.1 */
    const file$e = "src/ui/weave/Port.svelte";

    function create_fragment$e(ctx) {
    	let div;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "port svelte-1erz1ih");
    			attr_dev(div, "id", ctx.address);
    			toggle_class(div, "writable", ctx.writable);
    			toggle_class(div, "name", ctx.name);
    			add_location(div, file$e, 19, 0, 270);

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
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$d, create_fragment$e, safe_not_equal, { writable: 0, name: 0, address: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Port",
    			options,
    			id: create_fragment$e.name
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
    const file$f = "src/ui/weave/knot/Mail.svelte";

    function create_fragment$f(ctx) {
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

    	const tile = new Tile_1({
    			props: { width: 1, height: 1, random: true },
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
    			create_component(tile.$$.fragment);
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
    			attr_dev(div0, "class", "postage svelte-oi8u06");
    			add_location(div0, file$f, 13, 2, 247);
    			attr_dev(div1, "class", "port left svelte-oi8u06");
    			add_location(div1, file$f, 17, 4, 346);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "AdDrEsS hErE");
    			attr_dev(input, "class", "svelte-oi8u06");
    			add_location(input, file$f, 21, 6, 462);
    			attr_dev(div2, "class", "address svelte-oi8u06");
    			add_location(div2, file$f, 20, 4, 434);
    			attr_dev(div3, "class", "port right svelte-oi8u06");
    			add_location(div3, file$f, 23, 4, 544);
    			attr_dev(div4, "class", "center svelte-oi8u06");
    			add_location(div4, file$f, 16, 2, 321);
    			attr_dev(div5, "class", "mail svelte-oi8u06");
    			add_location(div5, file$f, 12, 0, 197);
    			dispose = listen_dev(input, "input", ctx.input_input_handler);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div0);
    			mount_component(tile, div0, null);
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
    			color_action = color$1.call(null, div5, ctx.$whom || "/???/") || ({});
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			const port0_changes = {};
    			if (changed.$id) port0_changes.address = `${ctx.$id}|write`;
    			port0.$set(port0_changes);

    			if (changed.$whom && input.value !== ctx.$whom) {
    				set_input_value(input, ctx.$whom);
    			}

    			const port1_changes = {};
    			if (changed.$id) port1_changes.address = `${ctx.$id}|read`;
    			port1.$set(port1_changes);
    			if (is_function(color_action.update) && changed.$whom) color_action.update.call(null, ctx.$whom || "/???/");
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tile.$$.fragment, local);
    			transition_in(port0.$$.fragment, local);
    			transition_in(port1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tile.$$.fragment, local);
    			transition_out(port0.$$.fragment, local);
    			transition_out(port1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(tile);
    			destroy_component(port0);
    			destroy_component(port1);
    			if (color_action && is_function(color_action.destroy)) color_action.destroy();
    			dispose();
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
    		init(this, options, instance$e, create_fragment$f, safe_not_equal, { knot: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Mail",
    			options,
    			id: create_fragment$f.name
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
    const file$g = "src/ui/weave/knot/Math.svelte";

    function create_fragment$g(ctx) {
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
    			attr_dev(div0, "class", "port svelte-v9inzo");
    			add_location(div0, file$g, 17, 4, 312);
    			attr_dev(textarea, "class", "text svelte-v9inzo");
    			attr_dev(textarea, "type", "text");
    			attr_dev(textarea, "placeholder", "2 + 2 = ChAiR");
    			add_location(textarea, file$g, 21, 6, 423);
    			attr_dev(div1, "class", "address svelte-v9inzo");
    			add_location(div1, file$g, 20, 4, 395);
    			attr_dev(div2, "class", "port svelte-v9inzo");
    			add_location(div2, file$g, 29, 4, 580);
    			attr_dev(div3, "class", "center svelte-v9inzo");
    			add_location(div3, file$g, 13, 2, 239);
    			attr_dev(div4, "class", "mail svelte-v9inzo");
    			add_location(div4, file$g, 12, 0, 218);
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
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$f, create_fragment$g, safe_not_equal, { knot: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Math",
    			options,
    			id: create_fragment$g.name
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
    const file$h = "src/ui/weave/knot/stitch/Channel.svelte";

    function create_fragment$h(ctx) {
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
    			attr_dev(div0, "class", "name svelte-1h7thcq");
    			add_location(div0, file$h, 29, 4, 561);
    			attr_dev(input, "class", "edit svelte-1h7thcq");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "JSON plz");
    			add_location(input, file$h, 30, 4, 596);
    			attr_dev(div1, "class", "vbox svelte-1h7thcq");
    			add_location(div1, file$h, 28, 2, 504);
    			attr_dev(div2, "class", "channel svelte-1h7thcq");
    			add_location(div2, file$h, 26, 0, 426);
    			dispose = listen_dev(input, "input", ctx.input_input_handler);
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
    			set_input_value(input, ctx.$chan);
    			color_action = color$1.call(null, div1, JSON.stringify(ctx.$chan)) || ({});
    			append_dev(div2, t3);
    			mount_component(port1, div2, null);
    			current = true;
    		},
    		p: function update(changed, ctx) {
    			const port0_changes = {};
    			if (changed.name) port0_changes.address = `${ctx.address(ctx.name)}|write`;
    			port0.$set(port0_changes);
    			if (!current || changed.name) set_data_dev(t1, ctx.name);

    			if (changed.$chan && input.value !== ctx.$chan) {
    				set_input_value(input, ctx.$chan);
    			}

    			if (is_function(color_action.update) && changed.$chan) color_action.update.call(null, JSON.stringify(ctx.$chan));
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
    	const edit = write($chan);
    	const address = channel => `${$id}/${channel}`;

    	const cancel = edit.subscribe(txt => {
    		let v = txt;

    		try {
    			v = JSON.parse(txt);
    		} catch(ex) {
    			
    		}

    		chan.set(v);
    	});

    	const writable_props = ["knot", "chan", "name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Channel> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		$chan = this.value;
    		chan.set($chan);
    	}

    	$$self.$set = $$props => {
    		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
    		if ("chan" in $$props) $$subscribe_chan($$invalidate("chan", chan = $$props.chan));
    		if ("name" in $$props) $$invalidate("name", name = $$props.name);
    	};

    	$$self.$capture_state = () => {
    		return { knot, chan, name, $chan, id, $id };
    	};

    	$$self.$inject_state = $$props => {
    		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
    		if ("chan" in $$props) $$subscribe_chan($$invalidate("chan", chan = $$props.chan));
    		if ("name" in $$props) $$invalidate("name", name = $$props.name);
    		if ("$chan" in $$props) chan.set($chan = $$props.$chan);
    		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
    		if ("$id" in $$props) id.set($id = $$props.$id);
    	};

    	let id;

    	$$self.$$.update = (changed = { knot: 1 }) => {
    		if (changed.knot) {
    			 $$subscribe_id($$invalidate("id", id = knot.id));
    		}
    	};

    	return {
    		knot,
    		chan,
    		name,
    		address,
    		$chan,
    		id,
    		input_input_handler
    	};
    }

    class Channel$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$h, safe_not_equal, { knot: 0, chan: 0, name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Channel",
    			options,
    			id: create_fragment$h.name
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
    const file$i = "src/ui/weave/knot/Stitch.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = Object_1$5.create(ctx);
    	child_ctx.chan_name = list[i][0];
    	child_ctx.chan = list[i][1];
    	return child_ctx;
    }

    // (43:4) {:else}
    function create_else_block$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "/\\/\\";
    			attr_dev(div, "class", "no-stitches svelte-11fs1hi");
    			add_location(div, file$i, 43, 6, 915);
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
    		source: "(43:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:4) {#each Object.entries($value) as [chan_name, chan] (chan_name)}
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
    		source: "(41:4) {#each Object.entries($value) as [chan_name, chan] (chan_name)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$i(ctx) {
    	let div0;
    	let t0;
    	let div2;
    	let div1;
    	let input0;
    	let color_action;
    	let t1;
    	let div3;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t2;
    	let input1;
    	let input1_placeholder_value;
    	let current;
    	let dispose;

    	const port = new Port({
    			props: { address: `${ctx.$id}|read` },
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
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			input1 = element("input");
    			attr_dev(div0, "class", "port svelte-11fs1hi");
    			add_location(div0, file$i, 30, 0, 554);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "edit svelte-11fs1hi");
    			attr_dev(input0, "placeholder", "Name It!");
    			add_location(input0, file$i, 36, 4, 667);
    			add_location(div1, file$i, 35, 2, 639);
    			attr_dev(div2, "class", "nameit svelte-11fs1hi");
    			add_location(div2, file$i, 34, 0, 616);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "add_channel svelte-11fs1hi");
    			attr_dev(input1, "placeholder", input1_placeholder_value = `-${Object.keys(ctx.$value)[0]} to remove!`);
    			add_location(input1, file$i, 46, 4, 971);
    			attr_dev(div3, "class", "board svelte-11fs1hi");
    			add_location(div3, file$i, 39, 0, 761);

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
    			insert_dev(target, div3, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(div3, null);
    			}

    			append_dev(div3, t2);
    			append_dev(div3, input1);
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
    			const each_value = Object.entries(ctx.$value);
    			group_outros();
    			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, div3, outro_and_destroy_block, create_each_block$5, t2, get_each_context$5);
    			check_outros();

    			if (each_value.length) {
    				if (each_1_else) {
    					each_1_else.d(1);
    					each_1_else = null;
    				}
    			} else if (!each_1_else) {
    				each_1_else = create_else_block$1(ctx);
    				each_1_else.c();
    				each_1_else.m(div3, t2);
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

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(port.$$.fragment, local);

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
    			if (detaching) detach_dev(div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (each_1_else) each_1_else.d();
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
    	let $value,
    		$$unsubscribe_value = noop,
    		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

    	let $id,
    		$$unsubscribe_id = noop,
    		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

    	let $name,
    		$$unsubscribe_name = noop,
    		$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate("$name", $name = $$value)), name);

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
    			$name
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
    		input0_input_handler,
    		input1_input_handler,
    		blur_handler
    	};
    }

    class Stitch$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$i, safe_not_equal, { knot: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Stitch",
    			options,
    			id: create_fragment$i.name
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
    const file$j = "src/ui/weave/knot/Stream.svelte";

    // (18:6) {#if $value === null}
    function create_if_block$6(ctx) {
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
    			attr_dev(div0, "class", "doit svelte-nx5066");
    			add_location(div0, file$j, 18, 8, 470);
    			attr_dev(div1, "class", "doit svelte-nx5066");
    			add_location(div1, file$j, 19, 8, 526);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    		},
    		i: function intro(local) {
    			if (!div0_intro) {
    				add_render_callback(() => {
    					div0_intro = create_in_transition(div0, fly, animation);
    					div0_intro.start();
    				});
    			}

    			if (!div1_intro) {
    				add_render_callback(() => {
    					div1_intro = create_in_transition(div1, fly, animation);
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
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(18:6) {#if $value === null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$j(ctx) {
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

    	let if_block = ctx.$value === null && create_if_block$6(ctx);

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
    			attr_dev(pre, "class", "flex svelte-nx5066");
    			add_location(pre, file$j, 16, 6, 375);
    			attr_dev(div0, "class", "value_add svelte-nx5066");
    			add_location(div0, file$j, 15, 4, 345);
    			attr_dev(div1, "class", "JSON svelte-nx5066");
    			add_location(div1, file$j, 14, 2, 303);
    			attr_dev(div2, "class", "box svelte-nx5066");
    			add_location(div2, file$j, 12, 0, 238);
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
    					if_block = create_if_block$6(ctx);
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
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let $id,
    		$$unsubscribe_id = noop,
    		$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate("$id", $id = $$value)), id);

    	let $value,
    		$$unsubscribe_value = noop,
    		$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate("$value", $value = $$value)), value);

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
    		return { knot, value, id, $id, $value };
    	};

    	$$self.$inject_state = $$props => {
    		if ("knot" in $$props) $$invalidate("knot", knot = $$props.knot);
    		if ("value" in $$props) $$subscribe_value($$invalidate("value", value = $$props.value));
    		if ("id" in $$props) $$subscribe_id($$invalidate("id", id = $$props.id));
    		if ("$id" in $$props) id.set($id = $$props.$id);
    		if ("$value" in $$props) value.set($value = $$props.$value);
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

    	return { knot, value, id, $id, $value };
    }

    class Stream extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$j, safe_not_equal, { knot: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Stream",
    			options,
    			id: create_fragment$j.name
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

    const file$k = "src/ui/weave/knot/Unknown.svelte";

    function create_fragment$k(ctx) {
    	let h1;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("Unknown Knot - ");
    			t1 = text(ctx.$type);
    			add_location(h1, file$k, 7, 0, 58);
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
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$j($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$j, create_fragment$k, safe_not_equal, { knot: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Unknown",
    			options,
    			id: create_fragment$k.name
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
    const file$l = "src/ui/weave/knot/Screen.svelte";

    function create_fragment$l(ctx) {
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
    			add_location(div0, file$l, 13, 2, 225);
    			attr_dev(img, "class", "view svelte-17c9bqw");
    			attr_dev(img, "alt", "mirror");
    			add_location(img, file$l, 17, 2, 303);
    			attr_dev(div1, "class", "port svelte-17c9bqw");
    			add_location(div1, file$l, 19, 2, 364);
    			attr_dev(div2, "class", "main svelte-17c9bqw");
    			add_location(div2, file$l, 12, 0, 204);
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
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$k($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$k, create_fragment$l, safe_not_equal, { knot: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Screen",
    			options,
    			id: create_fragment$l.name
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
    const file$m = "src/ui/weave/Weave.svelte";

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = Object_1$6.create(ctx);
    	child_ctx.knot = list[i];
    	return child_ctx;
    }

    // (57:2) <Knot      {knot}   >
    function create_default_slot$4(ctx) {
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
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(57:2) <Knot      {knot}   >",
    		ctx
    	});

    	return block;
    }

    // (56:0) {#each Object.values($knots) as knot (knot.id.get())}
    function create_each_block$6(key_1, ctx) {
    	let first;
    	let current;

    	const knot = new Knot({
    			props: {
    				knot: ctx.knot,
    				$$slots: { default: [create_default_slot$4] },
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
    		source: "(56:0) {#each Object.values($knots) as knot (knot.id.get())}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$m(ctx) {
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

    	const explor = new Explore({
    			props: { weave: ctx.weave },
    			$$inline: true
    		});

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
    			create_component(explor.$$.fragment);
    			t4 = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "knots svelte-t8mevq");

    			attr_dev(div, "style", div_style_value = [
    				`transform:`,
    				`scale(${Math.round(ctx.$zoom * 100) / 100})`,
    				`translate(${ctx.$translate[0]}px, ${ctx.$translate[1]}px)`,
    				`;`
    			].join(` `));

    			add_location(div, file$m, 43, 0, 910);
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
    			mount_component(explor, target, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(changed, ctx) {
    			const each_value = Object.values(ctx.$knots);
    			group_outros();
    			each_blocks = update_keyed_each(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, div, outro_and_destroy_block, create_each_block$6, null, get_each_context$6);
    			check_outros();

    			if (!current || (changed.$zoom || changed.$translate) && div_style_value !== (div_style_value = [
    				`transform:`,
    				`scale(${Math.round(ctx.$zoom * 100) / 100})`,
    				`translate(${ctx.$translate[0]}px, ${ctx.$translate[1]}px)`,
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
    			transition_in(explor.$$.fragment, local);

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
    			transition_out(explor.$$.fragment, local);

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
    			destroy_component(explor, detaching);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
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
    	let $zoom;
    	let $translate;
    	let $knots;
    	validate_store(zoom_dam, "zoom");
    	component_subscribe($$self, zoom_dam, $$value => $$invalidate("$zoom", $zoom = $$value));
    	validate_store(translate, "translate");
    	component_subscribe($$self, translate, $$value => $$invalidate("$translate", $translate = $$value));
    	const { basic: weave } = spawn({ basic: Basic() });
    	woven.set(weave.name.get());
    	const knots = weave.knots;
    	validate_store(knots, "knots");
    	component_subscribe($$self, knots, value => $$invalidate("$knots", $knots = value));

    	const get_ui = knot => {
    		const ui = knot_kinds[knot.knot.get()];
    		return ui === undefined ? Unknown : ui;
    	};

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("$zoom" in $$props) zoom_dam.set($zoom = $$props.$zoom);
    		if ("$translate" in $$props) translate.set($translate = $$props.$translate);
    		if ("$knots" in $$props) knots.set($knots = $$props.$knots);
    	};

    	return {
    		weave,
    		knots,
    		get_ui,
    		$zoom,
    		$translate,
    		$knots
    	};
    }

    class Weave$2 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$l, create_fragment$m, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Weave",
    			options,
    			id: create_fragment$m.name
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
    const file$n = "src/ui/app/Credits.svelte";

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

    // (72:4) {#each Object.entries(sub2) as [h3, link]}
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
    			add_location(a, file$n, 72, 10, 2073);
    			add_location(h3, file$n, 72, 6, 2069);
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
    		source: "(72:4) {#each Object.entries(sub2) as [h3, link]}",
    		ctx
    	});

    	return block;
    }

    // (70:2) {#each Object.entries(sub1) as [h2, sub2]}
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
    			add_location(h2, file$n, 70, 4, 2002);
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
    		source: "(70:2) {#each Object.entries(sub1) as [h2, sub2]}",
    		ctx
    	});

    	return block;
    }

    // (68:0) {#each Object.entries(credits) as [h1, sub1]}
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
    			attr_dev(h1, "class", "svelte-106oxtp");
    			add_location(h1, file$n, 68, 2, 1939);
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
    		source: "(68:0) {#each Object.entries(credits) as [h1, sub1]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$n(ctx) {
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

    			attr_dev(div, "class", "credits svelte-106oxtp");
    			add_location(div, file$n, 66, 0, 1856);
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
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$m($$self) {
    	const credits = {
    		"EarthRock": {
    			"Open Source": {
    				"github.com/agoblinking/earthrock": "http://github.com/agoblinking/earthrock"
    			},
    			"Producer": {
    				"A Goblin King": "mailto:agolbinking@earthrock.run"
    			},
    			"Designer": {
    				"J. Goblin": "mailto:j.goblin@earthrock.run"
    			},
    			"Artist": {
    				"Jorsch Goblin": "mailto:jorsch_goblin@earthrock.run"
    			},
    			"Original Sound Track": {
    				"DayStar Collective": `https://music.apple.com/us/artist/daystar-collective/1484557546`
    			},
    			"Programmer": { "Glaive": "mailto:glaive@earthrock.run" },
    			"Operations": {
    				"These Are All": "mailto:pseudonyms@earthrock.run"
    			}
    		},
    		"External": {
    			"Assets": { "Kenney": `http://assetjesus.com` },
    			"Services": { "GitHub": `http://github.com/` },
    			"Libraries": {
    				"TWGL.js": "https://github.com/greggman/twgl.js",
    				"Svelte": "https://github.com/sveltejs/svelte",
    				"color": "https://github.com/Qix-/color",
    				"Tone.js": "https://github.com/Tonejs/Tone.js",
    				"Rollup": "https://github.com/rollup/rollup",
    				"Node.js": "https://nodejs.org",
    				"cuid": "",
    				"expr-eval": "",
    				"A Ton of Roll Up Plugins": "https://github.com/AGoblinKing/EarthRock/blob/master/package.json"
    			},
    			"Languages": {
    				"Go": "https://golang.org/",
    				"JavaScript": "http://devdocs.io"
    			},
    			"IDE": {
    				"Visual Studio Code": "https://code.visualstudio.com/",
    				"Theme - Cyberpunk - UMBRA protocol": "https://marketplace.visualstudio.com/items?itemName=max-SS.cyberpunk"
    			}
    		},
    		"Special Thanks": {
    			"Greg": {},
    			"Robert": {},
    			"Luna": {},
    			"Godzirra the Burninator": {},
    			"Ember": {},
    			"Tic Tac Toe": {}
    		}
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
    		init(this, options, instance$m, create_fragment$n, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Credits",
    			options,
    			id: create_fragment$n.name
    		});
    	}
    }

    /* src/ui/app/app.svelte generated by Svelte v3.14.1 */
    const file$o = "src/ui/app/app.svelte";

    function create_fragment$o(ctx) {
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
    	const tile = new Tile_1({ props: { random: true }, $$inline: true });

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			t0 = space();
    			create_component(tools.$$.fragment);
    			t1 = space();
    			div = element("div");
    			create_component(tile.$$.fragment);
    			attr_dev(div, "class", "background svelte-4esgp2");
    			add_location(div, file$o, 28, 0, 563);
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
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$n($$self, $$props, $$invalidate) {
    	let $view;

    	const paths = {
    		cards: Design,
    		weave: Weave$2,
    		"/": Intro,
    		credits: Credits
    	};

    	let view = derived$1(path, $path => paths[$path] || Intro);
    	validate_store(view, "view");
    	component_subscribe($$self, view, value => $$invalidate("$view", $view = value));

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("view" in $$props) $$invalidate("view", view = $$props.view);
    		if ("$view" in $$props) view.set($view = $$props.$view);
    	};

    	return { view, $view };
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$n, create_fragment$o, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$o.name
    		});
    	}
    }

    window.Wheel = Wheel$1;

    const app = new App({
      target: document.body,
      props: {
        name: `stage`
      }
    });

    return app;

}(Tone, cuid, twgl, exprEval, Color));
//# sourceMappingURL=bundle.js.map
