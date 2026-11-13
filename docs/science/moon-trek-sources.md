# NASA Moon Trek Data Sources (Task p2-data)

Documentation and verification record for NASA Moon Trek WMTS tile services, polar projections, tile matrices, and South Pole layers for the Lunar Landing Site Navigator.

Checked: 2026-11-13.
Status tags:
- **V**: Verified (tested live against NASA Trek HTTP APIs, XML responses, FGDC metadata, or tile content)
- **D**: Derived (mathematically calculated from projection parameters and tile grid geometry)
- **V/D**: Combined (direct metadata observation compared against derived mathematical calculation)
- **U**: Unverified (provisional finding or service behavior not independently validated)

---

## 1. WMTS Service Architecture

NASA Solar System Treks publishes lunar tile services via the OGC Web Map Tile Service (WMTS) 1.0.0 RESTful interface.

| Parameter | Verified Specification | Status |
|---|---|---|
| Protocol | OGC WMTS 1.0.0 (RESTful) | V |
| Tile URL Template | `https://trek.nasa.gov/tiles/Moon/SP/<LAYER_ID>/1.0.0/default/default028mm/{z}/{row}/{col}.png` | V |
| Tile Matrix Set | `default028mm` | V |
| Style Identifier | `default` | V |
| Tile Dimensions | 256 x 256 pixels (`<TileWidth>256</TileWidth>`, `<TileHeight>256</TileHeight>` in service XML) | V |
| Image Encoding | PNG (8-bit grayscale / RGB for all South Pole WMTS services) | V |
| CORS Header | `access-control-allow-origin: *` | V |
| CORS Verification | `curl -I -H "Origin: https://example.com" https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Shade_86S356E_3mp/1.0.0/default/default028mm/9/227/253.png` returned `access-control-allow-origin: *` (verified 2026-11-13) | V |
| Access Constraints | Metadata states None; public domain NASA data | U |
| Rate Limits | None documented by NASA JPL Trek Services; no rate limiting observed during automated checks | U |
| Service Catalog API | `https://trek.nasa.gov/moon/TrekServices/ws/index/polar/listVisibleLayers?proj=urn:ogc:def:crs:IAU2000::30120&start=0&rows=500` (347 entries retrieved) | V |
| Metadata Service URL | `https://trek.nasa.gov/moon/TrekWS/rest/cat/metadata/fgdc/html?label=<LAYER_ID>` | V |
| Abstract Service URL | `https://trek.nasa.gov/moon/TrekWS/rest/cat/abstract?label=<LAYER_ID>` | V |
| WMTS Capabilities XML | `https://trek.nasa.gov/tiles/Moon/SP/<LAYER_ID>/1.0.0/WMTSCapabilities.xml` | V |

---

## 2. Polar Stereographic Projection Specification

Moon Trek South Pole datasets use a Moon-centered Polar Stereographic projection based on the IAU/IAG Moon 2000 geodetic reference sphere.

| Parameter | Specification | Status |
|---|---|---|
| Projection Name | Polar Stereographic | V |
| Official CRS URN | `urn:ogc:def:crs:IAU2000::30120` | V |
| Reference Body | Moon (IAU 2000) | V |
| Ellipsoid / Figure | Sphere, radius $R = 1,737,400\text{ m}$ ($1737.4\text{ km}$) | V |
| Flattening | 0.0 (strictly spherical reference) | V |
| Latitude of Origin ($\phi_0$) | $-90.0^\circ$ (South Pole) | V |
| Central Meridian ($\lambda_0$) | $0.0^\circ$ (Lunar Prime Meridian) | V |
| Standard Parallel ($\phi_{ts}$) | $-90.0^\circ$ (Metadata specifies standard parallel at $-90^\circ$, supporting scale factor $k = 1.0$) | V |
| Scale Factor ($k$) | $1.0$ (Derived from standard parallel $\phi_{ts} = -90^\circ$; coordinate reference tests required to confirm client implementation) | D |
| False Easting ($x_0$) | $0.0\text{ m}$ | V |
| False Northing ($y_0$) | $0.0\text{ m}$ | V |
| Linear Units | meters | V |
| Proj4 Definition | `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs` | D |

### Planar Coordinate Axes Orientation

- **Origin $(0, 0)$**: Located at the lunar South Pole (latitude $-90^\circ$).
- **$+Y$ Axis**: Points along the lunar Prime Meridian ($0^\circ$ longitude, towards Earth-facing sub-Earth point).
- **$-Y$ Axis**: Points along the lunar far-side meridian ($180^\circ$ longitude).
- **$+X$ Axis**: Points towards $+90^\circ\text{E}$ longitude (lunar east).
- **$-X$ Axis**: Points towards $-90^\circ\text{W}$ ($270^\circ\text{E}$) longitude (lunar west).

