# NASA Moon Trek Data Sources (Task p2-data)

Documentation and verification record for NASA Moon Trek WMTS tile services, polar projections, and South Pole layers. Focused on verified data for the Lunar Landing Site Navigator.

Checked: 2026-11-13.
Status tags:
- **V**: Verified (tested live against NASA Trek HTTP APIs or tile content)
- **D**: Derived (mathematically calculated from projection parameters)
- **U**: Unverified (provisional finding or behavior not independently validated)

---

## 1. WMTS Service Architecture

| Parameter | Verified Specification | Status |
|---|---|---|
| Protocol | OGC WMTS 1.0.0 (RESTful) | V |
| Tile URL Template | `https://trek.nasa.gov/tiles/Moon/SP/<LAYER_ID>/1.0.0/default/default028mm/{z}/{row}/{col}.png` | V |
| Tile Matrix Set | `default028mm` | V |
| Style Identifier | `default` | V |
| Tile Dimensions | 256 x 256 pixels | V |
| Image Encoding | PNG (8-bit for the inspected layers) | V |
| Access Constraints | Metadata states None | U |
| CORS Header | `access-control-allow-origin: *` (tested via browser console `fetch`) | V |
| Service Catalog API | `https://trek.nasa.gov/moon/TrekServices/ws/index/polar/listVisibleLayers?proj=urn:ogc:def:crs:IAU2000::30120&start=0&rows=500` | V |
| Metadata/Abstract URLs | `https://trek.nasa.gov/moon/TrekWS/rest/cat/...` | U |
| WMTS Capabilities XML | `https://trek.nasa.gov/tiles/Moon/SP/<LAYER_ID>/1.0.0/WMTSCapabilities.xml` | V |

---

## 2. Polar Stereographic Projection

Moon Trek South Pole datasets use a Moon-centered Polar Stereographic projection (IAU/IAG Moon 2000 sphere).

| Parameter | Specification | Status |
|---|---|---|
| Projection Name | Polar Stereographic | V |
| Official CRS URN | `urn:ogc:def:crs:IAU2000::30120` | V |
| Reference Body | Moon (IAU 2000) | V |
| Ellipsoid / Figure | Sphere, radius $R = 1,737,400\text{ m}$ | V |
| Flattening | 0.0 (strictly spherical reference) | V |
| Latitude of Origin ($\phi_0$) | $-90.0^\circ$ (South Pole) | V |
| Central Meridian ($\lambda_0$) | $0.0^\circ$ (Lunar Prime Meridian) | V |
| Scale Factor ($k$) | $1.0$ | D |
| False Easting / Northing | $0.0\text{ m}$ | V |
| Proj4 Definition | `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs` | D |

### Planar Coordinate Axes Orientation (Derived from bbox and lat/lon)
- **Origin $(0, 0)$**: South Pole (latitude $-90^\circ$).
- **$+Y$ Axis**: Points along the lunar Prime Meridian ($0^\circ$ longitude).
- **$+X$ Axis**: Points towards $+90^\circ\text{E}$ longitude (lunar east).
*(Status: D)*

---

## 3. Tile Matrix Set Geometry (`default028mm`)

NASA's WMTS Capabilities XML defines a 2:1 rectangular index space ($2^{z+1}$ columns $\times$ $2^z$ rows). Each tile is square ($256 \times 256$ px).

- **Top-Left Corner**: $(-1095930\text{ m}, 1095930\text{ m})$ (V)
- **Resolution Formula**: $8561.953125 / 2^z \text{ m/px}$ (D)
- **Tile Span ($T_z$)**: $2,191,860 / 2^z \text{ meters}$ (D)
- **Matrix Dimensions**: Width $= 2^{z+1}$, Height $= 2^z$ (V)

### Matrix Extent & Footprint
- **Full Extent**: Width $= 4,383,720\text{ m}$ ($x \in [-1095930, +3287790]$), Height $= 2,191,860\text{ m}$. (D)
- **Active Data**: Each layer has its own footprint. Polar caps (e.g., LOLA 87.5°S) are confined to the left square half $[-1095930, -1095930, 1095930, 1095930]$. Wider layers (Count 45°S) extend beyond the left half.

### Scale Hierarchy (z0 to z12)
*Note: This is a generic template. Each layer's max zoom must be set per its own published limits.*

