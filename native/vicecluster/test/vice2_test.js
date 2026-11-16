// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 RNZALI
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const theme = require('../themes/built/vice2.theme.json');
const original = require('../themes/built/vice1.theme.json');
const logic = require('../themes/built/vice2.logic.js');
const core = require('../src/theme_core.js');
const sim = require('../src/sim.js');
const component = require('../component.json');
const base = path.resolve(__dirname, '..');
const design = fs.readFileSync(path.join(base, 'themes/vice2/design.html'), 'utf8');

assert.strictEqual(theme.title, 'GTA VI Garage');
assert.strictEqual(theme.family, 'vice2');
assert.strictEqual(theme.mode, 'sport');
assert.strictEqual(theme.ship, true);
assert.deepStrictEqual(core.check(theme), []);
assert.strictEqual(theme.layers.length, 28);
assert.strictEqual(Object.keys(theme.assets).length, 11);
assert(!theme.layers.some((l) => /wheel|smoke/.test(l.name)));
assert(design.includes('ENGINE POWER'));
assert(design.includes('data-text="wantedStars"'));
assert(design.includes('fill="#080512" opacity=".9"'), 'horsepower needs a dark backing');
assert(design.includes('fill="#080512" opacity=".94"'), 'Wanted needs a dark backing');
assert(design.includes('href="assets/gtalogo-cutout.png"'), 'GTA logo should replace the photo subtitle');
assert(!design.includes('VICE CITY / PRIVATE GARAGE'));
assert.match(design, /<image x="610" y="52" width="700" height="532" preserveAspectRatio="xMidYMid meet"/,
    'Decorul extins trebuie sa acopere tot hexagonul fara redimensionare disproportionata');
assert(fs.existsSync(path.join(base, 'themes/vice2/assets/garage-full-hex.jpg')));
const scene = design.slice(design.indexOf('<g id="garageScene"'), design.indexOf('</g>', design.indexOf('<g id="garageScene"')));
assert(!scene.includes('stroke-width="2"'), 'Fotografia nu trebuie sa aiba rama peste logo');
assert(scene.includes('href="assets/garage-full-hex.jpg"'), 'Decorul generat trebuie sa umple hexagonul');
assert(!design.includes('garageBackdropBlur'), 'Decorul nu trebuie inlocuit cu un fundal estompat');
assert(scene.indexOf('garageBottomFade') < scene.indexOf('href="assets/gtalogo-cutout.png"'),
    'Logo-ul trebuie sa ramana deasupra extensiei decorului');
const stars = theme.layers.find((layer) => layer.name === 'wantedStars');
const starIndex = stars.glyphs.indexOf('*');
const fiveStarWidth = 4 * stars.adv[starIndex] + stars.cellW;
assert(fiveStarWidth <= stars.w, 'Toate cele cinci stele trebuie sa incapa in strat');
assert(stars.x + stars.w <= 1050, 'Stelele trebuie sa lase spatiu separat pentru nivel');
['speedBand', 'tachBand', 'speedText', 'gearText', 'fluids', 'clock', 'outside', 'odo'].forEach((name) => {
    const a = original.layers.find((l) => l.name === name);
    const b = theme.layers.find((l) => l.name === name);
    assert(a && b, name);
    ['x', 'y', 'w', 'h'].forEach((key) => assert.strictEqual(b[key], a[key], name + '.' + key));
});

const shipped = new Set(component.files.map((f) => f.path));
['vice2.theme.json', 'vice2.logic.js', 'picker.vice2.png', 'picker.vice2.thumb.png']
    .concat(Object.keys(theme.assets).map((k) => theme.assets[k].file))
    .forEach((name) => assert(shipped.has(name), 'Pachetul trebuie sa includa ' + name));
const photo = fs.readFileSync(path.join(base, 'themes/vice2/assets/eumijloc.jpg'));
assert(photo.length > 200000, 'Fotografia centrala trebuie pastrata la calitatea originala');

const ctx = { params: theme.params, fonts: theme.fonts, core, state: {}, t: 0, dt: 0.04 };
const fiveStars = logic.update(Object.assign({}, sim.at(0, 'sport'), { kmh: 250 }), ctx);
assert.strictEqual(fiveStars.wantedStars.text, '*****');
assert.strictEqual(fiveStars.wantedLevel.text, 'LEVEL 5');
const names = new Set(theme.layers.map((l) => l.name));
for (let i = 0; i < 300; i++) {
    ctx.t += ctx.dt;
    const signals = i < 100 ? sim.at(ctx.t, 'sport') : i < 200 ? { kmh: 0 } : {};
    const out = logic.update(signals, ctx);
    Object.keys(out).forEach((name) => assert(names.has(name), 'Strat necunoscut: ' + name));
}
console.log('ok vice2: portret si garaj, geometrie pastrata, fara animatii BMW, toate fisierele in pachet, date lipsa');
