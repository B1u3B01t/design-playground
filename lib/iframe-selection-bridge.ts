// ---------------------------------------------------------------------------
// Iframe Selection Bridge Script
// ---------------------------------------------------------------------------
// Generates a <script> tag to inject into HTML iframe content.
// Enables element selection inside iframes by communicating hover/click
// events to the parent window via postMessage.
// ---------------------------------------------------------------------------

/**
 * Returns a self-contained <script> tag string that, when injected into
 * an iframe's HTML, enables element selection via postMessage.
 *
 * Protocol:
 *   Parent → Iframe:
 *     { type: 'element-select:enter' }   — enable selection mode
 *     { type: 'element-select:exit' }    — disable selection mode
 *
 *   Iframe → Parent:
 *     { type: 'element-select:hover', data: { ... } }
 *     { type: 'element-select:click', data: { ... } }
 *     { type: 'element-select:hover-clear' }
 */
export function getSelectionBridgeScript(): string {
  return `<script data-bridge="element-select">
(function() {
  var active = false;
  var lastTarget = null;

  // ── Helpers ──

  function buildSelector(el) {
    var tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    var cls = Array.prototype.slice.call(el.classList, 0, 3).join('.');
    return cls ? tag + '.' + cls : tag;
  }

  function getAncestors(el, max) {
    var result = [];
    var cur = el.parentElement;
    var depth = 0;
    while (cur && depth < (max || 8)) {
      if (cur !== document.body && cur !== document.documentElement) {
        result.push(cur.tagName.toLowerCase());
      }
      cur = cur.parentElement;
      depth++;
    }
    return result;
  }

  var ATTRS = ['class', 'id', 'role', 'aria-label', 'href', 'src', 'type', 'placeholder'];
  function getAttrs(el) {
    var out = {};
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v) out[ATTRS[i] === 'class' ? 'className' : ATTRS[i]] = v;
    }
    return out;
  }

  function extractContext(el) {
    var tag = el.tagName.toLowerCase();
    var raw = (el.innerText || '').trim();
    var html = el.outerHTML;
    var rect = el.getBoundingClientRect();
    return {
      tagName: tag,
      displayName: tag,
      textContent: raw.length > 150 ? raw.slice(0, 150) + '\\u2026' : raw,
      attributes: getAttrs(el),
      cssSelector: buildSelector(el),
      ancestorComponents: getAncestors(el),
      htmlSource: html.length > 500 ? html.slice(0, 500) + '\\u2026' : html,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    };
  }

  // ── Event handlers ──

  function isBridge(el) {
    return el.tagName === 'SCRIPT' && el.dataset && el.dataset.bridge;
  }

  function onMouseMove(e) {
    if (!active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement || isBridge(el)) {
      if (lastTarget) {
        lastTarget = null;
        window.parent.postMessage({ type: 'element-select:hover-clear' }, '*');
      }
      return;
    }
    if (el === lastTarget) return;
    lastTarget = el;
    var ctx = extractContext(el);
    window.parent.postMessage({ type: 'element-select:hover', data: ctx }, '*');
  }

  function onClick(e) {
    if (!active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement || isBridge(el)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    var ctx = extractContext(el);
    window.parent.postMessage({ type: 'element-select:click', data: ctx }, '*');
  }

  // ── Message listener from parent ──

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'element-select:enter') {
      active = true;
      document.body.style.cursor = 'crosshair';
    } else if (e.data.type === 'element-select:exit') {
      active = false;
      lastTarget = null;
      document.body.style.cursor = '';
    } else if (e.data.type === 'element-select:hover-at') {
      // Parent proxied a mousemove through the overlay
      var el = document.elementFromPoint(e.data.x, e.data.y);
      if (!el || el === document.body || el === document.documentElement || isBridge(el)) {
        if (lastTarget) {
          lastTarget = null;
          window.parent.postMessage({ type: 'element-select:hover-clear' }, '*');
        }
        return;
      }
      if (el === lastTarget) return;
      lastTarget = el;
      var ctx = extractContext(el);
      window.parent.postMessage({ type: 'element-select:hover', data: ctx }, '*');
    } else if (e.data.type === 'element-select:click-at') {
      // Parent proxied a click through the overlay
      var el2 = document.elementFromPoint(e.data.x, e.data.y);
      if (!el2 || el2 === document.body || el2 === document.documentElement || isBridge(el2)) return;
      var ctx2 = extractContext(el2);
      window.parent.postMessage({ type: 'element-select:click', data: ctx2 }, '*');
    }
  });

  // ── Design editor bridge ──

  // Managed <style> tag for design editor overrides
  var designStyleEl = null;

  function getDesignStyleEl() {
    if (!designStyleEl) {
      designStyleEl = document.createElement('style');
      designStyleEl.id = 'design-editor-overrides';
      designStyleEl.setAttribute('data-design-editor', 'true');
      (document.head || document.documentElement).appendChild(designStyleEl);
    }
    return designStyleEl;
  }

  // Extract computed styles for an element
  var STYLE_PROPS = [
    'display','flex-direction','flex-wrap','align-items','justify-content','gap',
    'grid-template-columns','grid-template-rows','position','top','right','bottom','left',
    'padding-top','padding-right','padding-bottom','padding-left',
    'margin-top','margin-right','margin-bottom','margin-left',
    'width','height','min-width','min-height','max-width','max-height',
    'font-family','font-size','font-weight','line-height','letter-spacing',
    'text-align','text-decoration','text-transform','color',
    'background-color','background-image',
    'border-top-width','border-right-width','border-bottom-width','border-left-width',
    'border-top-style','border-right-style','border-bottom-style','border-left-style',
    'border-top-color','border-right-color','border-bottom-color','border-left-color',
    'border-top-left-radius','border-top-right-radius','border-bottom-right-radius','border-bottom-left-radius',
    'box-shadow','opacity','overflow','overflow-x','overflow-y',
    'z-index','transform','transition'
  ];

  function kebabToCamel(s) {
    return s.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
  }

  function extractStyles(el) {
    var cs = window.getComputedStyle(el);
    var out = {};
    for (var i = 0; i < STYLE_PROPS.length; i++) {
      out[kebabToCamel(STYLE_PROPS[i])] = cs.getPropertyValue(STYLE_PROPS[i]);
    }
    return out;
  }

  // Handle design editor messages from parent
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'design-editor:get-styles') {
      var target = document.querySelector(e.data.cssSelector);
      if (target) {
        window.parent.postMessage({
          type: 'design-editor:styles',
          cssSelector: e.data.cssSelector,
          styles: extractStyles(target)
        }, '*');
      }
    } else if (e.data.type === 'design-editor:inject-style') {
      getDesignStyleEl().textContent = e.data.rules || '';
    } else if (e.data.type === 'design-editor:remove-style') {
      if (designStyleEl) {
        designStyleEl.textContent = '';
      }
    } else if (e.data.type === 'design-editor:set-text') {
      var textTarget = document.querySelector(e.data.cssSelector);
      if (textTarget) textTarget.textContent = e.data.text;
    } else if (e.data.type === 'design-editor:set-attribute') {
      var attrTarget = document.querySelector(e.data.cssSelector);
      if (attrTarget) attrTarget.setAttribute(e.data.attr, e.data.value);
    }
  });

  // Capture-phase click so we intercept before page scripts
  document.addEventListener('click', onClick, true);
  document.addEventListener('mousemove', onMouseMove);
})();
</script>`;
}

/**
 * Injects the selection bridge script into an HTML string.
 * Inserts before </body> if present, otherwise appends to end.
 */
export function injectBridgeScript(html: string): string {
  const script = getSelectionBridgeScript();
  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}\n</body>`);
  }
  return html + '\n' + script;
}