| $z$ | Cols x Rows | Tile Span (m) | Resolution (m/px) | Scale Denominator |
|---|---|---|---|---|
| 0 | $2 \times 1$ | 2,191,860 | 8561.9531 | 30,578,404 |
| 1 | $4 \times 2$ | 1,095,930 | 4280.9766 | 15,289,202 |
| 2 | $8 \times 4$ | 547,965 | 2140.4883 | 7,644,601 |
| 3 | $16 \times 8$ | 273,983 | 1070.2441 | 3,822,301 |
| 4 | $32 \times 16$ | 136,991 | 535.1221 | 1,911,150 |
| 5 | $64 \times 32$ | 68,496 | 267.5610 | 955,575 |
| 6 | $128 \times 64$ | 34,248 | 133.7805 | 477,788 |
| 7 | $256 \times 128$ | 17,124 | 66.8903 | 238,894 |
| 8 | $512 \times 256$ | 8,562 | 33.4451 | 119,447 |
| 9 | $1024 \times 512$ | 4,281 | 16.7226 | **59,723** |
| 10 | $2048 \times 1024$ | 2,140 | 8.3613 | 29,862 |
| 11 | $4096 \times 2048$ | 1,070 | 4.1806 | 14,931 |
| 12 | $8192 \times 4096$ | 535 | 2.0903 | 7,465 |

### Pole Position
- **$z=0$**: Pole is inside Tile (0,0,0).
- **$z \ge 1$**: Pole is at the boundary between col/row $2^{z-1}-1$ and $2^{z-1}$.

---

## 4. Inspected South Pole Layers

| Layer Identifier | Coverage | Res. | Zooms | Accuracy & Attribution |
|---|---|---|---|---|
| `LRO_LOLA_Shade_SPolar875_10m` | 87.5°S–90°S | 10 m/px | 0–8 | LOLA estimates: 10–50 m expected horizontal, 1–10 m absolute vertical. |
| `LRO_LOLA_ClrShade_SPole875_5mp_v04` | 87.5°S–90°S | 5 m/px | 0–9 | LOLA estimates: 10–50 m expected horizontal, 1–10 m absolute vertical. |
| `LRO_NAC_Mosaic_86S356E_50cmp` | Malapert | 0.5 m/px | 0–12 | Horizontal RMS of the controlling DEM may be up to 20 m. (No vertical accuracy assessed for the image mosaic). |
| `LRO_NAC_Shade_86S356E_3mp` | Malapert | 3 m/px | 0–9 | NAC hillshade DEM estimates: up to 20 m horizontal RMS / up to 10 m vertical RMS. |
| `LRO_LOLA_Count_SPole45_100mp_v04` | 45°S–90°S | 100 m/px | 0–4 | Preliminary product. |

---

## 5. Findings & Evidence

### 5.1 Limitations
- Visual tiles do not deliver numeric elevation values (no horizon calculations possible from PNGs).
- Hillshade uses a fixed light source (az 315°, alt 45°); not real solar positions.
- Future terrain analysis requires verified numeric elevation datasets (units, nodata, datum, etc.).

### 5.2 Metadata Errors
1. `scale_factor = 0` in WKT. (V)
2. `WGS84BoundingBox` holds metres, not degrees. (V)
3. Swapped Row/Column Counts in LROC NAC Mosaic. (D)
4. `Column_Count` 7790 vs bbox extent 7990. (D)

### 5.3 Reproducible Probe Table
| Layer ID | z | row | col | HTTP | Content Check |
|---|---|---|---|---|---|
| `LRO_NAC_Shade_86S356E_3mp` | 9 | 227 | 253 | 200 OK | `image/png`, 60,718 bytes, non-blank |
| `LRO_NAC_Shade_86S356E_3mp` | 10 | 454 | 506 | 404 | Beyond max z9 |
| `LRO_LOLA_ClrShade_SPole875_5mp_v04` | 9 | 255 | 255 | 200 OK | `image/png`, 196,999 bytes, non-blank |
| `LRO_LOLA_Count_SPole45_100mp_v04` | 4 | 7 | 16 | 200 OK | `image/png`, non-blank |
| `LRO_LOLA_Count_SPole45_100mp_v04` | 5 | 0 | 0 | 404 | Beyond max z4 |
| `LRO_LOLA_Shade_SPolar875_10m` | 2 | 1 | 0 | 404 | Outside 75.8km radius |

---

## 6. OpenLayers Map Integration (Proposal for Sultan, Untested)

*Note: The source-specific `extent` must be applied at the layer level.*

```typescript
import Projection from 'ol/proj/Projection';
import WMTSTileGrid from 'ol/tilegrid/WMTS';

export const MOON_SOUTH_POLE_PROJ = new Projection({
  code: 'urn:ogc:def:crs:IAU2000::30120',
  units: 'm',
});

const RESOLUTIONS = Array.from({ length: 13 }, (_, z) => 8561.953125 / Math.pow(2, z));
const MATRIX_SIZES = RESOLUTIONS.map((_, z) => [Math.pow(2, z + 1), Math.pow(2, z)]);

export const MOON_SOUTH_POLE_TILE_GRID = new WMTSTileGrid({
  origin: [-1095930, 1095930],
  extent: [-1095930, -1095930, 3287790, 1095930],
  resolutions: RESOLUTIONS,
  matrixIds: RESOLUTIONS.map((_, z) => String(z)),
  sizes: MATRIX_SIZES,
  tileSize: [256, 256],
});