---

## 3. Tile Matrix Set Geometry (`default028mm`)

NASA Moon Trek's WMTS Capabilities XML defines a 2:1 rectangular index space of $2^{z+1}\text{ columns} \times 2^z\text{ rows}$. Each individual tile is square ($256 \times 256$ pixels), meaning horizontal and vertical tile spans are identical.

### Grid Parameters

- **Top-Left Corner**: $(-1095930\text{ m}, 1095930\text{ m})$. (V, read from `<TopLeftCorner>` in XML)
- **Matrix Dimensions at Zoom $z$**: $\text{MatrixWidth} = 2^{z+1}\text{ columns}$, $\text{MatrixHeight} = 2^z\text{ rows}$. (V, read from `<MatrixWidth>` and `<MatrixHeight>` in XML)
- **Individual Tile Dimension**: $256 \times 256$ pixels (square tile). (V, read from `<TileWidth>` and `<TileHeight>`)
- **OGC Standard Pixel Pitch**: $0.28\text{ mm}$ ($0.00028\text{ m}$). (V)
- **Resolution Formula**: $\text{m/px} = \text{ScaleDenominator} \times 0.00028 = \frac{8561.953125}{2^z}\text{ m/px}$. (V, `<ScaleDenominator>` at z0 is $3.0578404017857101 \times 10^7$)
- **Tile Physical Span ($T_z$)**: In both X and Y directions, each tile covers $T_z = 256 \times \text{m/px} = \frac{2,191,860}{2^z}\text{ meters}$. (D)
- **Full WMTS Matrix Extent**: 
  - Width: $2^{z+1} \times T_z = 2 \times 2,191,860 = 4,383,720\text{ m}$ ($x \in [-1095930\text{ m}, +3287790\text{ m}]$).
  - Height: $2^z \times T_z = 2,191,860\text{ m}$ ($y \in [-1095930\text{ m}, +1095930\text{ m}]$).
- **Active Polar Data Footprint**: 
  The full WMTS matrix spans the 2:1 rectangular extent. However, **each raster layer has its own documented footprint**. For layers confined to the immediate polar cap (e.g. LOLA $87.5^\circ\text{S}$), active data is restricted to the square left-hand half $[-1095930, -1095930, 1095930, 1095930]\text{ m}$ ($2,191,860\text{ m} \times 2,191,860\text{ m}$ centered on the pole). For wider-swath datasets like LOLA Count $45^\circ\text{S}$, active imagery extends into column indices beyond $2^z$. Do not infer a layer's coverage mask from the matrix extent; always use the layer's specific published bounding box.

### Scale and Resolution Hierarchy (z0 to z12)

*Note: Each raster uses its own published maximum zoom; the z0-z12 stack below is a generic template. Application integrations must truncate to each source's published max.*

| Zoom Level $z$ | Matrix Dimensions (Cols x Rows) | Tile Span $T_z$ (m) | Resolution (m/px) | Scale Denominator |
|---|---|---|---|---|
| 0 | $2 \times 1$ | $2,191,860$ | $8561.9531$ | $30,578,404$ |
| 1 | $4 \times 2$ | $1,095,930$ | $4280.9766$ | $15,289,202$ |
| 2 | $8 \times 4$ | $547,965$ | $2140.4883$ | $7,644,601$ |
| 3 | $16 \times 8$ | $273,983$ | $1070.2441$ | $3,822,301$ |
| 4 | $32 \times 16$ | $136,991$ | $535.1221$ | $1,911,150$ |
| 5 | $64 \times 32$ | $68,496$ | $267.5610$ | $955,575$ |
| 6 | $128 \times 64$ | $34,248$ | $133.7805$ | $477,788$ |
| 7 | $256 \times 128$ | $17,124$ | $66.8903$ | $238,894$ |
| 8 | $512 \times 256$ | $8,562$ | $33.4451$ | $119,447$ |
| 9 | $1024 \times 512$ | $4,281$ | $16.7226$ | $59,724$ |
| 10 | $2048 \times 1024$ | $2,140$ | $8.3613$ | $29,862$ |
| 11 | $4096 \times 2048$ | $1,070$ | $4.1806$ | $14,931$ |
| 12 | $8192 \times 4096$ | $535$ | $2.0903$ | $7,465$ |

### Tile Coordinate Bounds Formula

Because each tile is physically square with span $T_z$ in both horizontal and vertical directions, the spatial coordinates of tile $(z, \text{row}, \text{col})$ with $0 \le \text{row} < 2^z$ and $0 \le \text{col} < 2^{z+1}$ are:

