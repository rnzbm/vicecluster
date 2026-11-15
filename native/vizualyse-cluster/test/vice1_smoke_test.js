// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 RNZALI
'use strict';
const assert = require('assert');
const theme = require('../themes/built/vice1.theme.json');
const logic = require('../themes/built/vice1.logic.js');
const core = require('../src/theme_core.js');
const sim = require('../src/sim.js');
const names = ['smokeLeft0', 'smokeLeft1', 'smokeRight0', 'smokeRight1'];
const base = Object.assign({}, sim.at(0, 'sport'), {
    kmh: 5, throttle: 1, brake: 0, rpm: 2000, gearMode: 'D', gear: 1,
});
const context = () => ({ params: theme.params, fonts: theme.fonts, core, state: {}, t: 0, dt: 0.04 });
function tick(ctx, extra) {
    ctx.t += ctx.dt;
    const out = logic.update(Object.assign({}, base, extra), ctx);
    names.forEach((name) => {
        const puff = out[name];
        assert(/^[i-l]$/.test(puff.text));
        assert(puff.color.every(Number.isFinite));
        assert(puff.color[3] >= 0 && puff.color[3] <= 0.42);
        assert(puff.y >= 465 && puff.y <= 489);
    });
    return out;
}
const launch = context();
let out;
for (let i = 0; i < 10; i++) out = tick(launch);
assert(names.some((name) => out[name].visible), 'Strong launch must emit smoke');
const before = out.smokeLeft0;
out = tick(launch);
assert(before.x !== out.smokeLeft0.x || before.y !== out.smokeLeft0.y ||
    before.text !== out.smokeLeft0.text, 'Puffs must drift or expand');
const strength = launch.state.vice1.smoke;
tick(launch, { throttle: 0 });
assert(launch.state.vice1.smoke < strength, 'Pedal release must fade smoke');
for (let i = 0; i < 100; i++) out = tick(launch, { throttle: 0 });
names.forEach((name) => assert.strictEqual(out[name].visible, false));

[
    { throttle: 0.5 }, { kmh: 60 }, { kmh: -5 }, { rpm: 800 },
    { brake: 0.5 }, { gearMode: 'P' }, { gearMode: 'N' },
    { gearMode: 'R' }, { gear: 0 },
    ...['kmh', 'throttle', 'brake', 'rpm'].flatMap((key) =>
        [undefined, null, NaN, Infinity, '1'].map((value) => ({ [key]: value }))),
].forEach((extra) => {
    const ctx = context();
    for (let i = 0; i < 10; i++) out = tick(ctx, extra);
    names.forEach((name) => assert.strictEqual(out[name].visible, false,
        'Smoke must be off for ' + JSON.stringify(extra)));
});
const missing = context();
for (let i = 0; i < 10; i++) tick(missing);
out = tick(missing, { throttle: undefined });
names.forEach((name) => assert.strictEqual(out[name].visible, false));
const sustained = context();
for (let i = 0; i < 200; i++) out = tick(sustained);
names.forEach((name) => assert.strictEqual(out[name].visible, false,
    'Sustained revving must not emit an endless cloud'));
assert.deepStrictEqual(core.check(theme), []);
const font = theme.layers.find((l) => l.name === 'wheelFront').binds.u_font;
names.forEach((name) => assert.strictEqual(theme.layers.find((l) => l.name === name).binds.u_font, font));
console.log('ok vice1 smoke: launch, drift, fade, short burst, fail-closed signals, shared atlas');
