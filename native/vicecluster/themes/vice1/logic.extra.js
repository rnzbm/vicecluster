// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yousaf Khan
// vice1: LCI1's shared telemetry layout, with metric distances.
//  - Several readings share one text layer (boost and g; the three fluids):
//    laid out here at their screen x with the font's
//    advances (ctx.fonts), as the hand port did. Before the theme is built
//    (ctx.fonts empty) the bindings' plain text stands.
//  - The gear: after the M in manual, else centred in the box.
//  - Wheel frames reuse the Wanted font atlas and advance with speed.
// Wanted stars are bound in design.html; tyre readings are not shown.
'use strict';
const fin = (v) => typeof v === 'number' && isFinite(v);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, f) => (fin(v) ? String(Math.round(f ? v * f : v)) : '--');

function font(ctx, name) { const F = ctx.fonts && ctx.fonts[name]; return F && F.adv && F.glyphs ? F : null; }
/* items [{ s, x (screen px), align }] in one text layer (P.text[layer]: its x, width, font) */
function place(ctx, P, layer, items) {
    const L = P.text[layer], F = font(ctx, L.font);
    if (!F) return null;
    const blank = Math.max(0, F.glyphs.indexOf(' '));
    const codes = [], pos = [];
    items.forEach((it) => {
        const cs = String(it.s).split('').map((ch) => { const c = F.glyphs.indexOf(ch); return c < 0 ? blank : c; });
        const w = cs.reduce((n, c) => n + F.adv[c], 0);
        let x = it.x - L.x - (it.align === 'right' ? w : it.align === 'center' ? w / 2 : 0);
        cs.forEach((c) => { if (codes.length < 16) { codes.push(c); pos.push(Math.round(x)); } x += F.adv[c]; });
    });
    /* ascending left edges: the shader takes the last glyph left of a pixel */
    const order = codes.map((c, i) => i).sort((a, b) => pos[a] - pos[b]);
    const u_text = [], u_pos = [];
    for (let i = 0; i < 16; i++) {
        if (i < order.length) { u_text.push(codes[order[i]]); u_pos.push(pos[order[i]]); } else { u_text.push(blank); u_pos.push(100000); }
    }
    return { uniforms: { u_text, u_pos, u_meta: [L.w, F.glyphs.length, F.cell[0], order.length] } };
}
function put(out, layer, placed) {
    if (!placed || !out[layer]) return;
    const o = Object.assign({}, out[layer], placed);
    o.uniforms = Object.assign({}, out[layer].uniforms, placed.uniforms);
    delete o.text;
    out[layer] = o;
}

