#!/usr/bin/env python3
"""TEKSI-MD image backend: Pillow-based stand-in for the sharp subset we use.

Reads a JSON payload from stdin, processes an image, writes the result to the
requested output path, and writes <output>.json with width/height/format info.
"""
import sys
import os
import re
import json
import html

try:
    from PIL import Image, ImageOps, ImageDraw, ImageFont
except ImportError:
    sys.stderr.write(
        "Pillow is not installed. On Termux run: pkg install python pillow\n"
    )
    sys.exit(2)


def parse_color(value):
    """Accept '#rrggbb', '#rgb', 'rgb(r,g,b)', or a few common names."""
    if value is None:
        return (0, 0, 0, 0)
    value = str(value).strip()
    named = {
        "white": (255, 255, 255, 255),
        "black": (0, 0, 0, 255),
        "transparent": (0, 0, 0, 0),
        "none": (0, 0, 0, 0),
    }
    if value.lower() in named:
        return named[value.lower()]
    if isinstance(value, dict):
        return (
            int(value.get("r", 0)),
            int(value.get("g", 0)),
            int(value.get("b", 0)),
            int(value.get("alpha", 255)),
        )
    if value.startswith("#"):
        hexpart = value[1:]
        if len(hexpart) == 3:
            hexpart = "".join(c * 2 for c in hexpart)
        if len(hexpart) >= 6:
            r = int(hexpart[0:2], 16)
            g = int(hexpart[2:4], 16)
            b = int(hexpart[4:6], 16)
            a = int(hexpart[6:8], 16) if len(hexpart) >= 8 else 255
            return (r, g, b, a)
    m_snip = re.match(r"rgba?\(([^)]+)\)", value)
    if m_snip:
        parts = [p.strip() for p in m_snip.group(1).split(",")]
        nums = []
        for p in parts:
            try:
                nums.append(int(float(p.rstrip("%"))))
            except ValueError:
                nums.append(0)
        while len(nums) < 4:
            nums.append(255)
        return tuple(nums[:4])
    return (0, 0, 0, 255)


def load_font(size):
    size = max(8, int(size or 20))
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/data/data/com.termux/files/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/data/data/com.termux/files/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/system/fonts/Roboto-Regular.ttf",
        "/system/fonts/DroidSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def render_svg(raw):
    """Render the tiny subset of SVG that TEKSI-MD generates itself."""
    text = raw.decode("utf-8", "ignore")
    size_match = re.search(r"<svg[^>]*width=[\"'](\d+)[\"'][^>]*height=[\"'](\d+)[\"']", text)
    width = int(size_match.group(1)) if size_match else 512
    height = int(size_match.group(2)) if size_match else 512
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for rect in re.finditer(r"<rect([^>]*)/?>", text):
        tag = rect.group(1)
        fill_match = re.search(r"fill=[\"']([^\"']+)[\"']", tag)
        fill = parse_color(fill_match.group(1) if fill_match else "#000000")
        x_match = re.search(r"\bx=[\"'](-?\d+)[\"']", tag)
        y_match = re.search(r"\by=[\"'](-?\d+)[\"']", tag)
        w_match = re.search(r"\bwidth=[\"'](\d+)[\"']", tag)
        h_match = re.search(r"\bheight=[\"'](\d+)[\"']", tag)
        x = int(x_match.group(1)) if x_match else 0
        y = int(y_match.group(1)) if y_match else 0
        rw = int(w_match.group(1)) if w_match else width
        rh = int(h_match.group(1)) if h_match else height
        draw.rectangle([x, y, x + rw, y + rh], fill=fill)

    for node in re.finditer(r"<text([^>]*)>(.*?)</text>", text, re.S):
        attrs = node.group(1)
        content = html.unescape(re.sub(r"<[^>]+>", "", node.group(2)))
        x_match = re.search(r"\bx=[\"'](-?\d+)[\"']", attrs)
        y_match = re.search(r"\by=[\"'](-?\d+)[\"']", attrs)
        size_match = re.search(r"font-size=[\"'](\d+)[\"']", attrs)
        fill_match = re.search(r"fill=[\"']([^\"']+)[\"']", attrs)
        anchor_match = re.search(r"text-anchor=[\"']([^\"']+)[\"']", attrs)
        x = int(x_match.group(1)) if x_match else 0
        y = int(y_match.group(1)) if y_match else 0
        font = load_font(size_match.group(1) if size_match else 24)
        fill = parse_color(fill_match.group(1) if fill_match else "#ffffff")
        anchor = "mm" if anchor_match and anchor_match.group(1) == "middle" else "la"
        try:
            draw.text((x, y), content, font=font, fill=fill, anchor=anchor)
        except TypeError:
            draw.text((x, y), content, font=font, fill=fill)
    return img


