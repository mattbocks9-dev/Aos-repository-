import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy.signal import fftconvolve
from scipy import ndimage

def load(path):
    return np.array(Image.open(path).convert('RGB')).astype(float)

def rim_mask(im):
    r,g,b = im[...,0], im[...,1], im[...,2]
    # brass/gold rim: warm, fairly bright, green close to red, blue clearly lower
    return ((r > 95) & (g > 0.72*r) & (b < 0.72*r) & (r - b > 35)).astype(float)

def ring(rad, w=2.5):
    n = int(rad + w + 2)
    y, x = np.mgrid[-n:n+1, -n:n+1]
    d = np.hypot(x, y)
    k = (np.abs(d - rad) <= w).astype(float)
    return k / k.sum()

def circles(im, radii, thresh):
    m = rim_mask(im)
    found = []
    for rad in radii:
        score = fftconvolve(m, ring(rad), mode='same')
        peaks = (score == ndimage.maximum_filter(score, size=int(rad))) & (score > thresh)
        for y, x in zip(*np.nonzero(peaks)):
            found.append((score[y, x], x, y, rad))
    found.sort(reverse=True)
    keep = []
    for s, x, y, rad in found:
        if all(np.hypot(x - kx, y - ky) > 0.6 * max(rad, kr) for _, kx, ky, kr in keep):
            keep.append((s, x, y, rad))
    return keep

if __name__ == '__main__':
    path = sys.argv[1]
    im = load(path)
    cs = circles(im, range(36, 76, 2), float(sys.argv[2]) if len(sys.argv) > 2 else 0.5)
    vis = Image.open(path).convert('RGB'); d = ImageDraw.Draw(vis)
    for s, x, y, rad in cs:
        d.ellipse([x-rad, y-rad, x+rad, y+rad], outline=(0,255,0), width=3)
        d.text((x-10, y), f'{s:.2f}/{rad}', fill=(0,255,0))
        print(f'{x:5d} {y:5d} r={rad} score={s:.2f}  -> ({x/19.033:.1f}", {y/19.045:.1f}")')
    vis.save(sys.argv[3] if len(sys.argv) > 3 else 'vis.png')
