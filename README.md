# Cluster themes

Whole-cluster themes for the BMW iDrive 7 head unit (MGU): 17 themes drawn on
the instrument cluster through cluster-render's `panel` target, under the
car's own warning lights, and a touch picker of them on the central screen.
Installed from the [mgu Store](https://github.com/robertnisipeanu/mgu-store).

The nine families: eight of them a Sport and a Comfort theme switched by the
car's drive mode (G20 inspired 1 and 2, LCI inspired 1 and 2, Three-dial 1
and 2, Performance 1 and 2), and GTA VI Bucharest in Sport alone.

This repository holds the tool, its iDrive app and the release tooling only:
everything the two need is here, and the Store reads its catalog from this
repository's GitHub Releases (`release/README.md`).

| Path | |
|---|---|
| [`native/vizualyse-cluster`](native/vizualyse-cluster) | **Cluster themes**, the tool: the themes' shaders and their textures, drawn on the cluster through cluster-render's panel, and the picker's view ([how a theme is drawn](native/vizualyse-cluster/THEMES.md)) |
| [`apps/vizualyse_cluster`](apps/vizualyse_cluster) | **Cluster themes**, its iDrive app: Choose with a preview of every theme, Use, a 10 s Try on the cluster while parked, Sport or Comfort, on/off |
| [`platform`](platform) | the code the two share (the cluster-render client, the car's speed), versioned; each component pins the version it builds with |
| [`release`](release) | builds and publishes this repository's catalog |
| `tools` | `oap_pack.js`, `oap_link.js`: pack the app |

## Install

In the Store, add this repository as a GitHub source on the **Releases**
channel and install **Cluster themes**. It requires, from their own sources:
`mgu-deploy`, `mgu-python` and `mgu-render` (mgu-store) and `cluster-render`
([robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps)).

## Build and test

```sh
node platform/platform.js sync          # after a checkout: each component's copies of its platform modules
node release/test/release_test.js       # the release tooling
node native/vizualyse-cluster/test/shader_lint.js
node native/vizualyse-cluster/test/themes_test.js
node native/vizualyse-cluster/test/tool_test.js
node native/vizualyse-cluster/test/picker_test.js

node release/release.js list            # versions and publish state
node release/release.js check           # build twice, compare byte for byte
node release/release.js build           # artifacts and catalog.json into release/out/
node release/release.js publish --dry-run
```

To draw a theme off the car: `node native/vizualyse-cluster/tools/preview_shot.js
<id> <seconds> <out.png>` (a PNG from headless Chrome; it needs a Chrome or an
Edge on the machine).

## Publish

`Release` (`.github/workflows/release.yml`) builds each component, uploads the
artifact as the release `<id>@<version>` and publishes the release `catalog`
with the `catalog.json` the Store reads. Run it by hand with the component ids
(empty publishes every one), or push a `v*` tag. It needs no secrets: the
workflow's own `GITHUB_TOKEN` writes the releases.

## Licence

GPL-3.0-or-later ([LICENSE](LICENSE); `LICENSES/` for the parts under
another licence, `native/vizualyse-cluster/THIRD-PARTY.md` for the fonts and
typefaces).

The cluster themes are the work of the
[Vizualyse idrive-apps](https://github.com/Vizualyse/idrive-apps) project
(Copyright (C) 2026 Robert Nisipeanu and Yousaf Khan, GPL-3.0-or-later),
copied here as a repository of its own so that it can be built and published
without that repository. The files keep their copyright and licence headers.
