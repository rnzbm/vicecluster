#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Nisipeanu
'use strict';
/**
 * The release tooling's tool fields: a tool's component.json `requires`,
 * `mguHmi` and `uninstallable` reach its catalog entry, which the catalog
 * check accepts; its
 * artifact's component.json keeps what the deploy tool reads (`activate`,
 * `deactivate`, `mguHmi`, `keepRunning`, ...) and leaves `requires` and
 * `uninstallable` to the catalog, as mgu-store's `deploy/hu artifact`; a malformed
 * `requires` or `mguHmi` is refused; the build tree takes each submodule at
 * the commit HEAD records, and refuses one its checkout lacks; and this
 * repository's chain is declared: the ViceCluster app (for iDrive 7)
 * requires vicecluster, which requires the deploy tool, cluster-render,
 * mgu-python and mgu-render and carries its own systemd unit; both are
 * removable.
 *
 *   node release/test/release_test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');
const { buildArtifact } = require('../tool_artifact.js');
const { components, catalogEntry, exportHead } = require('../release.js');
const catalog = require('../catalog.js');

/* The members of a tgz the packer wrote (ustar), by name. */
function untgz(file) {
    const tar = zlib.gunzipSync(fs.readFileSync(file));
    const out = {};
    for (let off = 0; off + 512 <= tar.length;) {
        const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/, '');
        if (!name) {
            break;
        }
        const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/, '').trim(), 8);
        out[name] = tar.slice(off + 512, off + 512 + size);
        off += 512 + Math.ceil(size / 512) * 512;
    }
    return out;
}

const tests = [];
function test(name, fn) {
    tests.push({ name, fn });
}

function fixtureTool(root, c) {
    const dir = path.join(root, 'native', c.id);
    fs.mkdirSync(path.join(dir, 'systemd'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'hook.js'), 'console.log("{}");\n');
    fs.writeFileSync(path.join(dir, 'systemd', `${c.id}.service`), '[Service]\nExecStart=/bin/true\n');
    fs.writeFileSync(path.join(dir, 'component.json'), JSON.stringify(c, null, 2));
    return dir;
}

const FIXTURE = {
    id: 'fixture-tool',
    kind: 'tool',
    version: '1.2.3',
    title: 'Fixture',
    requires: { 'cluster-render': '0.1.0', 'mgu-deploy': '0.7.0' },
    mguHmi: ['ID7'],
    uninstallable: true,
    keepRunning: true,
    activate: ['node', 'hook.js', 'activate'],
    deactivate: ['node', 'hook.js', 'deactivate'],
    files: [{ path: 'hook.js', mode: '0644' }],
    units: [{ name: 'fixture-tool.service', from: 'systemd/fixture-tool.service' }],
    restart: ['fixture-tool.service']
};

test('a tool artifact keeps the fields the deploy tool reads', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-rel-test-'));
    const dir = fixtureTool(root, FIXTURE);
    const out = buildArtifact(dir, path.join(root, 'out'));
    const m = JSON.parse(untgz(out)['component.json'].toString('utf8'));
    assert.deepStrictEqual(m.activate, FIXTURE.activate);
    assert.deepStrictEqual(m.deactivate, FIXTURE.deactivate);
    assert.deepStrictEqual(m.mguHmi, ['ID7']);
    assert.strictEqual(m.keepRunning, true);
    assert.strictEqual(m.requires, undefined, 'the catalog\'s');
    assert.strictEqual(m.uninstallable, undefined, 'the catalog\'s');
    assert.strictEqual(m.mguProvides, undefined, 'only fields the tool sets');
    assert.deepStrictEqual(m.files.map((f) => f.path), ['hook.js']);
});