module.exports = {
    update(sig, ctx, out, h) {
        const P = h.P, A = P.at || {}, lets = h.lets;
        const st = ctx.state.vice1 || (ctx.state.vice1 = {});
        const s = sig || {};

        const eng = lets.eng;
        /* Accumulate travel, not wall time: parking and missing data freeze
         * the last frame. Limit the visual rate below the 25 Hz renderer. */
        const W = P.wheelAnimation;
        const speed = fin(s.kmh) ? Math.abs(s.kmh) : 0;
        const delta = fin(ctx.dt) ? clamp(ctx.dt, 0, 0.1) : 0;
        const direction = s.gearMode === 'R' || s.kmh < 0 ? -1 : 1;
        const cycles = speed > 0.5 ? Math.min(speed * W.cyclesPerKmh, W.maxCycles) : 0;
        st.wheelPhase = ((st.wheelPhase || 0) + direction * cycles * delta) % 1;
        if (st.wheelPhase < 0) st.wheelPhase += 1;
        const frame = Math.min(W.frames - 1, Math.floor(st.wheelPhase * W.frames));
        out.wheelFront = { text: String.fromCharCode(97 + frame) };
        out.wheelRear = { text: String.fromCharCode(65 + frame) };

        /* Cosmetic launch smoke, never a wheel-slip or traction reading.
         * Short bursts prevent sustained revving from leaving a permanent cloud. */
        const S = P.launchSmoke;
        const telemetry = fin(s.kmh) && fin(s.throttle) && fin(s.brake) && fin(s.rpm);
        const forward = /^[DSM]$/.test(s.gearMode || '') && fin(s.gear) && s.gear > 0;
        const eligible = telemetry && forward && s.kmh >= 0 && speed < S.maxKmh &&
            s.throttle >= S.throttleMin && s.brake < 0.1 && s.rpm >= S.minRpm;
        st.smokeHeld = eligible ? (st.smokeHeld || 0) + delta : 0;
        const target = eligible && st.smokeHeld <= S.burstSeconds ?
            clamp((s.throttle - 0.55) / 0.45, 0, 1) * (1 - speed / S.maxKmh) : 0;
        const tau = target > (st.smoke || 0) ? S.attackSeconds : S.fadeSeconds;
        st.smoke = (st.smoke || 0) + (target - (st.smoke || 0)) * (1 - Math.exp(-delta / tau));
        if (!telemetry || !forward || s.kmh < 0 || s.brake >= 0.1) st.smoke = 0;
        if (st.smoke < 0.005) st.smoke = 0;
        if (st.smoke > 0) st.smokeClock = ((st.smokeClock || 0) + delta * 1.2) % 1;
        ['smokeLeft0', 'smokeLeft1', 'smokeRight0', 'smokeRight1'].forEach((name, i) => {
            const phase = ((st.smokeClock || 0) + (i % 2) * 0.5 + (i > 1 ? 0.23 : 0)) % 1;
            const alpha = st.smoke * 0.42 * Math.sin(Math.PI * phase);
            out[name] = {
                text: String.fromCharCode(105 + Math.min(3, Math.floor(phase * 4))),
                visible: alpha > 0.005,
                x: (i < 2 ? 850 : 1110) + Math.round(phase * 32),
                // Layer origin, not the SVG text baseline (550).
                y: 489 - Math.round(phase * 24),
                color: [0.85, 0.83, 0.93, alpha],
            };
        });

        /* the gear, every tick */
        if (P.at) {
            const mode = s.gearMode, g = s.gear;
            const gs = fin(g) ? (g === 0 ? 'N' : String(g)) : '--';
            let items;
            if (mode === 'M') items = [{ s: gs, x: A.gearM }];
            else if (/^[PRN]$/.test(mode || '')) items = [{ s: mode, x: A.gearMid, align: 'center' }];
            else if (/^[DS]$/.test(mode || '')) items = [{ s: mode + (fin(g) && g > 0 ? g : ''), x: A.gearMid, align: 'center' }];
            else items = [{ s: gs, x: A.gearMid, align: 'center' }];
            put(out, 'gearText', place(ctx, P, 'gearText', items));
        }

        /* the shared layers, ten times a second */
        const slot = Math.floor(ctx.t * 10);
        if (!(st.slot === slot && st.slow)) {
            st.slot = slot;
            const o = {};
            if (P.at && font(ctx, P.text.val160.font)) {
                const boost = lets.boost;
                const gv = fin(s.gLat) && fin(s.gLon) ? Math.sqrt(s.gLat * s.gLat + s.gLon * s.gLon).toFixed(1) : '--';
                o.val160 = place(ctx, P, 'val160', [{ s: fin(boost) ? Math.max(0, boost).toFixed(1) : '--', x: A.boost }, { s: gv, x: A.gEnd, align: 'right' }]);
                const engS = fin(eng) ? String(Math.round(Math.max(0, eng))) : '--';
                o.val156 = place(ctx, P, 'val156', [{ s: engS, x: A.engEnd, align: 'right' }]);
                /* Fluids beside their bars and fuel range in kilometres. */
                o.fluids = place(ctx, P, 'fluids', [{ s: num(s.fuelPct), x: A.fuelEnd, align: 'right' },
                    { s: num(s.oilC), x: A.oilEnd, align: 'right' }, { s: num(s.coolantC), x: A.coolEnd, align: 'right' }]);
                o.ranges = place(ctx, P, 'ranges', [{ s: num(s.rangeKm) + ' km', x: A.rangeFuel }]);
            }
            st.slow = o;
        }
        Object.keys(st.slow).forEach((k) => put(out, k, st.slow[k]));
        return out;
    },
};
