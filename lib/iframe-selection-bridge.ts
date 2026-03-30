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
  var overlay = null;
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

  // ── Overlay highlight ──

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #0B99FF;background:rgba(11,153,255,0.08);transition:all 0.1s ease;display:none;';
    document.body.appendChild(overlay);
    return overlay;
  }

  function showOverlay(rect) {
    var o = ensureOverlay();
    o.style.top = rect.top + 'px';
    o.style.left = rect.left + 'px';
    o.style.width = rect.width + 'px';
    o.style.height = rect.height + 'px';
    o.style.display = 'block';
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  // ── Event handlers ──

  function isBridge(el) {
    return el === overlay || (el.tagName === 'SCRIPT' && el.dataset.bridge);
  }

  function onMouseMove(e) {
    if (!active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement || isBridge(el)) {
      if (lastTarget) {
        lastTarget = null;
        hideOverlay();
        window.parent.postMessage({ type: 'element-select:hover-clear' }, '*');
      }
      return;
    }
    if (el === lastTarget) return;
    lastTarget = el;
    var ctx = extractContext(el);
    showOverlay(ctx.rect);
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
      hideOverlay();
      document.body.style.cursor = '';
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
