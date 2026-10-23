import numpy as np
from scipy import ndimage

PX_X, PX_Y = 1142 / 60, 838 / 44

def masks(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    return {
        'Golden Lions': (r > 170) & (g < 80) & (b < 60),
        'Scions of the Comet': (b > 140) & (r < 70) & (b - g > 60),
        'Heldenhain': (r < 45) & (g < 45) & (b < 45),
        'Sun Seekers': (r > 190) & (g > 140) & (b < 90) & (r - b > 120),
    }

def find_objectives(im):
    out = []
    for kind, m in masks(im).items():
        m = ndimage.binary_opening(m, iterations=3)
        m = ndimage.binary_closing(m, iterations=6)
        m = ndimage.binary_fill_holes(m)
        lab, n = ndimage.label(m)
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lab == i)
            area = len(xs)
            w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
            # a filled disc ~55-70px radius, roughly square bbox, mostly filled
            if area < 4000 or not (0.75 < w / h < 1.33) or area < 0.6 * w * h * np.pi / 4:
                continue
            cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
            out.append({'kind': kind, 'px': (cx, cy), 'r': (w + h) / 4,
                        'x': cx / PX_X, 'y': cy / PX_Y})
    return out
