"""Build the shared Wanted, CSL wheel and launch smoke glyph atlas source."""
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 RNZALI
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(os.environ.get("TEMP", "/tmp")) / "vice1-fonttools"))
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

assets = Path(__file__).resolve().parents[1] / "themes" / "vice1" / "assets"
builder = FontBuilder(1000, isTTF=True)
wheels = ["front" + str(i) for i in range(8)] + ["rear" + str(i) for i in range(8)]
clouds = ["smoke" + str(i) for i in range(4)]
names = [".notdef", "space", "hyphen", "star"] + wheels + clouds
builder.setupGlyphOrder(names)
cmap = {32: "space", 45: "hyphen", 42: "star"}
cmap.update({ord("a") + i: "front" + str(i) for i in range(8)})
cmap.update({ord("A") + i: "rear" + str(i) for i in range(8)})
cmap.update({ord("i") + i: "smoke" + str(i) for i in range(4)})
builder.setupCharacterMap(cmap)
glyphs = {}


def contour(pen, points):
    pen.moveTo(points[0])
    for point in points[1:]:
        pen.lineTo(point)
    pen.closePath()


for name in names:
    pen = TTGlyphPen(None)
    if name == "star":
        points = []
        for i in range(10):
            angle = math.pi / 2 + i * math.pi / 5
            radius = 520 if i % 2 == 0 else 235
            points.append((round(700 + radius * math.cos(angle)),
                           round(350 + radius * math.sin(angle))))
        contour(pen, points)
    elif name in wheels:
        rear = name.startswith("rear")
        frame = int(name[-1])
        cx, cy = (425, 500) if rear else (400, 500)
        rx, ry = (350, 975) if rear else (260, 725)

        def point(radius, angle):
            return (round(cx + rx * radius * math.cos(angle)),
                    round(cy + ry * radius * math.sin(angle)))

        contour(pen, [point(1, i * 2 * math.pi / 72) for i in range(72)])
        contour(pen, [point(.955, -i * 2 * math.pi / 72) for i in range(72)])
        contour(pen, [point(.16, i * 2 * math.pi / 24) for i in range(24)])
        contour(pen, [point(.08, -i * 2 * math.pi / 24) for i in range(24)])
        phase = frame * 2 * math.pi / 64
        for spoke in range(8):
            a = phase + spoke * 2 * math.pi / 8
            contour(pen, [point(.19, a - .06), point(.49, a - .05),
                          point(.955, a - .14), point(.955, a - .10),
                          point(.58, a), point(.955, a + .10),
                          point(.955, a + .14), point(.49, a + .05),
                          point(.19, a + .06)])
    elif name in clouds:
        frame = int(name[-1])
        radius = 320 + frame * 110
        points = []
        for i in range(144):
            a = i * 2 * math.pi / 144
            r = radius * (1 + .11 * math.sin(6 * a + frame * .5)
                          + .055 * math.sin(11 * a))
            points.append((round(900 + r * math.cos(a)),
                           round(550 + r * .85 * math.sin(a))))
        contour(pen, points)
    glyphs[name] = pen.glyph()

builder.setupGlyf(glyphs)
metrics = {name: (1400, 205 if name == "star" else 0) for name in glyphs}
metrics.update({name: (850 if name.startswith("rear") else 800,
                      75 if name.startswith("rear") else 140) for name in wheels})
metrics.update({name: (1800, glyphs[name].xMin) for name in clouds})
builder.setupHorizontalMetrics(metrics)
builder.setupHorizontalHeader(ascent=1500, descent=-500)
builder.setupOS2(sTypoAscender=1500, sTypoDescender=-500, usWinAscent=1500,
                usWinDescent=500, usWeightClass=500)
builder.setupNameTable({
    "familyName": "Vice Wanted", "styleName": "Medium",
    "uniqueFontIdentifier": "RNZALI-ViceWanted-2026",
    "fullName": "Vice Wanted Medium", "psName": "ViceWanted-Medium",
    "copyright": "Copyright 2026 RNZALI. GPL-3.0-or-later.",
})
builder.setupPost()
builder.setupMaxp()
builder.save(str(assets / "wanted-stars.ttf"))
print("Built Wanted stars, CSL wheels and smoke frames")