def open_image(path):
    with open(path, "rb") as handle:
        raw = handle.read(512)
    if raw.lstrip()[:5].lower() == b"<?xml" or raw.lstrip()[:4].lower() == b"<svg":
        with open(path, "rb") as handle:
            return render_svg(handle.read())
    return Image.open(path)


def apply_resize(img, operation):
    target_w = operation.get("width")
    target_h = operation.get("height")
    if target_w is None:
        target_w = img.width
    if target_h is None:
        target_h = img.height
    target_w = max(1, int(target_w))
    target_h = max(1, int(target_h))

    if operation.get("withoutEnlargement") and target_w >= img.width and target_h >= img.height:
        return img

    fit = operation.get("fit", "cover")
    if fit == "cover":
        return ImageOps.fit(img, (target_w, target_h), method=Image.LANCZOS)
    if fit == "contain":
        background = parse_color(operation.get("background"))
        canvas = Image.new("RGBA", (target_w, target_h), background)
        layer = img.copy()
        layer.thumbnail((target_w, target_h), Image.LANCZOS)
        offset = ((target_w - layer.width) // 2, (target_h - layer.height) // 2)
        mask = layer if layer.mode == "RGBA" else None
        canvas.paste(layer, offset, mask)
        return canvas
    if fit == "inside":
        layer = img.copy()
        layer.thumbnail((target_w, target_h), Image.LANCZOS)
        return layer
    if fit == "outside":
        scale = max(target_w / img.width, target_h / img.height)
        return img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    return img.resize((target_w, target_h), Image.LANCZOS)


def main():
    payload = json.loads(sys.stdin.read())
    mode = payload.get("mode", "process")
    source = payload["input"]

    def load_source():
        if source.get("type") == "create":
            background = parse_color(source.get("background"))
            return Image.new("RGBA", (int(source["width"]), int(source["height"])), background)
        return open_image(source["path"])

    img = load_source()
    img = img.convert("RGBA")

    if mode == "metadata":
        print(json.dumps({
            "width": img.width,
            "height": img.height,
            "format": (img.format or "unknown").lower(),
        }))
        return

    for operation in payload.get("ops", []):
        kind = operation.get("op")
        if kind == "resize":
            img = apply_resize(img, operation)
        elif kind == "rotate":
            img = img.transpose(Image.Transpose.ROTATE_270)
        elif kind == "composite":
            for item in operation.get("items", []):
                layer = open_image(item["path"]).convert("RGBA")
                img.paste(layer, (int(item.get("left", 0)), int(item.get("top", 0))), layer)

    output = payload["output"]
    fmt = str(output.get("format", "PNG")).upper()
    save_kwargs = {"quality": max(1, min(100, int(output.get("quality", 90))))}
    to_save = img
    if fmt == "JPEG":
        to_save = img.convert("RGB")
    elif fmt == "WEBP":
        save_kwargs["method"] = 4
    to_save.save(output["path"], fmt, **save_kwargs)

    info = {
        "width": to_save.width,
        "height": to_save.height,
        "format": fmt.lower(),
        "size": os.path.getsize(output["path"]),
    }
    with open(output["path"] + ".json", "w") as handle:
        json.dump(info, handle)


if __name__ == "__main__":
    main()
