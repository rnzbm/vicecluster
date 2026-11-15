// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 RNZALI
'use strict';
const assert = require('assert');
const theme = require('../themes/built/vice1.theme.json');
const logic = require('../themes/built/vice1.logic.js');
const core = require('../src/theme_core.js');
const sim = require('../src/sim.js');

function context(params) {
    return { params, fonts: theme.fonts, core, state: {}, t: 0, dt: 0.04 };
}
const ctx = context(theme.params);
const base = sim.at(0, 'sport');
// Design parameters are baked into logic.js when the theme is rebuilt.
assert.strictEqual(theme.params.wantedKmh.length, 5);
theme.params.wantedKmh.forEach((v, i, a) => {
    assert(Number.isFinite(v) && v > 0 && (i === 0 || v > a[i - 1]));
});
function check(kmh, expected, c) {
    c = c || ctx;
    c.t += c.dt;
    const out = logic.update(Object.assign({}, base, { kmh }), c);
    assert.strictEqual(out.wantedStars.text, '*'.repeat(expected));
    assert.strictEqual(out.wantedStars.visible, expected > 0);
    assert.strictEqual(out.wantedLevel.text,
        typeof kmh === 'number' && isFinite(kmh) ? 'LEVEL ' + expected : 'OFFLINE');
    ['psiF', 'psiR', 'tempF', 'tempR', 'tyresF', 'tyresR'].forEach((name) => {
        assert.strictEqual(out[name], undefined, 'Removed TPMS layer: ' + name);
    });
}

check(0, 0);
theme.params.wantedKmh.forEach((threshold, i) => {
    check(threshold - 0.01, i);
    check(threshold, i + 1);
    check(threshold + 0.01, i + 1);
});
// The stars drop again rather than retaining a previous peak.
check(300, 5);
check(90, 2);
check(0, 0);
[undefined, null, NaN, Infinity, '130'].forEach((v) => check(v, 0));
check(-10, 0);
assert.deepStrictEqual(core.check(theme), []);
console.log('ok vice1 Wanted: configured thresholds, falling speed, missing data, no TPMS layers');
