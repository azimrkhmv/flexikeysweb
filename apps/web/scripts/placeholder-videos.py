#!/usr/bin/env python3
"""Make the placeholder video of every exercise in Uzbek, Russian and English (TASKS.md C7).

A 4-second silent clip: the exercise name, the Home Kit tool it needs and the words "placeholder video". Used until
the real videos are made and approved (C4, C5): the demo plays them, and test servers load them with
`uv run python -m app.cli load-placeholder-videos`. Production refuses them.

Writes public/placeholder-videos/<exercise>.<lang>.mp4 (about 8 KB each) from src/content/backend/exercises.json and
the tool names in src/messages/intake.ts. Needs ffmpeg and Pillow. Run after the exercise list changes:

    uvx --with pillow python scripts/placeholder-videos.py [font.ttf]
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "public" / "placeholder-videos"
FONT = sys.argv[1] if len(sys.argv) > 1 else "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
LANGS = ("uz", "ru", "en")
NOTE = {"uz": "Sinov videosi", "ru": "Видео-заглушка", "en": "Placeholder video"}
SIZE = (640, 360)


def tool_names() -> dict[str, dict[str, str]]:
    """{lang: {tool: name}} from the message blocks of src/messages/intake.ts (en, uz, ru in that order)."""
    text = (WEB / "src/messages/intake.ts").read_text("utf-8")
    blocks = re.split(r"^  (en|uz|ru): \{$", text, flags=re.M)[1:]
    return {
        lang: dict(re.findall(r'^\s+"tool\.(\w+)": "(.*)",$', body, flags=re.M))
        for lang, body in zip(blocks[::2], blocks[1::2], strict=True)
    }


def frame(path: Path, lines: list[str]) -> None:
    img = Image.new("RGB", SIZE, (31, 111, 120))
    draw = ImageDraw.Draw(img)
    big, small = ImageFont.truetype(FONT, 34), ImageFont.truetype(FONT, 22)
    y = 110
    for i, line in enumerate(lines):
        font = big if i == 0 else small
        draw.text(((SIZE[0] - draw.textlength(line, font=font)) / 2, y), line, font=font, fill="white")
        y += 56 if i == 0 else 34
    img.save(path)


def main() -> None:
    exercises = json.loads((WEB / "src/content/backend/exercises.json").read_text("utf-8"))["exercises"]
    tools = tool_names()
    uses = {"uz": "Kerak: {}", "ru": "Нужно: {}", "en": "Uses: {}"}
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "frame.png"
        for ex in exercises:
            for lang in LANGS:
                lines = [ex["title"][lang]]
                if ex["tool"]:
                    lines.append(uses[lang].format(tools[lang][ex["tool"]]))
                lines.append(NOTE[lang])
                frame(png, lines)
                subprocess.run(
                    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "1", "-t", "4",
                     "-i", str(png), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-tune", "stillimage", "-crf", "30",
                     "-r", "10", "-movflags", "+faststart", "-an", str(OUT / f"{ex['id']}.{lang}.mp4")],
                    check=True,
                )
    print(f"{len(exercises) * len(LANGS)} placeholder videos in {OUT.relative_to(WEB)}")


if __name__ == "__main__":
    main()
