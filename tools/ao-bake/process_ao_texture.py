"""Turn a raw grayscale AO bake into a shadow-decal texture: black RGB, alpha
= occlusion. Plain alpha-over compositing of that against a transparent
canvas fakes a multiply against whatever CSS background sits behind it -
real GL multiply blending can't see that background, since the canvas clears
to transparent, not the page color.

Usage: python3 process_ao_texture.py <raw_ao.png> <out.png> [--intensity 0.7] [--no-flip]
"""
import sys
import argparse
import numpy as np
from PIL import Image


def process(src_path, out_path, intensity, flip_v):
    img = Image.open(src_path).convert("RGBA")
    arr = np.array(img).astype(float) / 255.0
    ao = arr[..., 0]  # grayscale AO baked into RGB, all channels equal

    alpha = np.clip((1.0 - ao) * intensity, 0.0, 1.0)
    out = np.zeros_like(arr)
    out[..., 3] = alpha
    out_img = Image.fromarray((out * 255).astype(np.uint8), mode="RGBA")

    # Empirically required with this Blender/exporter combo - the baked
    # texture came out mirrored front-to-back against the model until
    # flipped. Root cause not fully nailed down (Blender's UV V=0-at-bottom
    # vs glTF's V=0-at-top convention is the prime suspect); if this stops
    # being necessary after a Blender/exporter version change, verify by
    # orbiting the live scene (see the WASD debug controls note in the repo)
    # before dropping this flip
    if flip_v:
        out_img = out_img.transpose(Image.FLIP_TOP_BOTTOM)

    out_img.save(out_path)

    print(f"saved {out_path}")
    print(f"alpha stats: min={alpha.min():.4f} max={alpha.max():.4f} mean={alpha.mean():.4f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("src", help="raw grayscale AO png from bake_ground_ao.py")
    parser.add_argument("out", help="output shadow-decal png")
    parser.add_argument("--intensity", type=float, default=0.7, help="max shadow opacity, 0-1")
    parser.add_argument("--no-flip", dest="flip_v", action="store_false")
    args = parser.parse_args()
    process(args.src, args.out, args.intensity, args.flip_v)
