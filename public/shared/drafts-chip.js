/**
 * Blackstone Law — shared drafts chip renderer.
 *
 * Source of truth: /shared/artifact-registry.json (written by skills/drafts-logger).
 * Any drafting skill that calls `log_draft()` (mediation-brief, mc-letter,
 * separate-statement-mtc, etc.) adds an entry to the registry. This module
 * renders a consistent icon + label across every dashboard surface that shows
 * per-case status (command center, mediation pipeline, daily briefing).
 *
 * Rendering surfaces (auto-hydrated on DOMContentLoaded):
 *   1. Case cards                <span class="drafts-chip-mount" data-matter="..."></span>
 *      - Add data-verbose="true" to render "⏳ With attorney · SM" instead of just ⏳.
 *   2. Inline text contexts      <span class="drafts-chip-mount-inline" data-matter="..."></span>
 *      - Used inside stat-card values, brief-timeline chip names, etc.
 *   3. Briefs-Due-Now stat-card  automatic: any .stat-card whose .label reads
 *      "Briefs Due Now" or "Next Brief Due" gets its .value annotated.
 *   4. Brief-timeline chips      automatic: any .brief-chip-name element gets annotated.
 *   5. Daily-briefing mediations automatic: rows inside .card.mediations .item b
 *      whose text contains a registered defendant get an inline chip.
 *
 * Matter-key resolution (fuzzy — see resolveMatterKey):
 *   The registry key is the defendant-only form (e.g., "Veridiam, Inc.").
 *   Dashboard surfaces show mixed forms ("Douglas v. Veridiam, Inc.",
 *   "Veridiam", "Veridiam (Douglas)"). The resolver tries exact match first,
 *   then strips "Plaintiff v. " prefixes and trailing parentheticals, then
 *   falls back to substring/token overlap. Producers should still register
 *   with the canonical defendant-only key for predictability.
 */