$$\begin{aligned}
x_{\min} &= -1095930 + \text{col} \times T_z \\
x_{\max} &= -1095930 + (\text{col} + 1) \times T_z \\
y_{\max} &= 1095930 - \text{row} \times T_z \\
y_{\min} &= 1095930 - (\text{row} + 1) \times T_z
\end{aligned}$$

### Position of the Lunar South Pole $(0, 0)$

The South Pole coordinate origin $(x=0, y=0)$ is situated at distance $1,095,930\text{ m}$ eastward from the grid left edge ($-1095930$) and $1,095,930\text{ m}$ southward from the grid top edge ($+1095930$):

- **At zoom $z = 0$**: The South Pole lies inside Tile $(z=0, \text{row}=0, \text{col}=0)$ at local tile offset from the top-left corner: $(x = 1095930\text{ m}, y = 1095930\text{ m})$.
- **For zoom $z \ge 1$**: Since distance $1,095,930\text{ m} = \frac{1}{2} \times 2,191,860 = 2^{z-1} \times T_z$, the pole $(x=0, y=0)$ lies exactly at column index $2^{z-1}$ and row index $2^{z-1}$, which is the boundary intersection between column $2^{z-1}-1$ / $2^{z-1}$ and row $2^{z-1}-1$ / $2^{z-1}$.

---

## 4. Inspected South Pole Layers

The NASA Moon Trek South Pole catalog was queried via the catalog API, identifying 347 total polar entries. The following representative layers were examined in detail:

| Layer Identifier | Content Description | Geographic Coverage | Source Resolution | Zoom Range | Stated Accuracy (FGDC/DEM) |
|---|---|---|---|---|---|
| `LRO_LOLA_Shade_SPolar875_10m` | LOLA DEM Southpole 10m, Shade | Full $360^\circ$ polar cap ($87.5^\circ\text{S} - 90^\circ\text{S}$) | $10\text{ m/px}$ | $0 - 8$ | Horizontal: 10-50 m expected; Vertical: 1-10 m absolute (FGDC error estimates). |
| `LRO_LOLA_ClrShade_SPole875_5mp_v04` | LOLA DEM, S Pole, 87.5 deg, ColorHillshade | Full $360^\circ$ polar cap ($87.5^\circ\text{S} - 90^\circ\text{S}$) | $5\text{ m/px}$ | $0 - 9$ | Horizontal: 10-50 m expected; Vertical: 1-10 m absolute (FGDC error estimates). |
| `LRO_NAC_Mosaic_86S356E_50cmp` | LROC NAC Image Mosaic, Malapert Massif | $85.15^\circ\text{S} - 86.47^\circ\text{S}$, $-13.1^\circ\text{E} - 5.8^\circ\text{E}$ | $0.5\text{ m/px}$ | $0 - 12$ | Horizontal: up to 20 m RMS; Vertical: up to 10 m RMS (LOLA-tied DEM). |
| `LRO_NAC_Shade_86S356E_3mp` | Hillshade of LROC NAC DEM (`gdaldem hillshade -z 2 -az 315 -alt 45`) | $84.59^\circ\text{S} - 87.20^\circ\text{S}$, $-15.37^\circ\text{E} - 0.25^\circ\text{E}$ | $3\text{ m/px}$ | $0 - 9$ | Horizontal: up to 20 m RMS; Vertical: up to 10 m RMS (LOLA-tied DEM, nodata value 0). |
| `LRO_LOLA_Count_SPole45_100mp_v04` | LOLA shot count per pixel | $45.0^\circ\text{S} - 90^\circ\text{S}$, variable longitude | $100\text{ m/px}$ | $0 - 4$ | Preliminary product. |

---

## 5. Critical Findings and Limitations

### 5.1 Scientific Limitations

1. **Visual Tiles Do Not Deliver Elevation Values:**
   None of the inspected WMTS layers carries numeric elevation values. Tiles are visual basemaps (8-bit PNG/JPEG) and cannot be sampled to calculate physical horizon elevation angles or line-of-sight terrain obstruction. Instrument/DEM accuracy must be kept distinct from what visual PNGs provide.
2. **Fixed Illumination in Shaded Relief:**
   Hillshade light is fixed (azimuth $315^\circ$, altitude $45^\circ$); it highlights topography but does not represent the real Sun position or real lighting conditions at any specific landing date. Real solar lighting requires ephemeris integration.
3. **Count Layer Coverage Bounds:**
   Count layer coverage depends on longitude; the $45^\circ\text{S} - 55^\circ\text{S}$ ring is not entirely empty. (V)
4. **Data for Future Terrain Horizon Analysis (`terrain-data`):**
   Physical terrain-adjusted horizon calculations require floating-point Digital Elevation Models (DEMs). This is assigned to the future `terrain-data` project phase. (U)

