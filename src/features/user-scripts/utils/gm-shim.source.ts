/**
 * ARC-02/03/04 + §4 — Greasemonkey/Tampermonkey polyfill, shipped as source.
 * The composed source runs inside the injected world (USER_SCRIPT or MAIN).
 * Privileged ops travel: script world --postMessage--> ISOLATED relay
 * (relay.ts) --chrome.runtime--> background --> back the same path.
 * Response correlation uses incrementing call ids + pending-promise map.
 */
export const GM_SHIM_SOURCE: string = `
(function () {
  "use strict";
  var CALL = "us:gm:call";
  var RESP = "us:gm:resp";
  var CHANGED = "us:gm:changed";
  var seq = 0;
  var pending = new Map();
  var changeListeners = new Map();
  var listenerSeq = 0;

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.__us === RESP && pending.has(d.id)) {
      var p = pending.get(d.id);
      pending.delete(d.id);
      if (d.ok) p.resolve(d.data);
      else p.reject(new Error(d.error || "GM RPC failed"));
    } else if (d.__us === CHANGED) {
      var set = changeListeners.get(d.scriptId + ":" + d.key);
      if (!set) return;
      set.forEach(function (fn) {
        try { fn(d.key, d.oldValue, d.newValue, d.remote); } catch (e) {}
      });
    }
  });

  function call(fn, args) {
    var id = ++seq;
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      setTimeout(function () {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("GM RPC timeout: " + fn));
        }
      }, 30000);
      window.postMessage({ __us: CALL, id: id, fn: fn, args: args, scriptId: __US_CONFIG__.scriptId }, "*");
    });
  }

  function syncOk(v) { return { ok: true, data: v }; }

  function buildGM(cfg) {
    var has = function (name) { return cfg.apis.indexOf(name) !== -1; };
    var gm = {};
    var async = function (v) { return Promise.resolve(v).then(syncOk); };

    if (has("GM.getValue") || has("GM_getValue")) {
      gm.GM_getValue = function (key, def) { return call("gm_get", [key]).then(function (r) { var v = r.value; return v === undefined ? def : v; }); };
      gm.GM = gm.GM || {}; gm.GM.getValue = function (k, d) { return gm.GM_getValue(k, d); };
    }
    if (has("GM.setValue") || has("GM_setValue")) {
      gm.GM_setValue = function (key, value) { return call("gm_set", [key, value]).then(function () { return undefined; }); };
      gm.GM = gm.GM || {}; gm.GM.setValue = function (k, v) { return gm.GM_setValue(k, v); };
    }
    if (has("GM.deleteValue") || has("GM_deleteValue")) {
      gm.GM_deleteValue = function (key) { return call("gm_delete", [key]).then(function () { return undefined; }); };
      gm.GM = gm.GM || {}; gm.GM.deleteValue = function (k) { return gm.GM_deleteValue(k); };
    }
    if (has("GM.listValues") || has("GM_listValues")) {
      gm.GM_listValues = function () { return call("gm_list", []); };
      gm.GM = gm.GM || {}; gm.GM.listValues = function () { return gm.GM_listValues(); };
    }
    if (has("GM.addValueChangeListener") || has("GM_addValueChangeListener")) {
      gm.GM_addValueChangeListener = function (key, fn) {
        var id = ++listenerSeq;
        var k = cfg.scriptId + ":" + key;
        if (!changeListeners.has(k)) changeListeners.set(k, new Set());
        changeListeners.get(k).add(fn);
        call("gm_watch", [key, id]).catch(function () {});
        return id;
      };
      gm.GM = gm.GM || {}; gm.GM.addValueChangeListener = function (k, f) { return gm.GM_addValueChangeListener(k, f); };
    }
    if (has("GM.removeValueChangeListener") || has("GM_removeValueChangeListener")) {
      gm.GM_removeValueChangeListener = function (listenerId) {
        changeListeners.forEach(function (set) {
          set.forEach(function (fn) { /* ids not mapped 1:1; best effort clear all for key scan */ });
        });
        return call("gm_unwatch", [listenerId]).then(function () { return undefined; });
      };
      gm.GM = gm.GM || {}; gm.GM.removeValueChangeListener = function (i) { return gm.GM_removeValueChangeListener(i); };
    }
    if (has("GM.xmlHttpRequest") || has("GM_xmlhttpRequest")) {
      gm.GM_xmlhttpRequest = function (details) {
        call("gm_xhr", [details]).then(function (res) {
          var resp = res.response;
          var fake = {
            status: resp.status, statusText: resp.statusText,
            readyState: 4, responseHeaders: resp.responseHeaders,
            finalUrl: resp.finalUrl, response: resp.data,
            responseText: resp.isBase64 ? "" : resp.data,
          };
          if (details.onload) try { details.onload(fake); } catch (e) {}
          if (resp.status >= 200 && resp.status < 300 && details.onload) {}
          else if (resp.status >= 400 && details.onerror) try { details.onerror(fake); } catch (e) {}
        }).catch(function (err) {
          if (details.onerror) try { details.onerror({ error: err, responseText: "" }); } catch (e) {}
        });
        return { abort: function () {} };
      };
      gm.GM = gm.GM || {}; gm.GM.xmlHttpRequest = function (d) { return gm.GM_xmlhttpRequest(d); };
    }
    if (has("GM.download") || has("GM_download")) {
      gm.GM_download = function (url, name) {
        var details = typeof url === "object" ? url : { url: url, name: name };
        return call("gm_download", [details]).then(function () { if (details.onload) details.onload(); }, function (e) { if (details.onerror) details.onerror(e); });
      };
      gm.GM = gm.GM || {}; gm.GM.download = function (u, n) { return gm.GM_download(u, n); };
    }
    if (has("GM.addStyle") || has("GM_addStyle")) {
      gm.GM_addStyle = function (css) {
        var s = document.createElement("style");
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
        return s;
      };
      gm.GM = gm.GM || {}; gm.GM.addStyle = function (c) { return gm.GM_addStyle(c); };
    }
    if (has("GM.getResourceUrl") || has("GM_getResourceURL")) {
      gm.GM_getResourceURL = function (name) { return call("gm_resource", [name]).then(function (r) { return r.url; }); };
      gm.GM = gm.GM || {}; gm.GM.getResourceUrl = function (n) { return gm.GM_getResourceURL(n); };
    }
    if (has("GM.setClipboard") || has("GM_setClipboard")) {
      gm.GM_setClipboard = function (data) { return call("gm_clipboard", [data]).then(function () { return undefined; }); };
      gm.GM = gm.GM || {}; gm.GM.setClipboard = function (d) { return gm.GM_setClipboard(d); };
    }
    if (has("GM.notification") || has("GM_notification")) {
      gm.GM_notification = function (text, title, image, onclick) {
        var d = typeof text === "object" ? text : { text: text, title: title, image: image, onclick: onclick };
        return call("gm_notify", [d]).then(function () { return undefined; });
      };
      gm.GM = gm.GM || {}; gm.GM.notification = function (t, ti, i, o) { return gm.GM_notification(t, ti, i, o); };
    }
    if (has("GM.registerMenuCommand") || has("GM_registerMenuCommand")) {
      gm.GM_registerMenuCommand = function (caption, fn) {
        return call("gm_menu", [caption]).then(function () { return undefined; });
      };
      gm.GM = gm.GM || {}; gm.GM.registerMenuCommand = function (c, f) { return gm.GM_registerMenuCommand(c, f); };
    }
    // unsafeWindow (ARC-03): in MAIN world window IS the page window.
    if (has("unsafeWindow")) gm.unsafeWindow = window;
    return gm;
  }

  window.__usBuildGM = buildGM;
})();
`;

/** Composes the full injectable source for one script. */
export function buildScriptSource(parts: {
  scriptId: string;
  apis: string[];
  requires: string[];
  body: string;
}): string {
  const config = JSON.stringify({ scriptId: parts.scriptId, apis: parts.apis });
  const libs = parts.requires.join("\n;\n");
  return [
    GM_SHIM_SOURCE,
    libs,
    "(function () {",
    `  var __gm = window.__usBuildGM(${config});`,
    "  for (var k in __gm) { try { Object.defineProperty(window, k, { value: __gm[k], configurable: true }); } catch (e) {} }",
    "  try {",
    parts.body,
    "  } catch (e) { throw e; }",
    "})();",
  ].join("\n");
}
