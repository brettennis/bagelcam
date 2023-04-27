
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
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
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
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
    function init_binding_group(group) {
        let _inputs;
        return {
            /* push */ p(...inputs) {
                _inputs = inputs;
                _inputs.forEach(input => group.push(input));
            },
            /* remove */ r() {
                _inputs.forEach(input => group.splice(group.indexOf(input), 1));
            }
        };
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
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
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
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
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.57.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/Header.svelte generated by Svelte v3.57.0 */

    const file$6 = "src/Header.svelte";

    function create_fragment$6(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "backdrop svelte-vbptm7");
    			add_location(div, file$6, 4, 0, 21);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/RadioOptions.svelte generated by Svelte v3.57.0 */

    const file$5 = "src/RadioOptions.svelte";

    function create_fragment$5(ctx) {
    	let div2;
    	let h3;
    	let t0;
    	let t1;
    	let div1;
    	let div0;
    	let t2;
    	let label0;
    	let input0;
    	let t3;
    	let t4;
    	let t5;
    	let label1;
    	let input1;
    	let t6;
    	let t7;
    	let t8;
    	let label2;
    	let input2;
    	let t9;
    	let t10;
    	let t11;
    	let label3;
    	let input3;
    	let t12;
    	let t13;
    	let binding_group;
    	let mounted;
    	let dispose;
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[8][0]);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h3 = element("h3");
    			t0 = text(/*id*/ ctx[1]);
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			label0 = element("label");
    			input0 = element("input");
    			t3 = space();
    			t4 = text(/*opt1*/ ctx[2]);
    			t5 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t6 = space();
    			t7 = text(/*opt2*/ ctx[3]);
    			t8 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t9 = space();
    			t10 = text(/*opt3*/ ctx[4]);
    			t11 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t12 = space();
    			t13 = text(/*opt4*/ ctx[5]);
    			attr_dev(h3, "class", "svelte-in6cpj");
    			add_location(h3, file$5, 15, 4, 286);
    			attr_dev(div0, "class", "selected svelte-in6cpj");
    			set_style(div0, "--selectedPosition", /*selectedPosition*/ ctx[6] + "%");
    			add_location(div0, file$5, 19, 8, 336);
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "name", /*id*/ ctx[1]);
    			input0.__value = 1;
    			input0.value = input0.__value;
    			attr_dev(input0, "class", "svelte-in6cpj");
    			add_location(input0, file$5, 22, 12, 457);
    			attr_dev(label0, "class", "option svelte-in6cpj");
    			add_location(label0, file$5, 21, 8, 422);
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "name", /*id*/ ctx[1]);
    			input1.__value = 2;
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-in6cpj");
    			add_location(input1, file$5, 27, 12, 604);
    			attr_dev(label1, "class", "option svelte-in6cpj");
    			add_location(label1, file$5, 26, 8, 569);
    			attr_dev(input2, "type", "radio");
    			attr_dev(input2, "name", /*id*/ ctx[1]);
    			input2.__value = 3;
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-in6cpj");
    			add_location(input2, file$5, 32, 12, 751);
    			attr_dev(label2, "class", "option svelte-in6cpj");
    			add_location(label2, file$5, 31, 8, 716);
    			attr_dev(input3, "type", "radio");
    			attr_dev(input3, "name", /*id*/ ctx[1]);
    			input3.__value = 4;
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-in6cpj");
    			add_location(input3, file$5, 37, 12, 898);
    			attr_dev(label3, "class", "option svelte-in6cpj");
    			add_location(label3, file$5, 36, 8, 863);
    			attr_dev(div1, "class", "options svelte-in6cpj");
    			add_location(div1, file$5, 17, 4, 305);
    			attr_dev(div2, "class", "backdrop svelte-in6cpj");
    			add_location(div2, file$5, 13, 0, 258);
    			binding_group.p(input0, input1, input2, input3);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h3);
    			append_dev(h3, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t2);
    			append_dev(div1, label0);
    			append_dev(label0, input0);
    			input0.checked = input0.__value === /*optionChosen*/ ctx[0];
    			append_dev(label0, t3);
    			append_dev(label0, t4);
    			append_dev(div1, t5);
    			append_dev(div1, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*optionChosen*/ ctx[0];
    			append_dev(label1, t6);
    			append_dev(label1, t7);
    			append_dev(div1, t8);
    			append_dev(div1, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*optionChosen*/ ctx[0];
    			append_dev(label2, t9);
    			append_dev(label2, t10);
    			append_dev(div1, t11);
    			append_dev(div1, label3);
    			append_dev(label3, input3);
    			input3.checked = input3.__value === /*optionChosen*/ ctx[0];
    			append_dev(label3, t12);
    			append_dev(label3, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[7]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[9]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[10]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*id*/ 2) set_data_dev(t0, /*id*/ ctx[1]);

    			if (dirty & /*selectedPosition*/ 64) {
    				set_style(div0, "--selectedPosition", /*selectedPosition*/ ctx[6] + "%");
    			}

    			if (dirty & /*id*/ 2) {
    				attr_dev(input0, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input0.checked = input0.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt1*/ 4) set_data_dev(t4, /*opt1*/ ctx[2]);

    			if (dirty & /*id*/ 2) {
    				attr_dev(input1, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input1.checked = input1.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt2*/ 8) set_data_dev(t7, /*opt2*/ ctx[3]);

    			if (dirty & /*id*/ 2) {
    				attr_dev(input2, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input2.checked = input2.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt3*/ 16) set_data_dev(t10, /*opt3*/ ctx[4]);

    			if (dirty & /*id*/ 2) {
    				attr_dev(input3, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input3.checked = input3.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt4*/ 32) set_data_dev(t13, /*opt4*/ ctx[5]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			binding_group.r();
    			mounted = false;
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
    	let selectedPosition;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('RadioOptions', slots, []);
    	let { id } = $$props;
    	let { opt1 } = $$props;
    	let { opt2 } = $$props;
    	let { opt3 } = $$props;
    	let { opt4 } = $$props;
    	let { optionChosen = 1 } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<RadioOptions> was created without expected prop 'id'");
    		}

    		if (opt1 === undefined && !('opt1' in $$props || $$self.$$.bound[$$self.$$.props['opt1']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt1'");
    		}

    		if (opt2 === undefined && !('opt2' in $$props || $$self.$$.bound[$$self.$$.props['opt2']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt2'");
    		}

    		if (opt3 === undefined && !('opt3' in $$props || $$self.$$.bound[$$self.$$.props['opt3']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt3'");
    		}

    		if (opt4 === undefined && !('opt4' in $$props || $$self.$$.bound[$$self.$$.props['opt4']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt4'");
    		}
    	});

    	const writable_props = ['id', 'opt1', 'opt2', 'opt3', 'opt4', 'optionChosen'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<RadioOptions> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function input0_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	function input1_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	function input2_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	function input3_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('opt1' in $$props) $$invalidate(2, opt1 = $$props.opt1);
    		if ('opt2' in $$props) $$invalidate(3, opt2 = $$props.opt2);
    		if ('opt3' in $$props) $$invalidate(4, opt3 = $$props.opt3);
    		if ('opt4' in $$props) $$invalidate(5, opt4 = $$props.opt4);
    		if ('optionChosen' in $$props) $$invalidate(0, optionChosen = $$props.optionChosen);
    	};

    	$$self.$capture_state = () => ({
    		id,
    		opt1,
    		opt2,
    		opt3,
    		opt4,
    		optionChosen,
    		selectedPosition
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('opt1' in $$props) $$invalidate(2, opt1 = $$props.opt1);
    		if ('opt2' in $$props) $$invalidate(3, opt2 = $$props.opt2);
    		if ('opt3' in $$props) $$invalidate(4, opt3 = $$props.opt3);
    		if ('opt4' in $$props) $$invalidate(5, opt4 = $$props.opt4);
    		if ('optionChosen' in $$props) $$invalidate(0, optionChosen = $$props.optionChosen);
    		if ('selectedPosition' in $$props) $$invalidate(6, selectedPosition = $$props.selectedPosition);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*optionChosen*/ 1) {
    			// position white div based on option chosen
    			$$invalidate(6, selectedPosition = 25 * (optionChosen - 1));
    		}
    	};

    	return [
    		optionChosen,
    		id,
    		opt1,
    		opt2,
    		opt3,
    		opt4,
    		selectedPosition,
    		input0_change_handler,
    		$$binding_groups,
    		input1_change_handler,
    		input2_change_handler,
    		input3_change_handler
    	];
    }

    class RadioOptions extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			id: 1,
    			opt1: 2,
    			opt2: 3,
    			opt3: 4,
    			opt4: 5,
    			optionChosen: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RadioOptions",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get id() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt1() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt1(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt2() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt2(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt3() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt3(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt4() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt4(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get optionChosen() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set optionChosen(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Slider.svelte generated by Svelte v3.57.0 */

    const file$4 = "src/Slider.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let input0;
    	let input0_class_value;
    	let t;
    	let input1;
    	let input1_class_value;
    	let div_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input0 = element("input");
    			t = space();
    			input1 = element("input");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "class", input0_class_value = "slider" + /*variation*/ ctx[1] + " svelte-9ucqwc");
    			attr_dev(input0, "min", /*minval*/ ctx[2]);
    			attr_dev(input0, "max", /*maxval*/ ctx[3]);
    			add_location(input0, file$4, 22, 4, 518);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", input1_class_value = "param_val" + /*variation*/ ctx[1] + " svelte-9ucqwc");
    			input1.value = /*displayValue*/ ctx[4];
    			add_location(input1, file$4, 30, 1, 721);
    			attr_dev(div, "class", div_class_value = "backdrop" + /*variation*/ ctx[1] + " svelte-9ucqwc");
    			add_location(div, file$4, 21, 0, 480);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input0);
    			set_input_value(input0, /*sliderValue*/ ctx[0]);
    			append_dev(div, t);
    			append_dev(div, input1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*doDisplayValue*/ ctx[6], false, false, false, false),
    					listen_dev(input0, "mouseout", /*doDisplayLabel*/ ctx[7], false, false, false, false),
    					listen_dev(input0, "blur", blur_handler, false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input1, "focus", /*doDisplayValue*/ ctx[6], false, false, false, false),
    					listen_dev(input1, "blur", /*handleInput*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*variation*/ 2 && input0_class_value !== (input0_class_value = "slider" + /*variation*/ ctx[1] + " svelte-9ucqwc")) {
    				attr_dev(input0, "class", input0_class_value);
    			}

    			if (dirty & /*minval*/ 4) {
    				attr_dev(input0, "min", /*minval*/ ctx[2]);
    			}

    			if (dirty & /*maxval*/ 8) {
    				attr_dev(input0, "max", /*maxval*/ ctx[3]);
    			}

    			if (dirty & /*sliderValue*/ 1) {
    				set_input_value(input0, /*sliderValue*/ ctx[0]);
    			}

    			if (dirty & /*variation*/ 2 && input1_class_value !== (input1_class_value = "param_val" + /*variation*/ ctx[1] + " svelte-9ucqwc")) {
    				attr_dev(input1, "class", input1_class_value);
    			}

    			if (dirty & /*displayValue*/ 16 && input1.value !== /*displayValue*/ ctx[4]) {
    				prop_dev(input1, "value", /*displayValue*/ ctx[4]);
    			}

    			if (dirty & /*variation*/ 2 && div_class_value !== (div_class_value = "backdrop" + /*variation*/ ctx[1] + " svelte-9ucqwc")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
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

    const blur_handler = () => {
    	
    };

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Slider', slots, []);
    	let { id } = $$props;
    	let { variation = 1 } = $$props;
    	let { label } = $$props;
    	let { minval } = $$props;
    	let { maxval } = $$props;
    	let { defval } = $$props;
    	let { sliderValue = defval } = $$props;
    	let displayValue = label;
    	id += 0; // gets rid of warning

    	const handleInput = e => {
    		$$invalidate(0, sliderValue = e.target.value);
    		doDisplayLabel();
    	};

    	const doDisplayValue = () => {
    		$$invalidate(4, displayValue = sliderValue);
    	};

    	const doDisplayLabel = () => {
    		$$invalidate(4, displayValue = label);
    	};

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<Slider> was created without expected prop 'id'");
    		}

    		if (label === undefined && !('label' in $$props || $$self.$$.bound[$$self.$$.props['label']])) {
    			console.warn("<Slider> was created without expected prop 'label'");
    		}

    		if (minval === undefined && !('minval' in $$props || $$self.$$.bound[$$self.$$.props['minval']])) {
    			console.warn("<Slider> was created without expected prop 'minval'");
    		}

    		if (maxval === undefined && !('maxval' in $$props || $$self.$$.bound[$$self.$$.props['maxval']])) {
    			console.warn("<Slider> was created without expected prop 'maxval'");
    		}

    		if (defval === undefined && !('defval' in $$props || $$self.$$.bound[$$self.$$.props['defval']])) {
    			console.warn("<Slider> was created without expected prop 'defval'");
    		}
    	});

    	const writable_props = ['id', 'variation', 'label', 'minval', 'maxval', 'defval', 'sliderValue'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Slider> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		sliderValue = to_number(this.value);
    		$$invalidate(0, sliderValue);
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(8, id = $$props.id);
    		if ('variation' in $$props) $$invalidate(1, variation = $$props.variation);
    		if ('label' in $$props) $$invalidate(9, label = $$props.label);
    		if ('minval' in $$props) $$invalidate(2, minval = $$props.minval);
    		if ('maxval' in $$props) $$invalidate(3, maxval = $$props.maxval);
    		if ('defval' in $$props) $$invalidate(10, defval = $$props.defval);
    		if ('sliderValue' in $$props) $$invalidate(0, sliderValue = $$props.sliderValue);
    	};

    	$$self.$capture_state = () => ({
    		id,
    		variation,
    		label,
    		minval,
    		maxval,
    		defval,
    		sliderValue,
    		displayValue,
    		handleInput,
    		doDisplayValue,
    		doDisplayLabel
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(8, id = $$props.id);
    		if ('variation' in $$props) $$invalidate(1, variation = $$props.variation);
    		if ('label' in $$props) $$invalidate(9, label = $$props.label);
    		if ('minval' in $$props) $$invalidate(2, minval = $$props.minval);
    		if ('maxval' in $$props) $$invalidate(3, maxval = $$props.maxval);
    		if ('defval' in $$props) $$invalidate(10, defval = $$props.defval);
    		if ('sliderValue' in $$props) $$invalidate(0, sliderValue = $$props.sliderValue);
    		if ('displayValue' in $$props) $$invalidate(4, displayValue = $$props.displayValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		sliderValue,
    		variation,
    		minval,
    		maxval,
    		displayValue,
    		handleInput,
    		doDisplayValue,
    		doDisplayLabel,
    		id,
    		label,
    		defval,
    		input0_change_input_handler
    	];
    }

    class Slider extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			id: 8,
    			variation: 1,
    			label: 9,
    			minval: 2,
    			maxval: 3,
    			defval: 10,
    			sliderValue: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Slider",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get id() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get variation() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variation(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get minval() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set minval(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get maxval() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maxval(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get defval() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set defval(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sliderValue() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sliderValue(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Sidebar.svelte generated by Svelte v3.57.0 */
    const file$3 = "src/Sidebar.svelte";

    function create_fragment$3(ctx) {
    	let div7;
    	let div0;
    	let h10;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let div6;
    	let div4;
    	let div1;
    	let h11;
    	let t7;
    	let slider0;
    	let updating_sliderValue;
    	let t8;
    	let div3;
    	let div2;
    	let t9;
    	let slider1;
    	let updating_sliderValue_1;
    	let t10;
    	let div5;
    	let radiooptions;
    	let updating_optionChosen;
    	let current;

    	function slider0_sliderValue_binding(value) {
    		/*slider0_sliderValue_binding*/ ctx[6](value);
    	}

    	let slider0_props = {
    		id: "mod-intensity",
    		variation: "2",
    		label: "intensity",
    		minval: 0,
    		maxval: 100,
    		defval: 0
    	};

    	if (/*mod_intensity*/ ctx[1] !== void 0) {
    		slider0_props.sliderValue = /*mod_intensity*/ ctx[1];
    	}

    	slider0 = new Slider({ props: slider0_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider0, 'sliderValue', slider0_sliderValue_binding));

    	function slider1_sliderValue_binding(value) {
    		/*slider1_sliderValue_binding*/ ctx[7](value);
    	}

    	let slider1_props = {
    		id: "mod-wobbler",
    		variation: "2",
    		label: "wobbler",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*mod_wobbler*/ ctx[2] !== void 0) {
    		slider1_props.sliderValue = /*mod_wobbler*/ ctx[2];
    	}

    	slider1 = new Slider({ props: slider1_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider1, 'sliderValue', slider1_sliderValue_binding));

    	function radiooptions_optionChosen_binding(value) {
    		/*radiooptions_optionChosen_binding*/ ctx[8](value);
    	}

    	let radiooptions_props = {
    		id: "mod source",
    		opt1: "Audio Highs",
    		opt2: "Audio Lows",
    		opt3: "Movement",
    		opt4: "Wobbler"
    	};

    	if (/*mod_source*/ ctx[0] !== void 0) {
    		radiooptions_props.optionChosen = /*mod_source*/ ctx[0];
    	}

    	radiooptions = new RadioOptions({
    			props: radiooptions_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(radiooptions, 'optionChosen', radiooptions_optionChosen_binding));

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div0 = element("div");
    			h10 = element("h1");
    			h10.textContent = "presets";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "save";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "load";
    			t5 = space();
    			div6 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			h11 = element("h1");
    			h11.textContent = "mod";
    			t7 = space();
    			create_component(slider0.$$.fragment);
    			t8 = space();
    			div3 = element("div");
    			div2 = element("div");
    			t9 = space();
    			create_component(slider1.$$.fragment);
    			t10 = space();
    			div5 = element("div");
    			create_component(radiooptions.$$.fragment);
    			attr_dev(h10, "class", "svelte-ib0i95");
    			add_location(h10, file$3, 18, 8, 408);
    			attr_dev(button0, "class", "button2");
    			add_location(button0, file$3, 19, 8, 433);
    			attr_dev(button1, "class", "button2");
    			add_location(button1, file$3, 20, 8, 479);
    			attr_dev(div0, "class", "presets");
    			set_style(div0, "display", "none");
    			add_location(div0, file$3, 17, 4, 356);
    			attr_dev(h11, "class", "svelte-ib0i95");
    			add_location(h11, file$3, 27, 16, 651);
    			attr_dev(div1, "class", "mod-item-left");
    			add_location(div1, file$3, 26, 12, 607);
    			set_style(div2, "height", "1.5rem");
    			add_location(div2, file$3, 38, 16, 1026);
    			attr_dev(div3, "class", "mod-item-right");
    			add_location(div3, file$3, 37, 12, 981);
    			attr_dev(div4, "class", "mod-container svelte-ib0i95");
    			add_location(div4, file$3, 25, 8, 567);
    			attr_dev(div5, "class", "mod-source svelte-ib0i95");
    			add_location(div5, file$3, 50, 8, 1386);
    			attr_dev(div6, "class", "modulation");
    			add_location(div6, file$3, 23, 4, 533);
    			attr_dev(div7, "class", "backdrop svelte-ib0i95");
    			add_location(div7, file$3, 15, 0, 324);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div0);
    			append_dev(div0, h10);
    			append_dev(div0, t1);
    			append_dev(div0, button0);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(div7, t5);
    			append_dev(div7, div6);
    			append_dev(div6, div4);
    			append_dev(div4, div1);
    			append_dev(div1, h11);
    			append_dev(div1, t7);
    			mount_component(slider0, div1, null);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div3, t9);
    			mount_component(slider1, div3, null);
    			append_dev(div6, t10);
    			append_dev(div6, div5);
    			mount_component(radiooptions, div5, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const slider0_changes = {};

    			if (!updating_sliderValue && dirty & /*mod_intensity*/ 2) {
    				updating_sliderValue = true;
    				slider0_changes.sliderValue = /*mod_intensity*/ ctx[1];
    				add_flush_callback(() => updating_sliderValue = false);
    			}

    			slider0.$set(slider0_changes);
    			const slider1_changes = {};

    			if (!updating_sliderValue_1 && dirty & /*mod_wobbler*/ 4) {
    				updating_sliderValue_1 = true;
    				slider1_changes.sliderValue = /*mod_wobbler*/ ctx[2];
    				add_flush_callback(() => updating_sliderValue_1 = false);
    			}

    			slider1.$set(slider1_changes);
    			const radiooptions_changes = {};

    			if (!updating_optionChosen && dirty & /*mod_source*/ 1) {
    				updating_optionChosen = true;
    				radiooptions_changes.optionChosen = /*mod_source*/ ctx[0];
    				add_flush_callback(() => updating_optionChosen = false);
    			}

    			radiooptions.$set(radiooptions_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider0.$$.fragment, local);
    			transition_in(slider1.$$.fragment, local);
    			transition_in(radiooptions.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(slider0.$$.fragment, local);
    			transition_out(slider1.$$.fragment, local);
    			transition_out(radiooptions.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			destroy_component(slider0);
    			destroy_component(slider1);
    			destroy_component(radiooptions);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sidebar', slots, []);
    	const colorA_hex = "#FFFFFF";
    	const colorB_hex = "#000000";
    	const colorC_hex = "#808080";
    	let mod_source = 1;
    	let mod_intensity = 0;
    	let mod_wobbler = 50;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	function slider0_sliderValue_binding(value) {
    		mod_intensity = value;
    		$$invalidate(1, mod_intensity);
    	}

    	function slider1_sliderValue_binding(value) {
    		mod_wobbler = value;
    		$$invalidate(2, mod_wobbler);
    	}

    	function radiooptions_optionChosen_binding(value) {
    		mod_source = value;
    		$$invalidate(0, mod_source);
    	}

    	$$self.$capture_state = () => ({
    		RadioOptions,
    		Slider,
    		colorA_hex,
    		colorB_hex,
    		colorC_hex,
    		mod_source,
    		mod_intensity,
    		mod_wobbler
    	});

    	$$self.$inject_state = $$props => {
    		if ('mod_source' in $$props) $$invalidate(0, mod_source = $$props.mod_source);
    		if ('mod_intensity' in $$props) $$invalidate(1, mod_intensity = $$props.mod_intensity);
    		if ('mod_wobbler' in $$props) $$invalidate(2, mod_wobbler = $$props.mod_wobbler);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		mod_source,
    		mod_intensity,
    		mod_wobbler,
    		colorA_hex,
    		colorB_hex,
    		colorC_hex,
    		slider0_sliderValue_binding,
    		slider1_sliderValue_binding,
    		radiooptions_optionChosen_binding
    	];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			colorA_hex: 3,
    			colorB_hex: 4,
    			colorC_hex: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get colorA_hex() {
    		return this.$$.ctx[3];
    	}

    	set colorA_hex(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorB_hex() {
    		return this.$$.ctx[4];
    	}

    	set colorB_hex(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorC_hex() {
    		return this.$$.ctx[5];
    	}

    	set colorC_hex(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Toggle.svelte generated by Svelte v3.57.0 */

    const file$2 = "src/Toggle.svelte";

    // (11:4) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "height", "1.2rem");
    			add_location(div, file$2, 11, 4, 178);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(11:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (9:4) {#if showID}
    function create_if_block$1(ctx) {
    	let h3;
    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(/*id*/ ctx[1]);
    			attr_dev(h3, "class", "label svelte-57lb6n");
    			add_location(h3, file$2, 9, 4, 134);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*id*/ 2) set_data_dev(t, /*id*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(9:4) {#if showID}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let t0;
    	let label;
    	let input;
    	let t1;
    	let span;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*showID*/ ctx[2]) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t0 = space();
    			label = element("label");
    			input = element("input");
    			t1 = space();
    			span = element("span");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "svelte-57lb6n");
    			add_location(input, file$2, 15, 8, 263);
    			attr_dev(span, "class", "slider svelte-57lb6n");
    			add_location(span, file$2, 16, 8, 314);
    			attr_dev(label, "class", "switch svelte-57lb6n");
    			add_location(label, file$2, 14, 4, 232);
    			attr_dev(div, "class", "backdrop svelte-57lb6n");
    			add_location(div, file$2, 7, 0, 90);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    			append_dev(div, t0);
    			append_dev(div, label);
    			append_dev(label, input);
    			input.checked = /*opt*/ ctx[0];
    			append_dev(label, t1);
    			append_dev(label, span);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*input_change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t0);
    				}
    			}

    			if (dirty & /*opt*/ 1) {
    				input.checked = /*opt*/ ctx[0];
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    			mounted = false;
    			dispose();
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Toggle', slots, []);
    	let { id } = $$props;
    	let { showID = true } = $$props;
    	let { opt } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<Toggle> was created without expected prop 'id'");
    		}

    		if (opt === undefined && !('opt' in $$props || $$self.$$.bound[$$self.$$.props['opt']])) {
    			console.warn("<Toggle> was created without expected prop 'opt'");
    		}
    	});

    	const writable_props = ['id', 'showID', 'opt'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Toggle> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler() {
    		opt = this.checked;
    		$$invalidate(0, opt);
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('showID' in $$props) $$invalidate(2, showID = $$props.showID);
    		if ('opt' in $$props) $$invalidate(0, opt = $$props.opt);
    	};

    	$$self.$capture_state = () => ({ id, showID, opt });

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('showID' in $$props) $$invalidate(2, showID = $$props.showID);
    		if ('opt' in $$props) $$invalidate(0, opt = $$props.opt);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [opt, id, showID, input_change_handler];
    }

    class Toggle extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { id: 1, showID: 2, opt: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Toggle",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get id() {
    		throw new Error("<Toggle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Toggle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showID() {
    		throw new Error("<Toggle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showID(value) {
    		throw new Error("<Toggle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt() {
    		throw new Error("<Toggle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt(value) {
    		throw new Error("<Toggle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Control.svelte generated by Svelte v3.57.0 */
    const file$1 = "src/Control.svelte";

    // (303:8) {#if loading}
    function create_if_block_3(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "loading...";
    			add_location(h3, file$1, 303, 8, 7787);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(303:8) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (307:8) {#if !streaming}
    function create_if_block_2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "start";
    			attr_dev(button, "class", "button2");
    			add_location(button, file$1, 307, 8, 7863);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*init*/ ctx[29], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(307:8) {#if !streaming}",
    		ctx
    	});

    	return block;
    }

    // (322:8) {#if poster_A}
    function create_if_block_1(ctx) {
    	let canvas;
    	let canvas_style_value;

    	const block = {
    		c: function create() {
    			canvas = element("canvas");
    			attr_dev(canvas, "id", "v_out_ocv");
    			attr_dev(canvas, "width", wt);
    			attr_dev(canvas, "height", ht);

    			attr_dev(canvas, "style", canvas_style_value = /*viewport_showInput*/ ctx[10]
    			? "display:none"
    			: "display:block");

    			attr_dev(canvas, "class", "svelte-5agu1l");
    			add_location(canvas, file$1, 322, 8, 8372);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, canvas, anchor);
    			/*canvas_binding*/ ctx[34](canvas);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*viewport_showInput*/ 1024 && canvas_style_value !== (canvas_style_value = /*viewport_showInput*/ ctx[10]
    			? "display:none"
    			: "display:block")) {
    				attr_dev(canvas, "style", canvas_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(canvas);
    			/*canvas_binding*/ ctx[34](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(322:8) {#if poster_A}",
    		ctx
    	});

    	return block;
    }

    // (341:12) {#if streaming}
    function create_if_block(ctx) {
    	let p;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("FPS: ");
    			t1 = text(/*fps*/ ctx[3]);
    			attr_dev(p, "class", "fps svelte-5agu1l");
    			add_location(p, file$1, 341, 12, 8980);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*fps*/ 8) set_data_dev(t1, /*fps*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(341:12) {#if streaming}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let script;
    	let script_src_value;
    	let t0;
    	let div18;
    	let div2;
    	let t1;
    	let t2;
    	let video;
    	let video_style_value;
    	let t3;
    	let canvas0;
    	let canvas0_style_value;
    	let t4;
    	let t5;
    	let canvas1;
    	let t6;
    	let div1;
    	let div0;
    	let button0;
    	let t8;
    	let button1;
    	let t10;
    	let t11;
    	let div4;
    	let input0;
    	let t12;
    	let label0;
    	let t13;
    	let div3;
    	let slider0;
    	let updating_sliderValue;
    	let t14;
    	let slider1;
    	let updating_sliderValue_1;
    	let t15;
    	let slider2;
    	let updating_sliderValue_2;
    	let t16;
    	let div6;
    	let input1;
    	let t17;
    	let label1;
    	let t18;
    	let div5;
    	let radiooptions;
    	let updating_optionChosen;
    	let t19;
    	let slider3;
    	let updating_sliderValue_3;
    	let t20;
    	let slider4;
    	let updating_sliderValue_4;
    	let t21;
    	let div8;
    	let input2;
    	let t22;
    	let label2;
    	let t23;
    	let div7;
    	let slider5;
    	let updating_sliderValue_5;
    	let t24;
    	let div13;
    	let input3;
    	let t25;
    	let label3;
    	let t26;
    	let div12;
    	let div11;
    	let toggle0;
    	let updating_opt;
    	let t27;
    	let div9;
    	let input4;
    	let t28;
    	let toggle1;
    	let updating_opt_1;
    	let t29;
    	let div10;
    	let input5;
    	let t30;
    	let slider6;
    	let updating_sliderValue_6;
    	let t31;
    	let div15;
    	let input6;
    	let t32;
    	let label4;
    	let t33;
    	let div14;
    	let slider7;
    	let updating_sliderValue_7;
    	let t34;
    	let div17;
    	let input7;
    	let t35;
    	let label5;
    	let t36;
    	let div16;
    	let slider8;
    	let updating_sliderValue_8;
    	let t37;
    	let slider9;
    	let updating_sliderValue_9;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*loading*/ ctx[8] && create_if_block_3(ctx);
    	let if_block1 = !/*streaming*/ ctx[9] && create_if_block_2(ctx);
    	let if_block2 = /*poster_A*/ ctx[26] && create_if_block_1(ctx);
    	let if_block3 = /*streaming*/ ctx[9] && create_if_block(ctx);

    	function slider0_sliderValue_binding(value) {
    		/*slider0_sliderValue_binding*/ ctx[37](value);
    	}

    	let slider0_props = {
    		id: "eff-filter-temp",
    		label: "temp",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*filter_temp*/ ctx[18] !== void 0) {
    		slider0_props.sliderValue = /*filter_temp*/ ctx[18];
    	}

    	slider0 = new Slider({ props: slider0_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider0, 'sliderValue', slider0_sliderValue_binding));

    	function slider1_sliderValue_binding(value) {
    		/*slider1_sliderValue_binding*/ ctx[38](value);
    	}

    	let slider1_props = {
    		id: "eff-filter-saturate",
    		label: "saturate",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*filter_saturate*/ ctx[19] !== void 0) {
    		slider1_props.sliderValue = /*filter_saturate*/ ctx[19];
    	}

    	slider1 = new Slider({ props: slider1_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider1, 'sliderValue', slider1_sliderValue_binding));

    	function slider2_sliderValue_binding(value) {
    		/*slider2_sliderValue_binding*/ ctx[39](value);
    	}

    	let slider2_props = {
    		id: "eff-filter-bright",
    		label: "bright",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*filter_bright*/ ctx[20] !== void 0) {
    		slider2_props.sliderValue = /*filter_bright*/ ctx[20];
    	}

    	slider2 = new Slider({ props: slider2_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider2, 'sliderValue', slider2_sliderValue_binding));

    	function radiooptions_optionChosen_binding(value) {
    		/*radiooptions_optionChosen_binding*/ ctx[41](value);
    	}

    	let radiooptions_props = {
    		id: "ghost mode",
    		opt1: "RedGreenBlue",
    		opt2: "Brighter",
    		opt3: "Darker",
    		opt4: "Solid"
    	};

    	if (/*ghost_mode*/ ctx[12] !== void 0) {
    		radiooptions_props.optionChosen = /*ghost_mode*/ ctx[12];
    	}

    	radiooptions = new RadioOptions({
    			props: radiooptions_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(radiooptions, 'optionChosen', radiooptions_optionChosen_binding));

    	function slider3_sliderValue_binding(value) {
    		/*slider3_sliderValue_binding*/ ctx[42](value);
    	}

    	let slider3_props = {
    		id: "eff-ghost-amount",
    		label: "amount",
    		minval: 0,
    		maxval: 30,
    		defval: 1
    	};

    	if (/*ghost_amount*/ ctx[13] !== void 0) {
    		slider3_props.sliderValue = /*ghost_amount*/ ctx[13];
    	}

    	slider3 = new Slider({ props: slider3_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider3, 'sliderValue', slider3_sliderValue_binding));

    	function slider4_sliderValue_binding(value) {
    		/*slider4_sliderValue_binding*/ ctx[43](value);
    	}

    	let slider4_props = {
    		id: "eff-ghost-delay",
    		label: "delay",
    		minval: 0,
    		maxval: 30,
    		defval: 1
    	};

    	if (/*ghost_delay*/ ctx[14] !== void 0) {
    		slider4_props.sliderValue = /*ghost_delay*/ ctx[14];
    	}

    	slider4 = new Slider({ props: slider4_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider4, 'sliderValue', slider4_sliderValue_binding));

    	function slider5_sliderValue_binding(value) {
    		/*slider5_sliderValue_binding*/ ctx[45](value);
    	}

    	let slider5_props = {
    		id: "eff-chroma-threshold",
    		label: "threshold",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*chroma_threshold*/ ctx[22] !== void 0) {
    		slider5_props.sliderValue = /*chroma_threshold*/ ctx[22];
    	}

    	slider5 = new Slider({ props: slider5_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider5, 'sliderValue', slider5_sliderValue_binding));

    	function toggle0_opt_binding(value) {
    		/*toggle0_opt_binding*/ ctx[47](value);
    	}

    	let toggle0_props = { id: "bg", showID: true };

    	if (/*movey_bg*/ ctx[25] !== void 0) {
    		toggle0_props.opt = /*movey_bg*/ ctx[25];
    	}

    	toggle0 = new Toggle({ props: toggle0_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle0, 'opt', toggle0_opt_binding));

    	function toggle1_opt_binding(value) {
    		/*toggle1_opt_binding*/ ctx[49](value);
    	}

    	let toggle1_props = { id: "fg", showID: true };

    	if (/*movey_fg*/ ctx[24] !== void 0) {
    		toggle1_props.opt = /*movey_fg*/ ctx[24];
    	}

    	toggle1 = new Toggle({ props: toggle1_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle1, 'opt', toggle1_opt_binding));

    	function slider6_sliderValue_binding(value) {
    		/*slider6_sliderValue_binding*/ ctx[51](value);
    	}

    	let slider6_props = {
    		id: "eff-movey-threshold",
    		label: "threshold",
    		minval: 10,
    		maxval: 120,
    		defval: 40
    	};

    	if (/*movey_threshold*/ ctx[2] !== void 0) {
    		slider6_props.sliderValue = /*movey_threshold*/ ctx[2];
    	}

    	slider6 = new Slider({ props: slider6_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider6, 'sliderValue', slider6_sliderValue_binding));

    	function slider7_sliderValue_binding(value) {
    		/*slider7_sliderValue_binding*/ ctx[53](value);
    	}

    	let slider7_props = {
    		id: "eff-pixel-resolution",
    		label: "resolution",
    		minval: 3,
    		maxval: 20,
    		defval: 3
    	};

    	if (/*pixel_chunkSize*/ ctx[16] !== void 0) {
    		slider7_props.sliderValue = /*pixel_chunkSize*/ ctx[16];
    	}

    	slider7 = new Slider({ props: slider7_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider7, 'sliderValue', slider7_sliderValue_binding));

    	function slider8_sliderValue_binding(value) {
    		/*slider8_sliderValue_binding*/ ctx[55](value);
    	}

    	let slider8_props = {
    		id: "eff-poster-threshold",
    		label: "threshold",
    		minval: 30,
    		maxval: 250,
    		defval: 120
    	};

    	if (/*poster_threshold*/ ctx[27] !== void 0) {
    		slider8_props.sliderValue = /*poster_threshold*/ ctx[27];
    	}

    	slider8 = new Slider({ props: slider8_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider8, 'sliderValue', slider8_sliderValue_binding));

    	function slider9_sliderValue_binding(value) {
    		/*slider9_sliderValue_binding*/ ctx[56](value);
    	}

    	let slider9_props = {
    		id: "eff-poster-maxvalue",
    		label: "opacity",
    		minval: 0,
    		maxval: 255,
    		defval: 150
    	};

    	if (/*poster_maxvalue*/ ctx[28] !== void 0) {
    		slider9_props.sliderValue = /*poster_maxvalue*/ ctx[28];
    	}

    	slider9 = new Slider({ props: slider9_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider9, 'sliderValue', slider9_sliderValue_binding));

    	const block = {
    		c: function create() {
    			script = element("script");
    			t0 = space();
    			div18 = element("div");
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			video = element("video");
    			t3 = space();
    			canvas0 = element("canvas");
    			t4 = space();
    			if (if_block2) if_block2.c();
    			t5 = space();
    			canvas1 = element("canvas");
    			t6 = space();
    			div1 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Popout";
    			t8 = space();
    			button1 = element("button");
    			button1.textContent = "Trade";
    			t10 = space();
    			if (if_block3) if_block3.c();
    			t11 = space();
    			div4 = element("div");
    			input0 = element("input");
    			t12 = space();
    			label0 = element("label");
    			t13 = space();
    			div3 = element("div");
    			create_component(slider0.$$.fragment);
    			t14 = space();
    			create_component(slider1.$$.fragment);
    			t15 = space();
    			create_component(slider2.$$.fragment);
    			t16 = space();
    			div6 = element("div");
    			input1 = element("input");
    			t17 = space();
    			label1 = element("label");
    			t18 = space();
    			div5 = element("div");
    			create_component(radiooptions.$$.fragment);
    			t19 = space();
    			create_component(slider3.$$.fragment);
    			t20 = space();
    			create_component(slider4.$$.fragment);
    			t21 = space();
    			div8 = element("div");
    			input2 = element("input");
    			t22 = space();
    			label2 = element("label");
    			t23 = space();
    			div7 = element("div");
    			create_component(slider5.$$.fragment);
    			t24 = space();
    			div13 = element("div");
    			input3 = element("input");
    			t25 = space();
    			label3 = element("label");
    			t26 = space();
    			div12 = element("div");
    			div11 = element("div");
    			create_component(toggle0.$$.fragment);
    			t27 = space();
    			div9 = element("div");
    			input4 = element("input");
    			t28 = space();
    			create_component(toggle1.$$.fragment);
    			t29 = space();
    			div10 = element("div");
    			input5 = element("input");
    			t30 = space();
    			create_component(slider6.$$.fragment);
    			t31 = space();
    			div15 = element("div");
    			input6 = element("input");
    			t32 = space();
    			label4 = element("label");
    			t33 = space();
    			div14 = element("div");
    			create_component(slider7.$$.fragment);
    			t34 = space();
    			div17 = element("div");
    			input7 = element("input");
    			t35 = space();
    			label5 = element("label");
    			t36 = space();
    			div16 = element("div");
    			create_component(slider8.$$.fragment);
    			t37 = space();
    			create_component(slider9.$$.fragment);
    			if (!src_url_equal(script.src, script_src_value = "https://docs.opencv.org/3.4.0/opencv.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$1, 1, 1, 15);
    			attr_dev(video, "id", "v_in");
    			attr_dev(video, "width", wt);
    			attr_dev(video, "height", ht);

    			attr_dev(video, "style", video_style_value = /*viewport_showInput*/ ctx[10]
    			? "display:block"
    			: "display:none");

    			add_location(video, file$1, 311, 8, 7995);
    			attr_dev(canvas0, "id", "v_out");
    			attr_dev(canvas0, "width", wt);
    			attr_dev(canvas0, "height", ht);

    			attr_dev(canvas0, "style", canvas0_style_value = /*viewport_showInput*/ ctx[10]
    			? "display:none"
    			: "display:block");

    			add_location(canvas0, file$1, 316, 8, 8176);
    			attr_dev(canvas1, "width", wt);
    			attr_dev(canvas1, "height", ht);
    			set_style(canvas1, "display", "none");
    			add_location(canvas1, file$1, 328, 8, 8575);
    			attr_dev(button0, "class", "button1-1");
    			add_location(button0, file$1, 336, 16, 8782);
    			attr_dev(button1, "class", "button1-2");
    			add_location(button1, file$1, 337, 16, 8860);
    			attr_dev(div0, "class", "button-controller svelte-5agu1l");
    			add_location(div0, file$1, 335, 12, 8734);
    			attr_dev(div1, "class", "controller svelte-5agu1l");
    			add_location(div1, file$1, 333, 8, 8696);
    			attr_dev(div2, "class", "viewport svelte-5agu1l");
    			set_style(div2, "grid-area", "1 / 1 / 2 / 3");
    			add_location(div2, file$1, 301, 4, 7701);
    			attr_dev(input0, "class", "effect-toggle svelte-5agu1l");
    			attr_dev(input0, "type", "checkbox");
    			attr_dev(input0, "id", "tgl-filter");
    			add_location(input0, file$1, 348, 8, 9138);
    			attr_dev(label0, "class", "tgl-btn svelte-5agu1l");
    			attr_dev(label0, "for", "tgl-filter");
    			attr_dev(label0, "data-tg-off", "filter");
    			attr_dev(label0, "data-tg-on", "filter!");
    			add_location(label0, file$1, 350, 8, 9249);
    			attr_dev(div3, "class", "effect-inner svelte-5agu1l");
    			add_location(div3, file$1, 352, 8, 9360);
    			attr_dev(div4, "class", "effect svelte-5agu1l");
    			attr_dev(div4, "id", "eff-filter");
    			set_style(div4, "grid-area", "2 / 1 / 3 / 3");
    			add_location(div4, file$1, 347, 4, 9060);
    			attr_dev(input1, "class", "effect-toggle svelte-5agu1l");
    			attr_dev(input1, "type", "checkbox");
    			attr_dev(input1, "id", "tgl-ghost");
    			add_location(input1, file$1, 378, 8, 10173);
    			attr_dev(label1, "class", "tgl-btn svelte-5agu1l");
    			attr_dev(label1, "for", "tgl-ghost");
    			attr_dev(label1, "data-tg-off", "ghost");
    			attr_dev(label1, "data-tg-on", "ghost!");
    			add_location(label1, file$1, 380, 8, 10282);
    			attr_dev(div5, "class", "effect-inner svelte-5agu1l");
    			add_location(div5, file$1, 382, 8, 10390);
    			attr_dev(div6, "class", "effect svelte-5agu1l");
    			attr_dev(div6, "id", "eff-ghost");
    			set_style(div6, "grid-area", "1 / 3 / 2 / 5");
    			add_location(div6, file$1, 377, 4, 10096);
    			attr_dev(input2, "class", "effect-toggle svelte-5agu1l");
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "id", "tgl-chroma");
    			add_location(input2, file$1, 408, 8, 11202);
    			attr_dev(label2, "class", "tgl-btn svelte-5agu1l");
    			attr_dev(label2, "for", "tgl-chroma");
    			attr_dev(label2, "data-tg-off", "chroma");
    			attr_dev(label2, "data-tg-on", "chroma!");
    			add_location(label2, file$1, 410, 8, 11313);
    			attr_dev(div7, "class", "effect-inner svelte-5agu1l");
    			add_location(div7, file$1, 412, 8, 11424);
    			attr_dev(div8, "class", "effect svelte-5agu1l");
    			attr_dev(div8, "id", "eff-chroma");
    			set_style(div8, "grid-area", "2 / 3 / 3 / 4");
    			add_location(div8, file$1, 407, 4, 11124);
    			attr_dev(input3, "class", "effect-toggle svelte-5agu1l");
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "id", "tgl-movey");
    			add_location(input3, file$1, 424, 8, 11794);
    			attr_dev(label3, "class", "tgl-btn svelte-5agu1l");
    			attr_dev(label3, "for", "tgl-movey");
    			attr_dev(label3, "data-tg-off", "movey");
    			attr_dev(label3, "data-tg-on", "movey!");
    			add_location(label3, file$1, 426, 8, 11903);
    			attr_dev(input4, "type", "color");
    			attr_dev(input4, "id", "colorpickerA");
    			attr_dev(input4, "class", "svelte-5agu1l");
    			add_location(input4, file$1, 435, 20, 12274);
    			attr_dev(div9, "class", "color-container svelte-5agu1l");
    			add_location(div9, file$1, 434, 16, 12224);
    			attr_dev(input5, "type", "color");
    			attr_dev(input5, "id", "colorpickerB");
    			attr_dev(input5, "class", "svelte-5agu1l");
    			add_location(input5, file$1, 445, 20, 12626);
    			attr_dev(div10, "class", "color-container svelte-5agu1l");
    			add_location(div10, file$1, 444, 16, 12576);
    			attr_dev(div11, "class", "movey-container svelte-5agu1l");
    			add_location(div11, file$1, 429, 12, 12050);
    			attr_dev(div12, "class", "effect-inner svelte-5agu1l");
    			add_location(div12, file$1, 428, 8, 12011);
    			attr_dev(div13, "class", "effect svelte-5agu1l");
    			attr_dev(div13, "id", "eff-movey");
    			set_style(div13, "grid-area", "2 / 4 / 3 / 5");
    			add_location(div13, file$1, 423, 4, 11717);
    			attr_dev(input6, "class", "effect-toggle svelte-5agu1l");
    			attr_dev(input6, "type", "checkbox");
    			attr_dev(input6, "id", "tgl-pixel");
    			add_location(input6, file$1, 462, 8, 13145);
    			attr_dev(label4, "class", "tgl-btn svelte-5agu1l");
    			attr_dev(label4, "for", "tgl-pixel");
    			attr_dev(label4, "data-tg-off", "pixel");
    			attr_dev(label4, "data-tg-on", "pixel!");
    			add_location(label4, file$1, 464, 8, 13254);
    			attr_dev(div14, "class", "effect-inner svelte-5agu1l");
    			add_location(div14, file$1, 466, 8, 13362);
    			attr_dev(div15, "class", "effect svelte-5agu1l");
    			attr_dev(div15, "id", "eff-pixel");
    			set_style(div15, "grid-area", "1 / 5 / 2 / 6");
    			add_location(div15, file$1, 461, 4, 13068);
    			attr_dev(input7, "class", "effect-toggle svelte-5agu1l");
    			attr_dev(input7, "type", "checkbox");
    			attr_dev(input7, "id", "tgl-poster");
    			add_location(input7, file$1, 478, 8, 13731);
    			attr_dev(label5, "class", "tgl-btn svelte-5agu1l");
    			attr_dev(label5, "for", "tgl-poster");
    			attr_dev(label5, "data-tg-off", "poster");
    			attr_dev(label5, "data-tg-on", "poster!");
    			add_location(label5, file$1, 480, 8, 13842);
    			attr_dev(div16, "class", "effect-inner svelte-5agu1l");
    			add_location(div16, file$1, 482, 8, 13953);
    			attr_dev(div17, "class", "effect svelte-5agu1l");
    			attr_dev(div17, "id", "eff-poster");
    			set_style(div17, "grid-area", "2 / 5 / 3 / 6");
    			add_location(div17, file$1, 477, 4, 13653);
    			attr_dev(div18, "class", "backdrop svelte-5agu1l");
    			add_location(div18, file$1, 299, 0, 7673);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, script);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div18, anchor);
    			append_dev(div18, div2);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t1);
    			if (if_block1) if_block1.m(div2, null);
    			append_dev(div2, t2);
    			append_dev(div2, video);
    			/*video_binding*/ ctx[32](video);
    			append_dev(div2, t3);
    			append_dev(div2, canvas0);
    			/*canvas0_binding*/ ctx[33](canvas0);
    			append_dev(div2, t4);
    			if (if_block2) if_block2.m(div2, null);
    			append_dev(div2, t5);
    			append_dev(div2, canvas1);
    			/*canvas1_binding*/ ctx[35](canvas1);
    			append_dev(div2, t6);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t8);
    			append_dev(div0, button1);
    			append_dev(div1, t10);
    			if (if_block3) if_block3.m(div1, null);
    			append_dev(div18, t11);
    			append_dev(div18, div4);
    			append_dev(div4, input0);
    			input0.checked = /*filter_A*/ ctx[17];
    			append_dev(div4, t12);
    			append_dev(div4, label0);
    			append_dev(div4, t13);
    			append_dev(div4, div3);
    			mount_component(slider0, div3, null);
    			append_dev(div3, t14);
    			mount_component(slider1, div3, null);
    			append_dev(div3, t15);
    			mount_component(slider2, div3, null);
    			append_dev(div18, t16);
    			append_dev(div18, div6);
    			append_dev(div6, input1);
    			input1.checked = /*ghost_A*/ ctx[11];
    			append_dev(div6, t17);
    			append_dev(div6, label1);
    			append_dev(div6, t18);
    			append_dev(div6, div5);
    			mount_component(radiooptions, div5, null);
    			append_dev(div5, t19);
    			mount_component(slider3, div5, null);
    			append_dev(div5, t20);
    			mount_component(slider4, div5, null);
    			append_dev(div18, t21);
    			append_dev(div18, div8);
    			append_dev(div8, input2);
    			input2.checked = /*chroma_A*/ ctx[21];
    			append_dev(div8, t22);
    			append_dev(div8, label2);
    			append_dev(div8, t23);
    			append_dev(div8, div7);
    			mount_component(slider5, div7, null);
    			append_dev(div18, t24);
    			append_dev(div18, div13);
    			append_dev(div13, input3);
    			input3.checked = /*movey_A*/ ctx[23];
    			append_dev(div13, t25);
    			append_dev(div13, label3);
    			append_dev(div13, t26);
    			append_dev(div13, div12);
    			append_dev(div12, div11);
    			mount_component(toggle0, div11, null);
    			append_dev(div11, t27);
    			append_dev(div11, div9);
    			append_dev(div9, input4);
    			set_input_value(input4, /*colorA_hex*/ ctx[0]);
    			append_dev(div11, t28);
    			mount_component(toggle1, div11, null);
    			append_dev(div11, t29);
    			append_dev(div11, div10);
    			append_dev(div10, input5);
    			set_input_value(input5, /*colorB_hex*/ ctx[1]);
    			append_dev(div12, t30);
    			mount_component(slider6, div12, null);
    			append_dev(div18, t31);
    			append_dev(div18, div15);
    			append_dev(div15, input6);
    			input6.checked = /*pixel_A*/ ctx[15];
    			append_dev(div15, t32);
    			append_dev(div15, label4);
    			append_dev(div15, t33);
    			append_dev(div15, div14);
    			mount_component(slider7, div14, null);
    			append_dev(div18, t34);
    			append_dev(div18, div17);
    			append_dev(div17, input7);
    			input7.checked = /*poster_A*/ ctx[26];
    			append_dev(div17, t35);
    			append_dev(div17, label5);
    			append_dev(div17, t36);
    			append_dev(div17, div16);
    			mount_component(slider8, div16, null);
    			append_dev(div16, t37);
    			mount_component(slider9, div16, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(script, "load", /*init*/ ctx[29], false, false, false, false),
    					listen_dev(button0, "click", doPopout, false, false, false, false),
    					listen_dev(button1, "click", /*doTrade*/ ctx[30], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[36]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[40]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[44]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[46]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[48]),
    					listen_dev(input5, "input", /*input5_input_handler*/ ctx[50]),
    					listen_dev(input6, "change", /*input6_change_handler*/ ctx[52]),
    					listen_dev(input7, "change", /*input7_change_handler*/ ctx[54])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*loading*/ ctx[8]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(div2, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!/*streaming*/ ctx[9]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(div2, t2);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (!current || dirty[0] & /*viewport_showInput*/ 1024 && video_style_value !== (video_style_value = /*viewport_showInput*/ ctx[10]
    			? "display:block"
    			: "display:none")) {
    				attr_dev(video, "style", video_style_value);
    			}

    			if (!current || dirty[0] & /*viewport_showInput*/ 1024 && canvas0_style_value !== (canvas0_style_value = /*viewport_showInput*/ ctx[10]
    			? "display:none"
    			: "display:block")) {
    				attr_dev(canvas0, "style", canvas0_style_value);
    			}

    			if (/*poster_A*/ ctx[26]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					if_block2.m(div2, t5);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*streaming*/ ctx[9]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block(ctx);
    					if_block3.c();
    					if_block3.m(div1, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*filter_A*/ 131072) {
    				input0.checked = /*filter_A*/ ctx[17];
    			}

    			const slider0_changes = {};

    			if (!updating_sliderValue && dirty[0] & /*filter_temp*/ 262144) {
    				updating_sliderValue = true;
    				slider0_changes.sliderValue = /*filter_temp*/ ctx[18];
    				add_flush_callback(() => updating_sliderValue = false);
    			}

    			slider0.$set(slider0_changes);
    			const slider1_changes = {};

    			if (!updating_sliderValue_1 && dirty[0] & /*filter_saturate*/ 524288) {
    				updating_sliderValue_1 = true;
    				slider1_changes.sliderValue = /*filter_saturate*/ ctx[19];
    				add_flush_callback(() => updating_sliderValue_1 = false);
    			}

    			slider1.$set(slider1_changes);
    			const slider2_changes = {};

    			if (!updating_sliderValue_2 && dirty[0] & /*filter_bright*/ 1048576) {
    				updating_sliderValue_2 = true;
    				slider2_changes.sliderValue = /*filter_bright*/ ctx[20];
    				add_flush_callback(() => updating_sliderValue_2 = false);
    			}

    			slider2.$set(slider2_changes);

    			if (dirty[0] & /*ghost_A*/ 2048) {
    				input1.checked = /*ghost_A*/ ctx[11];
    			}

    			const radiooptions_changes = {};

    			if (!updating_optionChosen && dirty[0] & /*ghost_mode*/ 4096) {
    				updating_optionChosen = true;
    				radiooptions_changes.optionChosen = /*ghost_mode*/ ctx[12];
    				add_flush_callback(() => updating_optionChosen = false);
    			}

    			radiooptions.$set(radiooptions_changes);
    			const slider3_changes = {};

    			if (!updating_sliderValue_3 && dirty[0] & /*ghost_amount*/ 8192) {
    				updating_sliderValue_3 = true;
    				slider3_changes.sliderValue = /*ghost_amount*/ ctx[13];
    				add_flush_callback(() => updating_sliderValue_3 = false);
    			}

    			slider3.$set(slider3_changes);
    			const slider4_changes = {};

    			if (!updating_sliderValue_4 && dirty[0] & /*ghost_delay*/ 16384) {
    				updating_sliderValue_4 = true;
    				slider4_changes.sliderValue = /*ghost_delay*/ ctx[14];
    				add_flush_callback(() => updating_sliderValue_4 = false);
    			}

    			slider4.$set(slider4_changes);

    			if (dirty[0] & /*chroma_A*/ 2097152) {
    				input2.checked = /*chroma_A*/ ctx[21];
    			}

    			const slider5_changes = {};

    			if (!updating_sliderValue_5 && dirty[0] & /*chroma_threshold*/ 4194304) {
    				updating_sliderValue_5 = true;
    				slider5_changes.sliderValue = /*chroma_threshold*/ ctx[22];
    				add_flush_callback(() => updating_sliderValue_5 = false);
    			}

    			slider5.$set(slider5_changes);

    			if (dirty[0] & /*movey_A*/ 8388608) {
    				input3.checked = /*movey_A*/ ctx[23];
    			}

    			const toggle0_changes = {};

    			if (!updating_opt && dirty[0] & /*movey_bg*/ 33554432) {
    				updating_opt = true;
    				toggle0_changes.opt = /*movey_bg*/ ctx[25];
    				add_flush_callback(() => updating_opt = false);
    			}

    			toggle0.$set(toggle0_changes);

    			if (dirty[0] & /*colorA_hex*/ 1) {
    				set_input_value(input4, /*colorA_hex*/ ctx[0]);
    			}

    			const toggle1_changes = {};

    			if (!updating_opt_1 && dirty[0] & /*movey_fg*/ 16777216) {
    				updating_opt_1 = true;
    				toggle1_changes.opt = /*movey_fg*/ ctx[24];
    				add_flush_callback(() => updating_opt_1 = false);
    			}

    			toggle1.$set(toggle1_changes);

    			if (dirty[0] & /*colorB_hex*/ 2) {
    				set_input_value(input5, /*colorB_hex*/ ctx[1]);
    			}

    			const slider6_changes = {};

    			if (!updating_sliderValue_6 && dirty[0] & /*movey_threshold*/ 4) {
    				updating_sliderValue_6 = true;
    				slider6_changes.sliderValue = /*movey_threshold*/ ctx[2];
    				add_flush_callback(() => updating_sliderValue_6 = false);
    			}

    			slider6.$set(slider6_changes);

    			if (dirty[0] & /*pixel_A*/ 32768) {
    				input6.checked = /*pixel_A*/ ctx[15];
    			}

    			const slider7_changes = {};

    			if (!updating_sliderValue_7 && dirty[0] & /*pixel_chunkSize*/ 65536) {
    				updating_sliderValue_7 = true;
    				slider7_changes.sliderValue = /*pixel_chunkSize*/ ctx[16];
    				add_flush_callback(() => updating_sliderValue_7 = false);
    			}

    			slider7.$set(slider7_changes);

    			if (dirty[0] & /*poster_A*/ 67108864) {
    				input7.checked = /*poster_A*/ ctx[26];
    			}

    			const slider8_changes = {};

    			if (!updating_sliderValue_8 && dirty[0] & /*poster_threshold*/ 134217728) {
    				updating_sliderValue_8 = true;
    				slider8_changes.sliderValue = /*poster_threshold*/ ctx[27];
    				add_flush_callback(() => updating_sliderValue_8 = false);
    			}

    			slider8.$set(slider8_changes);
    			const slider9_changes = {};

    			if (!updating_sliderValue_9 && dirty[0] & /*poster_maxvalue*/ 268435456) {
    				updating_sliderValue_9 = true;
    				slider9_changes.sliderValue = /*poster_maxvalue*/ ctx[28];
    				add_flush_callback(() => updating_sliderValue_9 = false);
    			}

    			slider9.$set(slider9_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider0.$$.fragment, local);
    			transition_in(slider1.$$.fragment, local);
    			transition_in(slider2.$$.fragment, local);
    			transition_in(radiooptions.$$.fragment, local);
    			transition_in(slider3.$$.fragment, local);
    			transition_in(slider4.$$.fragment, local);
    			transition_in(slider5.$$.fragment, local);
    			transition_in(toggle0.$$.fragment, local);
    			transition_in(toggle1.$$.fragment, local);
    			transition_in(slider6.$$.fragment, local);
    			transition_in(slider7.$$.fragment, local);
    			transition_in(slider8.$$.fragment, local);
    			transition_in(slider9.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(slider0.$$.fragment, local);
    			transition_out(slider1.$$.fragment, local);
    			transition_out(slider2.$$.fragment, local);
    			transition_out(radiooptions.$$.fragment, local);
    			transition_out(slider3.$$.fragment, local);
    			transition_out(slider4.$$.fragment, local);
    			transition_out(slider5.$$.fragment, local);
    			transition_out(toggle0.$$.fragment, local);
    			transition_out(toggle1.$$.fragment, local);
    			transition_out(slider6.$$.fragment, local);
    			transition_out(slider7.$$.fragment, local);
    			transition_out(slider8.$$.fragment, local);
    			transition_out(slider9.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(script);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div18);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			/*video_binding*/ ctx[32](null);
    			/*canvas0_binding*/ ctx[33](null);
    			if (if_block2) if_block2.d();
    			/*canvas1_binding*/ ctx[35](null);
    			if (if_block3) if_block3.d();
    			destroy_component(slider0);
    			destroy_component(slider1);
    			destroy_component(slider2);
    			destroy_component(radiooptions);
    			destroy_component(slider3);
    			destroy_component(slider4);
    			destroy_component(slider5);
    			destroy_component(toggle0);
    			destroy_component(toggle1);
    			destroy_component(slider6);
    			destroy_component(slider7);
    			destroy_component(slider8);
    			destroy_component(slider9);
    			mounted = false;
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

    const wt = 320;
    const ht = 240;

    // -----------------
    // hextorgb
    //
    // compute rgb from hex returned by color pickers
    // returns [r,g,b]
    // -----------------
    function hextorgb(hexval) {
    	let result = (/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i).exec(hexval);

    	return result
    	? {
    			r: parseInt(result[1], 16),
    			g: parseInt(result[2], 16),
    			b: parseInt(result[3], 16)
    		}
    	: null;
    }

    function doPopout() {
    	
    }

    // used for movey
    function distSq(x1, y1, z1, x2, y2, z2) {
    	return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let colorA_rgb;
    	let colorB_rgb;
    	let colorC_rgb;
    	let mThreshold;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Control', slots, []);
    	let fps = 30;
    	let delay = 0;
    	let iter = 0;
    	let v_in;
    	let v_out = null;
    	let v_out_ocv = null;
    	let v_out_ctx;
    	let v_out_ctx_ocv;
    	let v_temp = null;
    	let v_temp_ctx;
    	let ocv_mat_src;
    	let ocv_mat_tmp1;
    	let ocv_mat_dst;
    	let ocv_mask;
    	let ocv_fgbg;
    	let frame;
    	let loading = false;
    	let streaming = false;

    	// changed by trade button, defaults to show output
    	let viewport_showInput = false;

    	let { colorA_hex } = $$props;
    	let { colorB_hex } = $$props;
    	let { colorC_hex } = $$props;

    	// -----------------
    	// Queue
    	// 
    	// FIFO queue for use in ghost effect
    	// -----------------
    	class Queue {
    		constructor() {
    			this.frames = {};
    			this.front = 0;
    			this.back = 0;
    		}

    		enqueue(frame) {
    			this.frames[this.back] = frame;
    			this.back++;
    		}

    		dequeue() {
    			const frame = this.frames[this.front];
    			delete this.frames[this.front];
    			this.front++;
    			return frame;
    		}
    	}

    	// -----------------
    	// effect parameters
    	// -----------------
    	let ghost_A = true;

    	let ghost_mode = 1;
    	let ghost_amount = 1;
    	let ghost_delay = 1;
    	let ghost_accum = new Queue();
    	let pixel_A = false;
    	let pixel_chunkSize = 3;
    	let pixel_corner = [];
    	let filter_A = false;
    	let filter_temp = 50;
    	let filter_saturate = 50;
    	let filter_bright = 50;
    	let chroma_A = false;
    	let chroma_threshold = 1;
    	let movey_A = false;
    	let movey_fg = true;
    	let movey_bg = false;
    	let movey_trail = false;
    	let movey_threshold = 40;
    	let movey_length = 0;
    	let prev;
    	let movey_motion = Array(wt * ht).fill(0);
    	let poster_A = false;
    	let poster_threshold = 120;
    	let poster_maxvalue = 150;

    	// -----------------
    	// init
    	// 
    	// initialize webcam
    	// -----------------
    	const init = async () => {
    		// try {
    		v_out_ctx = v_out.getContext('2d');

    		v_out_ctx_ocv = v_out.getContext('2d');
    		v_temp_ctx = v_temp.getContext('2d', { willReadFrequently: true });
    		ocv_mat_src = new cv.Mat(ht, wt, cv.CV_8UC4);
    		ocv_mat_tmp1 = new cv.Mat(ht, wt, cv.CV_8UC1);
    		ocv_mat_dst = new cv.Mat(ht, wt, cv.CV_8UC1);
    		ocv_mask = new cv.Mat(ht, wt, cv.CV_8UC1);
    		ocv_fgbg = new cv.BackgroundSubtractorMOG2(500, 16, false);
    		$$invalidate(9, streaming = true);
    		$$invalidate(8, loading = true);
    		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    		$$invalidate(4, v_in.srcObject = stream, v_in);
    		v_in.play();
    		$$invalidate(8, loading = false);
    		frame = v_temp_ctx.getImageData(0, 0, wt, ht);
    		prev = v_temp_ctx.getImageData(0, 0, wt, ht);
    		v_in.addEventListener("play", computeFrame);
    	}; // } catch (error) {
    	//     alert("An error occurred!\n" + error);
    	// }

    	// -----------------
    	// computeFrame
    	// 
    	// compute and display next frame 
    	// -----------------
    	function computeFrame() {
    		if (!streaming) {
    			ocv_mat_src.delete();
    			ocv_mat_tmp1.delete();
    			ocv_mat_dst.delete();
    			return;
    		}

    		let begin = Date.now();

    		//#region
    		v_temp_ctx.drawImage(v_in, 0, 0, wt, ht);

    		if (pixel_A) {
    			// for each row
    			for (let y = 0; y < ht; y += pixel_chunkSize) {
    				// for each col
    				for (let x = 0; x < wt; x += pixel_chunkSize) {
    					pixel_corner = v_temp_ctx.getImageData(x, y, 1, 1).data;
    					v_temp_ctx.fillStyle = "rgb(" + pixel_corner[0] + "," + pixel_corner[1] + "," + pixel_corner[2] + ")";
    					v_temp_ctx.fillRect(x, y, pixel_chunkSize, pixel_chunkSize);
    				}
    			}
    		}

    		frame = v_temp_ctx.getImageData(0, 0, wt, ht);

    		for (let i = 0; i < frame.data.length / 4; i++) {
    			let r = frame.data[i * 4 + 0];
    			let g = frame.data[i * 4 + 1];
    			let b = frame.data[i * 4 + 2];

    			if (movey_A) {
    				if (movey_motion[i * 4 + 0] > 0) {
    					if (movey_fg) {
    						r = colorA_rgb.r;
    						g = colorA_rgb.g;
    						b = colorA_rgb.b;
    					}
    				} else if (distSq(r, g, b, prev.data[i * 4 + 0], prev.data[i * 4 + 1], prev.data[i * 4 + 2]) > mThreshold) {
    					if (movey_fg) {
    						r = colorA_rgb.r;
    						g = colorA_rgb.g;
    						b = colorA_rgb.b;
    					}

    					if (movey_trail) movey_motion[i * 4 + 0] = movey_length;
    				} else if (movey_bg) {
    					r = colorB_rgb.r;
    					g = colorB_rgb.g;
    					b = colorB_rgb.b;
    				}

    				// decrement current pixel in motion array
    				movey_motion[i * 4 + 0]--;
    			}

    			if (filter_A) {
    				// find min and max values
    				let min = r;

    				let mid = g;
    				let max = b;

    				if (min > mid) {
    					mid = r;
    					min = g;
    				}

    				if (mid > max) {
    					max = mid;
    					mid = b;
    					if (min > mid) min = b;
    				}

    				let temp_amt = filter_temp - 50;
    				if (temp_amt > 0) r += temp_amt; else b += temp_amt;
    				let saturate_amt = filter_saturate - 50;
    				if (r == max) r += saturate_amt; else if (g == max) g += saturate_amt; else if (b == max) b += saturate_amt;
    				if (r == min) r -= saturate_amt; else if (g == min) g -= saturate_amt; else if (b == min) b -= saturate_amt;
    				let bright_amt = filter_bright - 50;
    				r += bright_amt;
    				g += bright_amt;
    				b += bright_amt;
    			}

    			frame.data[i * 4 + 0] = r;
    			frame.data[i * 4 + 1] = g;
    			frame.data[i * 4 + 2] = b;
    		}

    		if (movey_A) prev = v_temp_ctx.getImageData(0, 0, wt, ht);
    		v_out_ctx.putImageData(frame, 0, 0);

    		// #endregion
    		ocv_mat_src.data.set(v_out_ctx_ocv.getImageData(0, 0, wt, ht).data);

    		if (poster_A) {
    			cv.threshold(ocv_mat_src, ocv_mat_dst, poster_threshold, poster_maxvalue, cv.THRESH_BINARY);
    			cv.imshow("v_out_ocv", ocv_mat_dst);
    		}

    		delay = 1000 / 30 - (Date.now() - begin);

    		if (iter > 3) {
    			//update fps every 3 frames
    			$$invalidate(3, fps = parseInt(delay));

    			iter = 0;
    		} else iter++;

    		setTimeout(computeFrame, delay);
    	}

    	function doTrade() {
    		$$invalidate(10, viewport_showInput = !viewport_showInput);
    	} // console.log(viewport_showInput);

    	$$self.$$.on_mount.push(function () {
    		if (colorA_hex === undefined && !('colorA_hex' in $$props || $$self.$$.bound[$$self.$$.props['colorA_hex']])) {
    			console.warn("<Control> was created without expected prop 'colorA_hex'");
    		}

    		if (colorB_hex === undefined && !('colorB_hex' in $$props || $$self.$$.bound[$$self.$$.props['colorB_hex']])) {
    			console.warn("<Control> was created without expected prop 'colorB_hex'");
    		}

    		if (colorC_hex === undefined && !('colorC_hex' in $$props || $$self.$$.bound[$$self.$$.props['colorC_hex']])) {
    			console.warn("<Control> was created without expected prop 'colorC_hex'");
    		}
    	});

    	const writable_props = ['colorA_hex', 'colorB_hex', 'colorC_hex'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Control> was created with unknown prop '${key}'`);
    	});

    	function video_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_in = $$value;
    			$$invalidate(4, v_in);
    		});
    	}

    	function canvas0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_out = $$value;
    			$$invalidate(5, v_out);
    		});
    	}

    	function canvas_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_out_ocv = $$value;
    			$$invalidate(6, v_out_ocv);
    		});
    	}

    	function canvas1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_temp = $$value;
    			$$invalidate(7, v_temp);
    		});
    	}

    	function input0_change_handler() {
    		filter_A = this.checked;
    		$$invalidate(17, filter_A);
    	}

    	function slider0_sliderValue_binding(value) {
    		filter_temp = value;
    		$$invalidate(18, filter_temp);
    	}

    	function slider1_sliderValue_binding(value) {
    		filter_saturate = value;
    		$$invalidate(19, filter_saturate);
    	}

    	function slider2_sliderValue_binding(value) {
    		filter_bright = value;
    		$$invalidate(20, filter_bright);
    	}

    	function input1_change_handler() {
    		ghost_A = this.checked;
    		$$invalidate(11, ghost_A);
    	}

    	function radiooptions_optionChosen_binding(value) {
    		ghost_mode = value;
    		$$invalidate(12, ghost_mode);
    	}

    	function slider3_sliderValue_binding(value) {
    		ghost_amount = value;
    		$$invalidate(13, ghost_amount);
    	}

    	function slider4_sliderValue_binding(value) {
    		ghost_delay = value;
    		$$invalidate(14, ghost_delay);
    	}

    	function input2_change_handler() {
    		chroma_A = this.checked;
    		$$invalidate(21, chroma_A);
    	}

    	function slider5_sliderValue_binding(value) {
    		chroma_threshold = value;
    		$$invalidate(22, chroma_threshold);
    	}

    	function input3_change_handler() {
    		movey_A = this.checked;
    		$$invalidate(23, movey_A);
    	}

    	function toggle0_opt_binding(value) {
    		movey_bg = value;
    		$$invalidate(25, movey_bg);
    	}

    	function input4_input_handler() {
    		colorA_hex = this.value;
    		$$invalidate(0, colorA_hex);
    	}

    	function toggle1_opt_binding(value) {
    		movey_fg = value;
    		$$invalidate(24, movey_fg);
    	}

    	function input5_input_handler() {
    		colorB_hex = this.value;
    		$$invalidate(1, colorB_hex);
    	}

    	function slider6_sliderValue_binding(value) {
    		movey_threshold = value;
    		$$invalidate(2, movey_threshold);
    	}

    	function input6_change_handler() {
    		pixel_A = this.checked;
    		$$invalidate(15, pixel_A);
    	}

    	function slider7_sliderValue_binding(value) {
    		pixel_chunkSize = value;
    		$$invalidate(16, pixel_chunkSize);
    	}

    	function input7_change_handler() {
    		poster_A = this.checked;
    		$$invalidate(26, poster_A);
    	}

    	function slider8_sliderValue_binding(value) {
    		poster_threshold = value;
    		$$invalidate(27, poster_threshold);
    	}

    	function slider9_sliderValue_binding(value) {
    		poster_maxvalue = value;
    		$$invalidate(28, poster_maxvalue);
    	}

    	$$self.$$set = $$props => {
    		if ('colorA_hex' in $$props) $$invalidate(0, colorA_hex = $$props.colorA_hex);
    		if ('colorB_hex' in $$props) $$invalidate(1, colorB_hex = $$props.colorB_hex);
    		if ('colorC_hex' in $$props) $$invalidate(31, colorC_hex = $$props.colorC_hex);
    	};

    	$$self.$capture_state = () => ({
    		Slider,
    		RadioOptions,
    		Toggle,
    		wt,
    		ht,
    		fps,
    		delay,
    		iter,
    		v_in,
    		v_out,
    		v_out_ocv,
    		v_out_ctx,
    		v_out_ctx_ocv,
    		v_temp,
    		v_temp_ctx,
    		ocv_mat_src,
    		ocv_mat_tmp1,
    		ocv_mat_dst,
    		ocv_mask,
    		ocv_fgbg,
    		frame,
    		loading,
    		streaming,
    		viewport_showInput,
    		colorA_hex,
    		colorB_hex,
    		colorC_hex,
    		hextorgb,
    		Queue,
    		ghost_A,
    		ghost_mode,
    		ghost_amount,
    		ghost_delay,
    		ghost_accum,
    		pixel_A,
    		pixel_chunkSize,
    		pixel_corner,
    		filter_A,
    		filter_temp,
    		filter_saturate,
    		filter_bright,
    		chroma_A,
    		chroma_threshold,
    		movey_A,
    		movey_fg,
    		movey_bg,
    		movey_trail,
    		movey_threshold,
    		movey_length,
    		prev,
    		movey_motion,
    		poster_A,
    		poster_threshold,
    		poster_maxvalue,
    		init,
    		computeFrame,
    		doPopout,
    		doTrade,
    		distSq,
    		colorB_rgb,
    		colorA_rgb,
    		mThreshold,
    		colorC_rgb
    	});

    	$$self.$inject_state = $$props => {
    		if ('fps' in $$props) $$invalidate(3, fps = $$props.fps);
    		if ('delay' in $$props) delay = $$props.delay;
    		if ('iter' in $$props) iter = $$props.iter;
    		if ('v_in' in $$props) $$invalidate(4, v_in = $$props.v_in);
    		if ('v_out' in $$props) $$invalidate(5, v_out = $$props.v_out);
    		if ('v_out_ocv' in $$props) $$invalidate(6, v_out_ocv = $$props.v_out_ocv);
    		if ('v_out_ctx' in $$props) v_out_ctx = $$props.v_out_ctx;
    		if ('v_out_ctx_ocv' in $$props) v_out_ctx_ocv = $$props.v_out_ctx_ocv;
    		if ('v_temp' in $$props) $$invalidate(7, v_temp = $$props.v_temp);
    		if ('v_temp_ctx' in $$props) v_temp_ctx = $$props.v_temp_ctx;
    		if ('ocv_mat_src' in $$props) ocv_mat_src = $$props.ocv_mat_src;
    		if ('ocv_mat_tmp1' in $$props) ocv_mat_tmp1 = $$props.ocv_mat_tmp1;
    		if ('ocv_mat_dst' in $$props) ocv_mat_dst = $$props.ocv_mat_dst;
    		if ('ocv_mask' in $$props) ocv_mask = $$props.ocv_mask;
    		if ('ocv_fgbg' in $$props) ocv_fgbg = $$props.ocv_fgbg;
    		if ('frame' in $$props) frame = $$props.frame;
    		if ('loading' in $$props) $$invalidate(8, loading = $$props.loading);
    		if ('streaming' in $$props) $$invalidate(9, streaming = $$props.streaming);
    		if ('viewport_showInput' in $$props) $$invalidate(10, viewport_showInput = $$props.viewport_showInput);
    		if ('colorA_hex' in $$props) $$invalidate(0, colorA_hex = $$props.colorA_hex);
    		if ('colorB_hex' in $$props) $$invalidate(1, colorB_hex = $$props.colorB_hex);
    		if ('colorC_hex' in $$props) $$invalidate(31, colorC_hex = $$props.colorC_hex);
    		if ('ghost_A' in $$props) $$invalidate(11, ghost_A = $$props.ghost_A);
    		if ('ghost_mode' in $$props) $$invalidate(12, ghost_mode = $$props.ghost_mode);
    		if ('ghost_amount' in $$props) $$invalidate(13, ghost_amount = $$props.ghost_amount);
    		if ('ghost_delay' in $$props) $$invalidate(14, ghost_delay = $$props.ghost_delay);
    		if ('ghost_accum' in $$props) ghost_accum = $$props.ghost_accum;
    		if ('pixel_A' in $$props) $$invalidate(15, pixel_A = $$props.pixel_A);
    		if ('pixel_chunkSize' in $$props) $$invalidate(16, pixel_chunkSize = $$props.pixel_chunkSize);
    		if ('pixel_corner' in $$props) pixel_corner = $$props.pixel_corner;
    		if ('filter_A' in $$props) $$invalidate(17, filter_A = $$props.filter_A);
    		if ('filter_temp' in $$props) $$invalidate(18, filter_temp = $$props.filter_temp);
    		if ('filter_saturate' in $$props) $$invalidate(19, filter_saturate = $$props.filter_saturate);
    		if ('filter_bright' in $$props) $$invalidate(20, filter_bright = $$props.filter_bright);
    		if ('chroma_A' in $$props) $$invalidate(21, chroma_A = $$props.chroma_A);
    		if ('chroma_threshold' in $$props) $$invalidate(22, chroma_threshold = $$props.chroma_threshold);
    		if ('movey_A' in $$props) $$invalidate(23, movey_A = $$props.movey_A);
    		if ('movey_fg' in $$props) $$invalidate(24, movey_fg = $$props.movey_fg);
    		if ('movey_bg' in $$props) $$invalidate(25, movey_bg = $$props.movey_bg);
    		if ('movey_trail' in $$props) movey_trail = $$props.movey_trail;
    		if ('movey_threshold' in $$props) $$invalidate(2, movey_threshold = $$props.movey_threshold);
    		if ('movey_length' in $$props) movey_length = $$props.movey_length;
    		if ('prev' in $$props) prev = $$props.prev;
    		if ('movey_motion' in $$props) movey_motion = $$props.movey_motion;
    		if ('poster_A' in $$props) $$invalidate(26, poster_A = $$props.poster_A);
    		if ('poster_threshold' in $$props) $$invalidate(27, poster_threshold = $$props.poster_threshold);
    		if ('poster_maxvalue' in $$props) $$invalidate(28, poster_maxvalue = $$props.poster_maxvalue);
    		if ('colorB_rgb' in $$props) colorB_rgb = $$props.colorB_rgb;
    		if ('colorA_rgb' in $$props) colorA_rgb = $$props.colorA_rgb;
    		if ('mThreshold' in $$props) mThreshold = $$props.mThreshold;
    		if ('colorC_rgb' in $$props) colorC_rgb = $$props.colorC_rgb;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*colorA_hex*/ 1) {
    			colorA_rgb = hextorgb(colorA_hex);
    		}

    		if ($$self.$$.dirty[0] & /*colorB_hex*/ 2) {
    			colorB_rgb = hextorgb(colorB_hex);
    		}

    		if ($$self.$$.dirty[1] & /*colorC_hex*/ 1) {
    			colorC_rgb = hextorgb(colorC_hex);
    		}

    		if ($$self.$$.dirty[0] & /*movey_threshold*/ 4) {
    			mThreshold = movey_threshold * movey_threshold;
    		}
    	};

    	return [
    		colorA_hex,
    		colorB_hex,
    		movey_threshold,
    		fps,
    		v_in,
    		v_out,
    		v_out_ocv,
    		v_temp,
    		loading,
    		streaming,
    		viewport_showInput,
    		ghost_A,
    		ghost_mode,
    		ghost_amount,
    		ghost_delay,
    		pixel_A,
    		pixel_chunkSize,
    		filter_A,
    		filter_temp,
    		filter_saturate,
    		filter_bright,
    		chroma_A,
    		chroma_threshold,
    		movey_A,
    		movey_fg,
    		movey_bg,
    		poster_A,
    		poster_threshold,
    		poster_maxvalue,
    		init,
    		doTrade,
    		colorC_hex,
    		video_binding,
    		canvas0_binding,
    		canvas_binding,
    		canvas1_binding,
    		input0_change_handler,
    		slider0_sliderValue_binding,
    		slider1_sliderValue_binding,
    		slider2_sliderValue_binding,
    		input1_change_handler,
    		radiooptions_optionChosen_binding,
    		slider3_sliderValue_binding,
    		slider4_sliderValue_binding,
    		input2_change_handler,
    		slider5_sliderValue_binding,
    		input3_change_handler,
    		toggle0_opt_binding,
    		input4_input_handler,
    		toggle1_opt_binding,
    		input5_input_handler,
    		slider6_sliderValue_binding,
    		input6_change_handler,
    		slider7_sliderValue_binding,
    		input7_change_handler,
    		slider8_sliderValue_binding,
    		slider9_sliderValue_binding
    	];
    }

    class Control extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$1,
    			create_fragment$1,
    			safe_not_equal,
    			{
    				colorA_hex: 0,
    				colorB_hex: 1,
    				colorC_hex: 31
    			},
    			null,
    			[-1, -1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Control",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get colorA_hex() {
    		throw new Error("<Control>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorA_hex(value) {
    		throw new Error("<Control>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorB_hex() {
    		throw new Error("<Control>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorB_hex(value) {
    		throw new Error("<Control>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colorC_hex() {
    		throw new Error("<Control>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colorC_hex(value) {
    		throw new Error("<Control>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.57.0 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let div1;
    	let div0;
    	let sidebar;
    	let updating_colorA_hex;
    	let updating_colorB_hex;
    	let updating_colorC_hex;
    	let t;
    	let control;
    	let updating_colorA_hex_1;
    	let updating_colorB_hex_1;
    	let updating_colorC_hex_1;
    	let current;

    	function sidebar_colorA_hex_binding(value) {
    		/*sidebar_colorA_hex_binding*/ ctx[3](value);
    	}

    	function sidebar_colorB_hex_binding(value) {
    		/*sidebar_colorB_hex_binding*/ ctx[4](value);
    	}

    	function sidebar_colorC_hex_binding(value) {
    		/*sidebar_colorC_hex_binding*/ ctx[5](value);
    	}

    	let sidebar_props = {};

    	if (/*colorA*/ ctx[0] !== void 0) {
    		sidebar_props.colorA_hex = /*colorA*/ ctx[0];
    	}

    	if (/*colorB*/ ctx[1] !== void 0) {
    		sidebar_props.colorB_hex = /*colorB*/ ctx[1];
    	}

    	if (/*colorC*/ ctx[2] !== void 0) {
    		sidebar_props.colorC_hex = /*colorC*/ ctx[2];
    	}

    	sidebar = new Sidebar({ props: sidebar_props, $$inline: true });
    	binding_callbacks.push(() => bind(sidebar, 'colorA_hex', sidebar_colorA_hex_binding));
    	binding_callbacks.push(() => bind(sidebar, 'colorB_hex', sidebar_colorB_hex_binding));
    	binding_callbacks.push(() => bind(sidebar, 'colorC_hex', sidebar_colorC_hex_binding));

    	function control_colorA_hex_binding(value) {
    		/*control_colorA_hex_binding*/ ctx[6](value);
    	}

    	function control_colorB_hex_binding(value) {
    		/*control_colorB_hex_binding*/ ctx[7](value);
    	}

    	function control_colorC_hex_binding(value) {
    		/*control_colorC_hex_binding*/ ctx[8](value);
    	}

    	let control_props = {};

    	if (/*colorA*/ ctx[0] !== void 0) {
    		control_props.colorA_hex = /*colorA*/ ctx[0];
    	}

    	if (/*colorB*/ ctx[1] !== void 0) {
    		control_props.colorB_hex = /*colorB*/ ctx[1];
    	}

    	if (/*colorC*/ ctx[2] !== void 0) {
    		control_props.colorC_hex = /*colorC*/ ctx[2];
    	}

    	control = new Control({ props: control_props, $$inline: true });
    	binding_callbacks.push(() => bind(control, 'colorA_hex', control_colorA_hex_binding));
    	binding_callbacks.push(() => bind(control, 'colorB_hex', control_colorB_hex_binding));
    	binding_callbacks.push(() => bind(control, 'colorC_hex', control_colorC_hex_binding));

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(sidebar.$$.fragment);
    			t = space();
    			create_component(control.$$.fragment);
    			attr_dev(div0, "class", "container svelte-qkzg4s");
    			add_location(div0, file, 16, 1, 208);
    			add_location(div1, file, 12, 0, 177);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(sidebar, div0, null);
    			append_dev(div0, t);
    			mount_component(control, div0, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const sidebar_changes = {};

    			if (!updating_colorA_hex && dirty & /*colorA*/ 1) {
    				updating_colorA_hex = true;
    				sidebar_changes.colorA_hex = /*colorA*/ ctx[0];
    				add_flush_callback(() => updating_colorA_hex = false);
    			}

    			if (!updating_colorB_hex && dirty & /*colorB*/ 2) {
    				updating_colorB_hex = true;
    				sidebar_changes.colorB_hex = /*colorB*/ ctx[1];
    				add_flush_callback(() => updating_colorB_hex = false);
    			}

    			if (!updating_colorC_hex && dirty & /*colorC*/ 4) {
    				updating_colorC_hex = true;
    				sidebar_changes.colorC_hex = /*colorC*/ ctx[2];
    				add_flush_callback(() => updating_colorC_hex = false);
    			}

    			sidebar.$set(sidebar_changes);
    			const control_changes = {};

    			if (!updating_colorA_hex_1 && dirty & /*colorA*/ 1) {
    				updating_colorA_hex_1 = true;
    				control_changes.colorA_hex = /*colorA*/ ctx[0];
    				add_flush_callback(() => updating_colorA_hex_1 = false);
    			}

    			if (!updating_colorB_hex_1 && dirty & /*colorB*/ 2) {
    				updating_colorB_hex_1 = true;
    				control_changes.colorB_hex = /*colorB*/ ctx[1];
    				add_flush_callback(() => updating_colorB_hex_1 = false);
    			}

    			if (!updating_colorC_hex_1 && dirty & /*colorC*/ 4) {
    				updating_colorC_hex_1 = true;
    				control_changes.colorC_hex = /*colorC*/ ctx[2];
    				add_flush_callback(() => updating_colorC_hex_1 = false);
    			}

    			control.$set(control_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);
    			transition_in(control.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(control.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(sidebar);
    			destroy_component(control);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let colorA;
    	let colorB;
    	let colorC;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function sidebar_colorA_hex_binding(value) {
    		colorA = value;
    		$$invalidate(0, colorA);
    	}

    	function sidebar_colorB_hex_binding(value) {
    		colorB = value;
    		$$invalidate(1, colorB);
    	}

    	function sidebar_colorC_hex_binding(value) {
    		colorC = value;
    		$$invalidate(2, colorC);
    	}

    	function control_colorA_hex_binding(value) {
    		colorA = value;
    		$$invalidate(0, colorA);
    	}

    	function control_colorB_hex_binding(value) {
    		colorB = value;
    		$$invalidate(1, colorB);
    	}

    	function control_colorC_hex_binding(value) {
    		colorC = value;
    		$$invalidate(2, colorC);
    	}

    	$$self.$capture_state = () => ({
    		Header,
    		Sidebar,
    		Control,
    		colorA,
    		colorB,
    		colorC
    	});

    	$$self.$inject_state = $$props => {
    		if ('colorA' in $$props) $$invalidate(0, colorA = $$props.colorA);
    		if ('colorB' in $$props) $$invalidate(1, colorB = $$props.colorB);
    		if ('colorC' in $$props) $$invalidate(2, colorC = $$props.colorC);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		colorA,
    		colorB,
    		colorC,
    		sidebar_colorA_hex_binding,
    		sidebar_colorB_hex_binding,
    		sidebar_colorC_hex_binding,
    		control_colorA_hex_binding,
    		control_colorB_hex_binding,
    		control_colorC_hex_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