test('a tool catalog entry carries requires, mguHmi and uninstallable; the catalog check accepts it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-rel-test-'));
    fs.mkdirSync(path.join(root, 'apps'));
    fixtureTool(root, FIXTURE);
    const c = components(root).find((x) => x.id === 'fixture-tool');
    const artifact = buildArtifact(path.join(root, 'native', 'fixture-tool'), path.join(root, 'out'));
    const entry = catalogEntry(c, artifact);
    assert.deepStrictEqual(entry.requires, FIXTURE.requires);
    assert.deepStrictEqual(entry.mguHmi, ['ID7']);
    assert.strictEqual(entry.uninstallable, true);
    const parsed = catalog.parse(JSON.stringify({ schema: 2, components: [entry] }));
    assert.deepStrictEqual(parsed.components[0].requires, FIXTURE.requires);
});

test('a malformed requires, mguHmi or uninstallable is refused', () => {
    [{ requires: { 'cluster-render': '0.1' } }, { requires: ['cluster-render'] }, { mguHmi: ['ID9'] }, { mguHmi: [] }, { uninstallable: 'yes' }]
        .forEach((bad) => {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-rel-test-'));
            fs.mkdirSync(path.join(root, 'apps'));
            fixtureTool(root, Object.assign({}, FIXTURE, bad));
            assert.throws(() => components(root), /requires|mguHmi|uninstallable/, JSON.stringify(bad));
        });
});

test('the build tree holds a submodule at its recorded commit; one its checkout lacks is an error', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-rel-test-'));
    const g = (cwd, args) => cp.execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false']
        .concat(args), { cwd, encoding: 'utf8' }).trim();
    const sub = path.join(root, 'sub');
    fs.mkdirSync(sub);
    g(sub, ['init', '-q']);
    g(sub, ['config', 'core.autocrlf', 'false']);
    fs.writeFileSync(path.join(sub, 'lib.txt'), 'one\n');
    g(sub, ['add', 'lib.txt']);
    g(sub, ['commit', '-q', '-m', 'one']);
    const one = g(sub, ['rev-parse', 'HEAD']);
    const main = path.join(root, 'main');
    fs.mkdirSync(main);
    g(main, ['init', '-q']);
    g(main, ['config', 'core.autocrlf', 'false']);
    fs.writeFileSync(path.join(main, 'a.txt'), 'a\n');
    g(main, ['add', 'a.txt']);
    g(main, ['update-index', '--add', '--cacheinfo', `160000,${one},third_party/lib`]);
    g(main, ['commit', '-q', '-m', 'main']);
    fs.mkdirSync(path.join(main, 'third_party'));
    fs.renameSync(sub, path.join(main, 'third_party', 'lib'));
    // the checkout moves on: HEAD's commit is what is built
    fs.writeFileSync(path.join(main, 'third_party', 'lib', 'lib.txt'), 'two\n');
    g(path.join(main, 'third_party', 'lib'), ['commit', '-q', '-am', 'two']);
    const dir = exportHead(main);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'a\n');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'third_party', 'lib', 'lib.txt'), 'utf8'), 'one\n');
    g(main, ['update-index', '--cacheinfo', `160000,${'1'.repeat(40)},third_party/lib`]);
    g(main, ['commit', '-q', '-m', 'a commit the checkout lacks']);
    assert.throws(() => exportHead(main), /git archive 1{40} in third_party[\\/]lib failed/);
});

