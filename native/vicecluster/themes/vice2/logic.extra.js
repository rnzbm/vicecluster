// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yousaf Khan
// vice2: telemetria comuna LCI1, fara animatii peste fotografia garajului.
//  - Several readings share one text layer (boost and g; the three fluids):
//    laid out here at their screen x with the font's
//    advances (ctx.fonts), as the hand port did. Before the theme is built
//    (ctx.fonts empty) the bindings' plain text stands.
//  - The gear: after the M in manual, else centred in the box.
// Tyre readings are not shown; the center photo stays clear.
'use strict';
const fin = (v) => typeof v === 'number' && isFinite(v);
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
        const st = ctx.state.vice2 || (ctx.state.vice2 = {});
        const s = sig || {};
        const eng = lets.eng;

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
                const engineHp = fin(eng) ? String(Math.round(Math.max(0, eng))) : '--';
                o.val156 = place(ctx, P, 'val156', [{ s: engineHp, x: A.engEnd, align: 'right' }]);
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
