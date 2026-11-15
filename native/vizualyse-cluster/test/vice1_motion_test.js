// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 RNZALI
'use strict';
const assert = require('assert');
const theme = require('../themes/built/vice1.theme.json');
const logic = require('../themes/built/vice1.logic.js');
const core = require('../src/theme_core.js');
const sim = require('../src/sim.js');
const base = sim.at(0, 'sport');
const context = () => ({ params: theme.params, fonts: theme.fonts, core, state: {}, t: 0, dt: 0.04 });
function tick(ctx, kmh, extra) {
    ctx.t += ctx.dt;
    const out = logic.update(Object.assign({}, base, { kmh }, extra || {}), ctx);
    assert(/^[a-h]$/.test(out.wheelFront.text));
    assert(/^[A-H]$/.test(out.wheelRear.text));
    assert.strictEqual(out.wheelFront.text.toUpperCase(), out.wheelRear.text);
    return out;
}

const ctx = context();
const frames = {};
for (let i = 0; i < 40; i++) frames[tick(ctx, 60).wheelFront.text] = true;
assert(Object.keys(frames).length >= 6, 'Driving must advance wheel frames');
const parked = tick(ctx, 0).wheelFront.text;
for (let i = 0; i < 20; i++) assert.strictEqual(tick(ctx, 0).wheelFront.text, parked);
[undefined, null, NaN, Infinity, '60', 0.4].forEach((speed) => {
    assert.strictEqual(tick(ctx, speed).wheelFront.text, parked);
});
const slow = context(), fast = context(), reverse = context();
tick(slow, 10);
tick(fast, 60);
tick(reverse, 60, { gearMode: 'R' });
assert(fast.state.vice1.wheelPhase > slow.state.vice1.wheelPhase);
assert(Math.abs(fast.state.vice1.wheelPhase + reverse.state.vice1.wheelPhase - 1) < 1e-9);
const capped = context();
capped.dt = 10;
tick(capped, 300);
assert(capped.state.vice1.wheelPhase <= theme.params.wheelAnimation.maxCycles * 0.1 + 1e-9);

const removed = ['eleUnit', 'eleLabel', 'sysWords', 'sysNum', 'batBar'];
removed.forEach((name) => assert(!theme.layers.some((l) => l.name === name)));
const a = tick(context(), 60, { engineHp: 200, elecHp: 110, socPct: 99, evRangeKm: 100 });
const b = tick(context(), 60, { engineHp: 200, elecHp: -100, socPct: 0, evRangeKm: 0 });
['val156', 'powerBar', 'fluids', 'ranges'].forEach((name) => {
    assert.deepStrictEqual(a[name], b[name], name + ' must ignore electric telemetry');
});
removed.forEach((name) => assert.strictEqual(a[name], undefined));
const wheelLayer = theme.layers.find((l) => l.name === 'wheelFront');
'abcdefghABCDEFGH'.split('').forEach((ch) => assert(wheelLayer.glyphs.indexOf(ch) >= 0));
assert.deepStrictEqual(core.check(theme), []);
console.log('ok vice1 motion: moving, parking, missing speed, reverse, rate cap, no hybrid data');
