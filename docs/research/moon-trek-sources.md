# Moon Trek sources (task p2-data)

Checked: 2026-11-13. Status tags: **V** verified (tested or read from service XML/metadata), **D** derived (calculated here), **U** unverified.

## Service

| Item | Value | Status |
|---|---|---|
| Protocol | OGC WMTS, RESTful | V |
| Tile URL | `https://trek.nasa.gov/tiles/Moon/SP/<LAYER_ID>/1.0.0/default/default028mm/{z}/{row}/{col}.png` | V |
| Style / TileMatrixSet | `default` / `default028mm` | V |
| Format | PNG (256x256) | V |
| CORS | `access-control-allow-origin: *`, tile fetched from a non-NASA origin | V |
| Rate limits, usage terms | metadata states Access/Use Constraints: None; no rate limit documented | U |
| Metadata URL | `https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchDataset?searchText=LRO_LOLA` (replace with exact XML URL) | V |
| CORS Check | `curl -I -H "Origin: https://example.com" <tile_url>` returned `access-control-allow-origin: *` | V |

## Projection

| Item | Value | Status |
|---|---|---|
| Projection | Polar stereographic, lat_0 -90, lon_0 0, x/y in metres from the pole | V |
| Figure | Sphere, R = 1737400 m (Moon 2000) | V |
| EPSG | none (`EPSG::0` in XML), custom definition needed | V |
| proj4 | `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m` | D |
| Scale factor | Metadata specifies standard parallel at -90, supporting k=1. Coordinate reference tests required to confirm implementation. | **V** |
| Axes | +y towards lon 0, pole at tile-grid centre. Checked against layer bbox corners and lat/lon bounds in metadata, and a rendered tile | D |

## Tile grid (`default028mm`)

- `TopLeftCorner` (-1095930, 1095930) m; matrix at zoom z: `2^(z+1)` columns x `2^z` rows. (V)
- Metres/pixel = ScaleDenominator x 0.00028: z0 8562, z9 16.72, z12 2.09. (D)
- Tile (z, row, col) covers x = col*T - 1095930 ... , y = 1095930 - row*T ... with T = 256 x m/px. (D)
- Grid extent is square. Note: Data can exist in columns beyond the first half (e.g., at z4, cols 16 and 17 returned image content), so column limits should not be assumed. (V)
- Check: Malapert centre (x -11329.5, y 123592.5) maps to z9 row 227, col 253; that tile returns the expected hillshade. (V)

## Layers inspected (South Pole family)

| Layer ID | Content | Coverage | Source res. | Zoom listed | Elevation values |
|---|---|---|---|---|---|
| `LRO_LOLA_Count_SPole45_100mp_v04` | LOLA shot count per pixel | 45S-90S, 28800 px square | 100 m | 0-4 | No |
| `LRO_NAC_Mosaic_86S356E_50cmp` | LROC NAC image mosaic | Malapert, lat -85.15 to -86.47, lon -13.1 to 5.8 | 0.5 m | 0-12 | No |
| `LRO_NAC_Shade_86S356E_3mp` | Hillshade of LROC NAC DEM (`gdaldem hillshade -z 2 -az 315 -alt 45`) | Malapert, lat -84.59 to -87.2, lon -15.37 to 0.25 | 3 m | 0-9 | No (8-bit image, nodata 0) |

Stated accuracy (NAC DEM, LOLA-tied): horizontal up to 20 m RMS, vertical up to 10 m RMS. Count layer: preliminary product (V, metadata).

## Findings

1. None of the three layers carries numeric elevation. Tiles are a visual basemap only and cannot give horizon elevation.
2. Hillshade light is fixed (az 315, alt 45); it does not represent the real Sun at any date.
3. Count layer coverage depends on longitude; the 45–55S ring is not entirely empty (e.g., a point at 50S, 45E maps to a tile with image content). (V)
4. Metadata errors: `scale_factor = 0` in WKT; `WGS84BoundingBox` holds metres, not degrees; Mosaic Row/Column counts swapped; Shade Column_Count 7790 vs 7990 from bbox (D).
5. Layers with polar-wide coverage and elevation tiles not yet identified. (U)


## Terrain data (for task terrain-data, not Moon Trek)

NASA PGDA "A New View of the Lunar South Pole from LOLA" lists south polar stereographic GeoTIFFs in the MOON_ME frame (DE421), e.g. `LDEM_80S_20MPP_ADJ.TIF` (20 m). Source: https://pgda.gsfc.nasa.gov/products/90. Download size, vertical datum and licence not checked here. (U)

## Not done

- 347 south-polar catalogue entries were accessed directly via the API. (V)
- Zoom levels beyond those listed in each XML not requested.