(function (window) {
  'use strict';

  var REGISTRY_URL = '/shared/artifact-registry.json';

  // Reuse window.ARTIFACT_REGISTRY if a dashboard already loaded it (the
  // command-center still does its own sync XHR before this script runs).
  function loadRegistry() {
    if (window.ARTIFACT_REGISTRY && window.ARTIFACT_REGISTRY.mappings) {
      return window.ARTIFACT_REGISTRY;
    }
    var registry = { mappings: {} };
    try {
      var xhr = new XMLHttpRequest();
      // Cache-bust per page-load. Registry is small (<25KB) and updates
      // mid-day when producers register/correct draft URLs; without this,
      // ETag revalidation + bfcache can leave chips hydrated against URLs
      // we already fixed in the producer fleet. Caught 2026-04-28 when the
      // LeFiell brief chip kept routing to Mission Control on Ryan's
      // already-open tab even after the registry's relative-path bug was
      // patched in commit 3a3b5dc.
      var cacheBust = REGISTRY_URL + '?t=' + Date.now();
      xhr.open('GET', cacheBust, false); // sync — must be available before hydrate runs
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.send(null);
      if (xhr.status === 200) registry = JSON.parse(xhr.responseText);
    } catch (e) { /* registry is optional — empty mappings render no chips */ }
    window.ARTIFACT_REGISTRY = registry;
    return registry;
  }

  function normalize(s) {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .replace(/\s*\(.*?\)\s*/g, ' ')     // strip parentheticals
      .replace(/,\s*(inc|llc|lp|llp|l\.p\.|l\.l\.c\.|l\.l\.p\.|co|corp|ltd|dba\s.*)\.?/g, ' ')
      .replace(/\s+v\.?\s+/g, ' v ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function defendantOnly(s) {
    // "Douglas v. Veridiam, Inc." → "Veridiam, Inc."; "Veridiam (Douglas)" → "Veridiam"
    if (!s) return '';
    var stripped = String(s).replace(/\s*\(.*?\)\s*$/, '').trim();
    var idx = stripped.search(/\s+v\.?\s+/i);
    if (idx >= 0) stripped = stripped.slice(idx).replace(/^\s+v\.?\s+/i, '');
    return stripped.trim();
  }

  function tokens(s) {
    return normalize(s).split(' ').filter(function (w) { return w.length >= 3; });
  }

  /** Resolve a hint (case name, defendant, matter id) to a registry key. */
  function resolveMatterKey(hint) {
    var reg = loadRegistry();
    if (!hint || !reg.mappings) return null;
    var keys = Object.keys(reg.mappings);
    if (!keys.length) return null;

    // 1. Exact match
    if (reg.mappings[hint]) return hint;

    // 2. Defendant-only form of hint
    var defHint = defendantOnly(hint);
    if (defHint && reg.mappings[defHint]) return defHint;

    // 3. Normalized match
    var normHint = normalize(hint);
    var normDef = normalize(defHint);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var nk = normalize(k);
      if (nk && (nk === normHint || nk === normDef)) return k;
    }

    // 4. Token overlap (≥1 distinctive token match — but require the key's
    //    longest token to be present in the hint, otherwise we'd match every
    //    case containing "inc" or "corp").
    var hintTokens = tokens(hint).concat(tokens(defHint));
    if (!hintTokens.length) return null;
    var hintSet = {};
    hintTokens.forEach(function (t) { hintSet[t] = true; });

    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var kTokens = tokens(key);
      if (!kTokens.length) continue;
      // Longest token in registry key is the anchor (e.g., "veridiam").
      var anchor = kTokens.reduce(function (a, b) { return a.length >= b.length ? a : b; });
      if (anchor.length >= 4 && hintSet[anchor]) return key;
    }
    return null;
  }

  /** Sort drafts newest-first by state_changed/created. */
  function sortDrafts(drafts) {
    return drafts.slice().sort(function (a, b) {
      var ta = a.state_changed || a.created || '';
      var tb = b.state_changed || b.created || '';
      return tb < ta ? -1 : tb > ta ? 1 : 0;
    });
  }

  /** State → icon / color / human label. Used for both the emoji and
   *  the verbose text next to it. Label is the state portion only — the
   *  draft type (e.g. "Brief v3") is prepended separately by draftTypeLabel. */
  function stateMeta(state, fallbackStatus) {
    var s = (state || '').toLowerCase();
    if (s === 'attorney-revising' || s === 'for-attorney-review')
      return { icon: '\u23F3', color: '#eab308', label: 'For review' };
    if (s === 'rq-redlining')
      return { icon: '\u270F\uFE0F', color: '#f97316', label: 'RQ redlining' };
    if (s === 'attorney-returned' || s === 'rq-returned')
      return { icon: '\u2194',     color: '#3b82f6', label: 'Review returned' };
    if (s === 'final')
      return { icon: '\u2713',     color: '#22c55e', label: 'Final' };
    if (s === 'submitted' || s === 'sent' || s === 'filed')
      return { icon: '\u2709\uFE0F', color: '#22c55e', label: 'Sent' };
    if (s === 'auto-drafted')
      return { icon: '\uD83E\uDD16', color: '#a855f7', label: 'Auto-drafted' };
    // Fallback to status field (v1 registry schema)
    var st = (fallbackStatus || '').toLowerCase();
    if (st === 'pending-review')   return { icon: '\uD83D\uDCDD', color: '#d97706', label: 'Pending review' };
    if (st === 'awaiting-client')  return { icon: '\uD83D\uDCDD', color: '#d97706', label: 'Awaiting client' };
    if (st === 'sent' || st === 'filed') return { icon: '\u2709\uFE0F', color: '#22c55e', label: 'Sent' };
    return { icon: '\uD83D\uDCDD', color: '', label: 'Draft' };
  }

  /** Short, human label for the draft's document type (+ version if known).
   *  Prepended to the state label so the chip reads "Brief v3 · For review"
   *  instead of the ambiguous "For review" or "With attorney". */
  var DOC_TYPE_SHORT = {
    'mediation-brief':       'Brief',
    'mc-letter':             'M&C Letter',
    'meet-and-confer':       'M&C Letter',
    'separate-statement':    'Separate Statement',
    'declaration':           'Declaration',
    'mpa':                   'MPA',
    'opposition':            'Opposition',
    'cmc-statement':         'CMC Statement',
    'rfp':                   'RFPs',
    'rfp-set':               'RFPs',
    'srog':                  'SROGs',
    'cover-letter':          'Cover Letter',
    'data-demand':           'Data Demand',
    'stip-to-stay':          'Stip to Stay',
    'belaire-west':          'Belaire-West',
    'proof-of-service':      'POS',
  };
  function draftTypeLabel(draft) {
    var base = '';
    var dt = (draft.doc_type || '').toLowerCase();
    if (dt && DOC_TYPE_SHORT[dt]) {
      base = DOC_TYPE_SHORT[dt];
    } else if (dt) {
      base = draft.doc_type.replace(/-/g, ' ');
    } else if (draft.type) {
      // Strip trailing parenthetical like "(Shelby draft)"; truncate long labels
      var t = String(draft.type).replace(/\s*\(.*?\)\s*$/, '').trim();
      base = t.length > 22 ? t.slice(0, 20) + '\u2026' : t;
    } else {
      base = 'Draft';
    }
    var v = draft.operative_version && draft.operative_version.version;
    if (v) base += ' v' + v;
    return base;
  }

  function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }
  function escapeText(s) { return String(s || '').replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
  }); }

  /** Build the tooltip listing every draft for a case. */
  function buildTooltip(drafts) {
    return drafts.map(function (d) {
      var line = '\u2022 ' + (d.type || d.doc_type || 'Draft');
      if (d.operative_version && d.operative_version.version) line += ' v' + d.operative_version.version;
      if (d.state)        line += ' [' + d.state + ']';
      else if (d.status)  line += ' [' + d.status + ']';
      if (d.current_owner) line += ' - ' + d.current_owner;
      if (d.locked_by)     line += ' (locked by ' + d.locked_by + ')';
      if (d.descriptor)    line += ': ' + d.descriptor;
      return line;
    }).join('\n');
  }

  /**
   * Render the chip HTML for a matter hint.
   * @param {string} matterHint  Any defendant/case-name form.
   * @param {object} opts        { verbose: bool, inline: bool }
   *                             verbose=true includes the label text next to
   *                             the icon. inline=true uses smaller spacing for
   *                             embedding in sentences.
   * @returns {string}  HTML (may be empty if no draft exists for this matter).
   */
  function draftsChip(matterHint, opts) {
    opts = opts || {};
    var key = resolveMatterKey(matterHint);
    if (!key) return '';
    var entry = loadRegistry().mappings[key];
    if (!entry || !entry.drafts || !entry.drafts.length) return '';

    var drafts = sortDrafts(entry.drafts);
    var primary = drafts[0];
    var count = drafts.length;
    var isV2 = !!primary.draft_id;
    var meta = stateMeta(primary.state, primary.status);
    var owner = primary.current_owner || '';
    var tooltip = escapeAttr(buildTooltip(drafts));

    var badge = '';
    if (isV2 && owner) {
      badge = '<span style="background:rgba(71,85,105,.6);color:#f1f5f9;'
            + 'border-radius:8px;padding:0 5px;font-size:.65em;margin-left:3px;'
            + 'font-weight:600;letter-spacing:.02em;">' + escapeText(owner) + '</span>';
    } else if (!isV2) {
      var pending = drafts.filter(function (d) { return d.status === 'pending-review'; }).length;
      if (pending > 0) {
        badge = '<span style="background:#d97706;color:#fff;border-radius:8px;'
              + 'padding:0 5px;font-size:.7em;margin-left:2px;">' + pending + '</span>';
      }
    }
    if (count > 1) {
      badge += '<span style="font-size:.65em;color:#94a3b8;margin-left:3px;">+' + (count - 1) + '</span>';
    }

    var colorStyle = meta.color ? 'color:' + meta.color + ';' : '';
    var leftPad = opts.inline ? '4px' : '6px';
    var fontSize = opts.inline ? '.72em' : '.8em';

    var labelHtml = '';
    if (opts.verbose) {
      // "Brief v3 · For review". Owner is already shown in the colored badge
      // next to the icon, so omit it from the label text to avoid redundancy.
      var labelText = draftTypeLabel(primary) + ' \u00B7 ' + meta.label;
      labelHtml = '<span style="margin-left:4px;font-size:.75em;color:#cbd5e1;'
                + 'font-weight:500;letter-spacing:.01em;">'
                + escapeText(labelText) + '</span>';
    }

    return '<a href="' + escapeAttr(primary.url) + '" target="_blank" rel="noopener"'
         + ' title="' + tooltip + '"'
         + ' class="bl-drafts-chip"'
         + ' style="margin-left:' + leftPad + ';text-decoration:none;opacity:.95;'
         + 'font-size:' + fontSize + ';' + colorStyle + 'display:inline-flex;'
         + 'align-items:center;vertical-align:baseline;"'
         + ' onclick="event.stopPropagation()">'
         + meta.icon + badge + labelHtml + '</a>';
  }

  /* ─────────────────────────────────────────────
   * Hydrators — auto-run on DOMContentLoaded
   * ───────────────────────────────────────────── */

  function hydrateMounts(root) {
    root.querySelectorAll('.drafts-chip-mount').forEach(function (el) {
      if (el.dataset.blHydrated) return;
      var matter = el.dataset.matter || el.textContent.trim();
      if (!matter) return;
      // Default verbose so the team sees the label — set data-verbose="false"
      // for compact mode in space-constrained surfaces.
      var verbose = el.dataset.verbose !== 'false';
      var html = draftsChip(matter, { verbose: verbose });
      if (html) el.innerHTML = html;
      el.dataset.blHydrated = '1';
    });

    root.querySelectorAll('.drafts-chip-mount-inline').forEach(function (el) {
      if (el.dataset.blHydrated) return;
      var matter = el.dataset.matter || el.textContent.trim();
      if (!matter) return;
      var verbose = el.dataset.verbose !== 'false'; // inline defaults to verbose
      var html = draftsChip(matter, { verbose: verbose, inline: true });
      if (html) el.innerHTML = html;
      el.dataset.blHydrated = '1';
    });
  }

  function hydrateStatCards(root) {
    // Any .stat-card whose .label reads "Briefs Due Now" or "Next Brief Due"
    // — annotate the .value with an inline verbose chip.
    root.querySelectorAll('.stat-card').forEach(function (card) {
      if (card.dataset.blHydrated) return;
      var label = card.querySelector('.label');
      if (!label) return;
      var text = (label.textContent || '').trim();
      if (text !== 'Briefs Due Now' && text !== 'Next Brief Due') return;
      var valueEl = card.querySelector('.value');
      if (!valueEl) return;
      var matter = valueEl.textContent.trim();
      if (!matter || matter === '—') return;
      var html = draftsChip(matter, { verbose: true, inline: true });
      if (html) valueEl.insertAdjacentHTML('beforeend', html);
      card.dataset.blHydrated = '1';
    });
  }

  function hydrateBriefTimeline(root) {
    // Brief-timeline uses .brief-chip-name for the defendant short name.
    root.querySelectorAll('.brief-chip-name').forEach(function (el) {
      if (el.dataset.blHydrated) return;
      var matter = el.textContent.trim();
      if (!matter) return;
      // Compact inline chip so the timeline chip stays narrow.
      var html = draftsChip(matter, { verbose: false, inline: true });
      if (html) el.insertAdjacentHTML('beforeend', ' ' + html);
      el.dataset.blHydrated = '1';
    });
  }

  function hydrateDailyBriefingMediations(root) {
    // Daily briefing mediation rows: <div class="card mediations">
    //   <div class="item"><div class="top"><b>Case name</b>...
    root.querySelectorAll('.card.mediations .item .top b').forEach(function (el) {
      if (el.dataset.blHydrated) return;
      // The <b> may contain an <a> wrapping the case name.
      var textEl = el.querySelector('a') || el;
      var matter = textEl.textContent.trim();
      if (!matter) return;
      var html = draftsChip(matter, { verbose: true, inline: true });
      if (html) textEl.insertAdjacentHTML('afterend', html);
      el.dataset.blHydrated = '1';
    });
  }

  function hydrateAll(root) {
    root = root || document;
    hydrateMounts(root);
    hydrateStatCards(root);
    hydrateBriefTimeline(root);
    hydrateDailyBriefingMediations(root);
  }

  /* Expose public API */
  window.BL_DRAFTS = {
    loadRegistry: loadRegistry,
    resolveMatterKey: resolveMatterKey,
    stateMeta: stateMeta,
    draftsChip: draftsChip,
    hydrateAll: hydrateAll
  };

  // Back-compat: command-center templates call draftsChip(name) inline at
  // render time. Keep the bare function on window for those call sites.
  if (typeof window.draftsChip !== 'function') {
    window.draftsChip = function (matter, opts) { return draftsChip(matter, opts); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { hydrateAll(document); });
  } else {
    hydrateAll(document);
  }
})(window);
