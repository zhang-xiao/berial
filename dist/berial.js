(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.berial = {}));
}(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function error(trigger, msg) {
        if (typeof trigger === 'string')
            msg = trigger;
        if (!trigger)
            return;
        throw new Error(`[Berial: Error]: ${msg}`);
    }
    function request(url, option) {
        if (!window.fetch) {
            error("It looks like that your browser doesn't support fetch. Polyfill is needed before you use it.");
        }
        return fetch(url, Object.assign({ mode: 'cors' }, option))
            .then((res) => res.text())
            .then((data) => data);
    }

    function loadSandbox() {
        return __awaiter(this, void 0, void 0, function* () {
            const rawWindow = window;
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                const iframe = yield loadIframe();
                const proxy = new Proxy(iframe.contentWindow, {
                    get(target, key) {
                        return target[key] || rawWindow[key];
                    },
                    set(target, key, val) {
                        target[key] = val;
                        return true;
                    }
                });
                resolve(proxy);
            }));
        });
    }
    function loadIframe() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                const iframe = document.createElement('iframe');
                iframe.style.cssText =
                    'position: absolute; top: -20000px; width: 1px; height: 1px;';
                document.body.append(iframe);
                iframe.onload = () => resolve(iframe);
            });
        });
    }

    const ANY_OR_NO_PROPERTY = /["'=\w\s]*/;
    const SCRIPT_URL_RE = new RegExp('<script' +
        ANY_OR_NO_PROPERTY.source +
        '(?:src="(.+?)")' +
        ANY_OR_NO_PROPERTY.source +
        '(?:\\/>|>[\\s]*<\\/script>)?', 'g');
    const SCRIPT_CONTENT_RE = new RegExp('<script' + ANY_OR_NO_PROPERTY.source + '>([\\w\\W]+?)</script>', 'g');
    function importHtml(url, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const template = yield request(url);
            const proxy = (yield loadSandbox());
            return yield loadScript(template, proxy, name);
        });
    }
    function loadScript(template, global, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const { scriptURLs, scripts } = parseScript(template);
            const fetchedScripts = yield Promise.all(scriptURLs.map((url) => request(url)));
            const scriptsToLoad = fetchedScripts.concat(scripts);
            let bootstrap = [], unmount = [], mount = [], update = [];
            scriptsToLoad.forEach((script) => {
                const lifecycles = runScript(script, global, name);
                bootstrap = [...bootstrap, lifecycles.bootstrap];
                mount = [...mount, lifecycles.mount];
                unmount = [...unmount, lifecycles.unmount];
                update = [...update, lifecycles.update];
            });
            return { bootstrap, unmount, mount, update };
        });
    }
    function parseScript(template) {
        const scriptURLs = [];
        const scripts = [];
        let match;
        while ((match = SCRIPT_URL_RE.exec(template))) {
            const captured = match[1].trim();
            if (!captured)
                continue;
            scriptURLs.push(captured);
        }
        while ((match = SCRIPT_CONTENT_RE.exec(template))) {
            const captured = match[1].trim();
            if (!captured)
                continue;
            scripts.push(captured);
        }
        return {
            scriptURLs,
            scripts
        };
    }
    function runScript(script, global, umdName) {
        let bootstrap, mount, unmount, update;
        eval(`(function(window) { 
    ${script};
    bootstrap = window[${umdName}].bootstrap;
    mount = window[${umdName}].mount;
    unmount = window[${umdName}].unmount;
    update = window[${umdName}].update;
}).bind(global)(global)`);
        // @ts-ignore
        return { bootstrap, mount, unmount, update };
    }

    const NOT_LOADED = 'NOT_LOADED';
    const LOADING = 'LOADING';
    const NOT_BOOTSTRAPPED = 'NOT_BOOTSTRAPPED';
    const BOOTSTRAPPING = 'BOOTSTRAPPING';
    const NOT_MOUNTED = 'NOT_MOUNTED';
    const MOUNTING = 'MOUNTING';
    const MOUNTED = 'MOUNTED';
    const UNMOUNTING = 'UNMOUNTING';
    let started = false;
    const apps = [];
    function register(name, entry, match, props) {
        apps.push({
            name,
            entry,
            match,
            props,
            status: NOT_LOADED
        });
    }
    function start() {
        started = true;
        reroute();
    }
    function reroute() {
        const { loads, mounts, unmounts } = getAppChanges();
        if (started) {
            return perform();
        }
        else {
            return init();
        }
        function init() {
            return __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(loads.map(runLoad));
            });
        }
        function perform() {
            return __awaiter(this, void 0, void 0, function* () {
                unmounts.map(runUnmount);
                loads.map((app) => __awaiter(this, void 0, void 0, function* () {
                    app = yield runLoad(app);
                    app = yield runBootstrap(app);
                    return runMount(app);
                }));
                mounts.map((app) => __awaiter(this, void 0, void 0, function* () {
                    app = yield runBootstrap(app);
                    return runMount(app);
                }));
            });
        }
    }
    function getAppChanges() {
        const unmounts = [];
        const loads = [];
        const mounts = [];
        apps.forEach((app) => {
            const isActive = app.match(window.location);
            switch (app.status) {
                case NOT_LOADED:
                case LOADING:
                    isActive && loads.push(app);
                    break;
                case NOT_BOOTSTRAPPED:
                case BOOTSTRAPPING:
                case NOT_MOUNTED:
                    isActive && mounts.push(app);
                    break;
                case MOUNTED:
                    !isActive && unmounts.push(app);
            }
        });
        return { unmounts, loads, mounts };
    }
    function compose(fns) {
        fns = Array.isArray(fns) ? fns : [fns];
        return (props) => fns.reduce((p, fn) => p.then(() => fn(props)), Promise.resolve());
    }
    function runLoad(app) {
        return __awaiter(this, void 0, void 0, function* () {
            if (app.loaded) {
                return app.loaded;
            }
            app.loaded = Promise.resolve().then(() => __awaiter(this, void 0, void 0, function* () {
                app.status = LOADING;
                let lifecycle = null;
                if (typeof app.entry === 'string') {
                    lifecycle = yield importHtml(app.entry, app.name);
                }
                else {
                    lifecycle = yield app.entry(app.props);
                }
                let host = yield loadShadow(app);
                app.status = NOT_BOOTSTRAPPED;
                app.bootstrap = compose(lifecycle.bootstrap);
                app.mount = compose(lifecycle.mount);
                app.unmount = compose(lifecycle.unmount);
                app.update = compose(lifecycle.update);
                app.host = host;
                delete app.loaded;
                return app;
            }));
            return app.loaded;
        });
    }
    function loadShadow(app) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    class Berial extends HTMLElement {
                        static get componentName() {
                            return app.name;
                        }
                        connectedCallback() {
                            this.attachShadow({ mode: 'open' });
                            resolve(this);
                        }
                        constructor() {
                            super();
                        }
                    }
                    const hasDef = window.customElements.get(app.name);
                    if (!hasDef) {
                        customElements.define(app.name, Berial);
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    function runUnmount(app) {
        return __awaiter(this, void 0, void 0, function* () {
            if (app.status != MOUNTED) {
                return app;
            }
            app.status = UNMOUNTING;
            yield app.unmount(app.props);
            app.status = NOT_MOUNTED;
            return app;
        });
    }
    function runBootstrap(app) {
        return __awaiter(this, void 0, void 0, function* () {
            if (app.status !== NOT_BOOTSTRAPPED) {
                return app;
            }
            app.status = BOOTSTRAPPING;
            yield app.bootstrap(app.props);
            app.status = NOT_MOUNTED;
            return app;
        });
    }
    function runMount(app) {
        return __awaiter(this, void 0, void 0, function* () {
            if (app.status !== NOT_MOUNTED) {
                return app;
            }
            app.status = MOUNTING;
            yield app.mount(app.props);
            app.status = MOUNTED;
            return app;
        });
    }
    const routingEventsListeningTo = ['hashchange', 'popstate'];
    function urlReroute() {
        reroute();
    }
    const capturedEventListeners = {
        hashchange: [],
        popstate: []
    };
    window.addEventListener('hashchange', urlReroute);
    window.addEventListener('popstate', urlReroute);
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;
    window.addEventListener = function (name, fn, ...args) {
        if (routingEventsListeningTo.indexOf(name) >= 0 &&
            !capturedEventListeners[name].some((l) => l == fn)) {
            capturedEventListeners[name].push(fn);
            return;
        }
        // @ts-ignore
        return originalAddEventListener.apply(this, args);
    };
    window.removeEventListener = function (name, fn, ...args) {
        if (routingEventsListeningTo.indexOf(name) >= 0) {
            capturedEventListeners[name] = capturedEventListeners[name].filter((l) => l !== fn);
            return;
        }
        //@ts-ignore
        return originalRemoveEventListener.apply(this, args);
    };
    function patchedUpdateState(updateState, ...args) {
        return function () {
            const urlBefore = window.location.href;
            //@ts-ignore
            updateState.apply(this, args);
            const urlAfter = window.location.href;
            if (urlBefore !== urlAfter) {
                // @ts-ignore
                urlReroute(new PopStateEvent('popstate'));
            }
        };
    }
    window.history.pushState = patchedUpdateState(window.history.pushState);
    window.history.replaceState = patchedUpdateState(window.history.replaceState);

    exports.importHtml = importHtml;
    exports.loadSandbox = loadSandbox;
    exports.loadScript = loadScript;
    exports.register = register;
    exports.start = start;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=berial.js.map