test('the ViceCluster chain: app -> vicecluster -> the deploy tool, cluster-render, mgu-python and mgu-render', () => {
    const all = components();
    const byId = (id) => all.find((c) => c.id === id);
    const app = byId('vicecluster_app');
    const tool = byId('vicecluster');
    assert.ok(app && tool, 'both are releasable');
    assert.deepStrictEqual(app.mguHmi, ['ID7']);
    assert.deepStrictEqual(Object.keys(app.requires), ['vicecluster']);
    assert.ok(catalog.compareVersions(tool.version, app.requires['vicecluster']) >= 0,
        'the tool meets the app\'s requirement');
    assert.deepStrictEqual(Object.keys(tool.requires), ['mgu-deploy', 'mgu-python', 'mgu-render', 'cluster-render'],
        'the deploy tool installs first');
    assert.deepStrictEqual(tool.mguHmi, ['ID7']);
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'native', 'vicecluster', 'component.json'), 'utf8'));
    // the tool brings its own unit and is restarted with it
    assert.deepStrictEqual(c.units, [{ name: 'vicecluster.service', from: 'systemd/vicecluster.service' }]);
    assert.deepStrictEqual(c.enable, [{ unit: 'vicecluster.service', target: 'multi-user.target' }]);
    assert.deepStrictEqual(c.recmgr, ['vicecluster']);
    assert.deepStrictEqual(c.restart, ['vicecluster.service']);
    // the built theme art and strip and picker previews ship
    assert.ok(c.files.some((f) => f.path === 'vice1.theme.json'), 'the built theme ships');
    assert.ok(c.files.some((f) => f.path === 'vice1.art.tiles.gz'), 'the built strip ships');
    assert.ok(c.files.some((f) => f.path === 'picker.vice1.png'), 'the picker previews ship');
    assert.strictEqual(app.uninstallable, true);
    assert.strictEqual(tool.uninstallable, true);
});

test('ViceCluster has its own app UUIDs, service, settings and control socket', () => {
    const root = path.join(__dirname, '..', '..');
    const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
    const app = components().find((c) => c.id === 'vicecluster_app');
    const tool = components().find((c) => c.id === 'vicecluster');
    assert.ok(catalog.compareVersions(tool.version, app.requires.vicecluster) >= 0,
        'a compatible tool-only patch does not require republishing the app');
    const ui = JSON.parse(read(`${app.dir}/vicecluster_app@${app.version}/rhmiData/application.json`)).application;
    assert.strictEqual(ui.name, app.id);
    assert.strictEqual(ui.entryPoints[0].name, app.id);
    const oldUuids = [
        '4047513b-98fe-4899-8e0b-cb7e8b3cf853', '61297206-61a7-4813-b020-1d137d41c971',
        'd0ec791d-6cd2-42b6-a90a-20616382eb2e', 'f58c67de-d564-4648-9efc-e5084f023b9c'
    ];
    const uuids = [ui.uuid, ui.stringBundleUuid, ui.resourceBundleUuid, ui.entryPoints[0].uuid];
    assert.strictEqual(new Set(uuids).size, uuids.length);
    uuids.forEach((uuid) => {
        assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid));
        assert(!oldUuids.includes(uuid), 'no global UUID shared with the original app');
    });
    const server = read('native/vicecluster/src/server.js');
    assert(server.includes("'/var/opt/vicecluster/state'"));
    assert(server.includes("enabled: false"), 'a fresh install does not activate another theme');
    assert(server.includes("new ClusterRender('vicecluster'"));
    assert(server.includes("app: 'vicecluster_app'"), 'control permissions belong to our app');
    ['native/vicecluster/src/control.js', 'apps/vicecluster_app/src/cluster_control.js'].forEach((rel) => {
        assert(read(rel).includes("'/dev/shm/vicecluster/ctl.sock'"));
        assert(!/vizualyse[-_]cluster/.test(read(rel)));
    });
    assert(read('native/vicecluster/src/picker.js').includes("const NAME = 'vicecluster_app'"));
    const unit = read('native/vicecluster/systemd/vicecluster.service');
    assert(unit.includes('/var/opt/vicecluster/current/server.js'));
    assert(!unit.includes('vizualyse-cluster.service'), 'no automatic stop of the original tool');
});

let failed = 0;
tests.forEach((t) => {
    try {
        t.fn();
        console.log(`ok   ${t.name}`);
    } catch (e) {
        failed++;
        console.log(`FAIL ${t.name}\n     ${e && e.stack}`);
    }
});
console.log(`${tests.length - failed}/${tests.length} passed`);
process.exitCode = failed ? 1 : 0;