### 5.2 Documented NASA Metadata Errors

Four discrepancies were identified between service XML metadata and physical dataset properties:

| # | Discrepancy | Details / Impact | Status |
|---|---|---|---|
| 1 | `scale_factor = 0` in WKT | FGDC/WKT strings in XML explicitly list `scale_factor = 0`, whereas standard parallel at $-90^\circ$ requires $k=1.0$. Client projections must enforce $k=1.0$. | V |
| 2 | `WGS84BoundingBox` holds metres | The XML `WGS84BoundingBox` contains planar meter coordinates instead of angular degrees. | V |
| 3 | Swapped Row/Column Counts | LROC NAC Mosaic XML metadata explicitly swaps Row_Count and Column_Count values. | V |
| 4 | Shade Column Count Discrepancy | `LRO_NAC_Shade_86S356E_3mp` XML metadata lists `Column_Count = 7790`, whereas bounding box extent calculation yields $7990$. | V/D |

### 5.3 Reproducible Probe Table (Test Evidence)

The following table explicitly separates metadata-derived coverage, observed HTTP access, and decoded non-blank imagery claims.

| Layer ID | Zoom | Row | Col | HTTP Status | MIME / Decode / Content Check |
|---|---|---|---|---|---|
| `LRO_NAC_Shade_86S356E_3mp` | 9 | 227 | 253 | 200 OK | `image/png`, 256x256, 60,718 bytes, non-blank (Malapert). |
| `LRO_NAC_Shade_86S356E_3mp` | 10 | 454 | 506 | 404 Not Found | N/A (beyond published max z9). |
| `LRO_LOLA_ClrShade_SPole875_5mp_v04` | 9 | 255 | 255 | 200 OK | `image/png`, 256x256, 196,999 bytes, non-blank. |
| `LRO_LOLA_Count_SPole45_100mp_v04` | 4 | 7 | 16 | 200 OK | `image/png`, non-blank imagery (right-half extent). |
| `LRO_LOLA_Count_SPole45_100mp_v04` | 4 | 7 | 17 | 200 OK | `image/png`, non-blank imagery (right-half extent). |
| `LRO_LOLA_Count_SPole45_100mp_v04` | 5 | 0 | 0 | 404 Not Found | N/A (beyond published max z4). |
| `LRO_LOLA_Shade_SPolar875_10m` | 2 | 1 | 0 | 404 Not Found | N/A (outside 75.8km coverage radius). |

---

## 6. OpenLayers Map Integration Configuration (`p2-explorer`)

For the Phase 2 Explorer map implementation (`p2-explorer`), the verified OpenLayers configuration incorporating the full WMTS 2:1 matrix and z0–z12 template is below. **Note: The source-specific `extent` must be applied at the layer level, not the projection level, because sources have varying footprints (e.g., 87.5°S cap vs 45°S wide).**

```typescript
import Projection from 'ol/proj/Projection';
import WMTSTileGrid from 'ol/tilegrid/WMTS';

/**
 * Moon South Pole Polar Stereographic Projection (Moon 2000 Sphere)
 * 
 * Note: We define the projection's full mathematical extent but enforce 
 * specific bounds at the individual layer level to accommodate wider layers.
 */
export const MOON_SOUTH_POLE_PROJ = new Projection({
  code: 'urn:ogc:def:crs:IAU2000::30120',
  units: 'm',
  // The full WMTS matrix width is 2:1. Left edge is -1095930, Right edge is +3287790.
  extent: [-1095930, -1095930, 3287790, 1095930], 
  // Standard geographical bounds for a south polar projection
  worldExtent: [-180, -90, 180, -90], 
});

// Generic z0-z12 template stack generated from base resolution 8561.953125 / 2^z
// NOTE: Application code must truncate this array to each source's published max zoom.
const RESOLUTIONS = Array.from({ length: 13 }, (_, z) => 8561.953125 / Math.pow(2, z));

// Matrix sizes: [cols, rows] per zoom level where cols = 2^(z+1) and rows = 2^z
const MATRIX_SIZES = RESOLUTIONS.map((_, z) => [Math.pow(2, z + 1), Math.pow(2, z)]);

/**
 * WMTS Tile Grid supporting rectangular 2^(z+1) cols x 2^z rows.
 * 
 * - OpenLayers v6.15.1 and v10.11.0 both use `sizes`.
 * - For nodata transparency, apply a mask backed by the dataset's nodata value.
 */
export const MOON_SOUTH_POLE_TILE_GRID = new WMTSTileGrid({
  origin: [-1095930, 1095930],
  resolutions: RESOLUTIONS,
  matrixIds: RESOLUTIONS.map((_, z) => String(z)),
  sizes: MATRIX_SIZES,
  tileSize: [256, 256],
});
