# MOONLINE Lunar Coordinate System & Observer Contract

**File:** `docs/science/lunar-coordinates.md`  
**Author:** Rameen (`@Mumei-Nocturnal`)  
**Task:** `p2-coordinates-observer-contract`  
**Consumer:** Application Engineering / Explorer UI (`@SultanZain`, `p2-explorer`)  
**Review Status:** Resolves Sultan's [P1] frame relationship and [P2] longitude endpoints criteria.

---

## 1. Purpose & Scope

This document defines the scientific coordinate conventions and observer contract used by MOONLINE for lunar observer locations and candidate landing sites.

An interactive click in the OpenLayers Explorer (`PR #9`) supplies a 2D map point with latitude and longitude. However, calculating topocentric astronomical ephemeris (Sun and Earth positions via NASA JPL Horizons in Phase 3) requires an **Astronomical Observer**:
1. An explicit **Coordinate System vs Ephemeris Reference Frame** relationship.
2. Explicit **Observer Height and Height Datum** ("Unknown is not zero").
3. Explicit **Exact-Pole Azimuth Semantics** (azimuth singularity at $\pm 90^\circ$).
4. Honest exposure: Unverified frame and provider transformations must remain explicitly **`unavailable`** rather than relabelling the map point.

---

## 2. Scientific Decision & Evidence Table

Every scientific parameter is explicitly classified as **Verified Evidence**, **Derived Relationship under stated model**, **Application Policy**, or **Unverified/Unavailable Mapping**:

| Parameter / Area | Scientific Specification | Epistemic Classification | Primary Evidence & Source Citation |
|---|---|---|---|
| **Map Coordinate System** | `MOON_TREK_MAP`: Moon 2000 spherical coordinate model with $R = 1,737,400\text{ m}$. | **Verified Evidence** | NASA Moon Trek Combined Nomenclature Metadata (retrieved 2026-11-14). WKT `SPHEROID["Moon_2000_IAU_IAG",1737400.0,0.0]`. |
| **Ephemeris Target Frame** | `MOON_ME` (Mean Earth / Polar Axis body-fixed frame, DE421 orientation). | **Verified Evidence** | NASA NAIF Lunar Frame Kernel `moon_080317.tf`; Archinal et al. (2018). Primary frame for JPL Horizons topocentric surface queries (`coord@301`). |
| **Map-to-Frame Transformation** | Conversion from `MOON_TREK_MAP` to `MOON_ME` is marked **unavailable** in Phase 2. Coarse spherical identity is not assumed. | **Application Policy & Verified Limit** | NAIF `moon_080317.tf` documents ~100 m physical offsets between DE421 ME and IAU_MOON libration angles. Rigorous transformation is deferred to Phase 3 (`p3-positions`). |
| **Latitude Model** | Planetocentric latitude in degrees $[-90.0, +90.0]$. On a reference sphere ($R = 1,737,400\text{ m}$), planetocentric and planetographic latitudes coincide mathematically. | **Derived Relationship** | Spherical geometric identity: $\tan(\phi_{\text{graphic}}) = (a/b)^2 \tan(\phi_{\text{centric}})$. Since $a = b$, $(a/b)^2 = 1.0$, rendering both angles identical. |
| **Longitude Policy** | Input: Signed `[-180.0, +180.0]` or Unsigned `[0.0, 360.0]`. Output: Canonical half-open interval `[-180.0, +180.0)`. Endpoint $+180.0^\circ$ normalizes to $-180.0^\circ$. | **Application Policy & Standard** | IAU standard positive-east convention (Archinal et al., 2018). Input ranges strictly enforced; unsupported inputs outside `[-180, 360]` are rejected with `LONGITUDE_OUT_OF_BOUNDS`. |
| **Supported Datums** | Strictly limited to `'reference_sphere'` ($R = 1,737,400\text{ m}$) and `'terrain_surface'` (local DEM surface). Unsupported datums (e.g. `'terrain-relative'`, `'wgs84'`) are rejected. | **Application Policy (Core Rule)** | `AGENTS.md` ("Unknown is not zero"). Unverified datums cannot be converted into physical elevations. |
| **Height Interpretation** | Four explicit meanings: `'reference_surface_zero'`, `'reference_surface_offset'`, `'measured_terrain_elevation'`, `'height_above_terrain'`. | **Application Policy** | Enforces transparency: a mathematical zero on the sphere is distinguished from a real physical terrain elevation. |
| **Exact Geographic Poles** | Coordinates at $\pm 90.0^\circ$ are accepted as valid positions. `poleStatus` is `'south_pole'` or `'north_pole'`. Azimuth definition is set to `'undefined_at_pole'`. | **Verified Evidence** | Directional singularity: At the South Pole, every direction is North; at the North Pole, every direction is South. Local azimuth requires an explicitly adopted reference meridian. |
| **JPL Horizons Compatibility** | Query format `coord@301` requires longitude, latitude, and elevation in km. Marked **unavailable** until Phase 3. | **Verified Evidence** | JPL Horizons System Manual, *Surface-Site Coordinates* (retrieved 2026-11-14). Requires Mean-Earth frame. |

---

## 3. Frame & Figure Relationship Analysis

### A. The Moon Trek Map Model
The Moonline Explorer OpenLayers map utilizes NASA Moon Trek WMTS layers referenced to the **Moon 2000 IAU/IAG** coordinate system:
- Model: Sphere of radius $R = 1,737,400\text{ m}$.
- Coordinate type: Planetocentric latitude and positive-east longitude.
- Horizontal projection: South Polar Stereographic for polar cap exploration.

### B. The JPL Horizons Ephemeris Frame
JPL Horizons surface topocentric queries (`coord@301`) evaluate observer positions relative to the lunar body-fixed Mean Earth/Polar Axis system (`MOON_ME`):
- Origin: Lunar center of mass.
- $Z$-axis: Mean axis of lunar rotation.
- $X$-axis: Mean sub-Earth direction.
- Elevation: Defined relative to the reference figure specified in the Horizons setup (defaulting to the mean lunar radius or reference ellipsoid).

### C. The NAIF SPICE Frame Distinction (`moon_080317.tf`)
Primary source evidence from the NAIF lunar frame kernel `moon_080317.tf` explicitly warns against treating lunar body-fixed frames as interchangeable:
1. **`MOON_ME` (DE421):** Defined by lunar physical librations computed directly by the JPL Planetary and Lunar Ephemeris numerical integration (DE421).
2. **`IAU_MOON`:** Defined by the IAU/IAG working group's analytical series for lunar orientation.
3. **Discrepancy:** Differences between DE421 `MOON_ME` and `IAU_MOON` reach up to **~100 metres at the lunar surface**.
4. **`MOON_PA`:** The Principal Axes frame aligns with the Moon's principal axes of inertia and is offset from `MOON_ME` by approximately 0.05° (several kilometers at the surface).

### D. Why Conversion Remains Explicitly Unavailable
Because the Explorer map provides 2D spherical coordinates from Moon Trek, relabelling them directly as `MOON_ME` without a verified numerical libration transformation would violate `AGENTS.md` ("No fabricated science").

Therefore, this contract establishes the following strict application policy:
- The coordinate source is identified honestly as `coordinateSystem: 'MOON_TREK_MAP'`.
- Frame compatibility is returned with `status: 'unavailable'` and `targetFrame: 'MOON_ME'`.
- Provider compatibility is returned with `status: 'unavailable'`.
- Topocentric ephemeris calculations are unlocked only when the verified transformation is delivered in Phase 3 (`p3-positions`).

---

## 4. Longitude Convention & Endpoints

- **Direction:** Positive east (standard IAU 2000 convention).
- **Unit:** Degrees.
- **Accepted Input Intervals:**
  - Signed positive-east interval: `[-180.0°, +180.0°]`.
  - Unsigned positive-east interval: `[0.0°, 360.0°]`.
  - Values outside `[-180.0°, 360.0°]` are rejected with `LONGITUDE_OUT_OF_BOUNDS` (unsupported inputs are not normalized into acceptance).
- **Canonical Output Interval:**
  - Strictly normalized to half-open interval `[-180.0°, +180.0°)`.
  - Endpoint behavior: `+180.0°` maps to `-180.0°` (representing the identical antimeridian on the lunar sphere).
  - Unsigned endpoint behavior: `360.0°` maps to `0.0°`.

---

## 5. Latitude & Pole Azimuth Policy

- **Latitude Unit:** Degrees.
- **Valid Range:** `[-90.0°, +90.0°]` (planetocentric).
- **Values outside `[-90.0°, +90.0°]`:** Rejected with `LATITUDE_OUT_OF_BOUNDS`.
- **Exact Geographic Poles ($\pm 90.0^\circ$):**
  - Accepted as valid surface coordinates.
  - `poleStatus`: Classified as `'north_pole'` (+90°) or `'south_pole'` (-90°).
  - `azimuth.status`: Classified as `'undefined_at_pole'`.
  - At the South Pole, all horizontal directions point North along meridians; at the North Pole, all directions point South. Horizontal azimuth is mathematically singular without an adopted reference meridian.

---

## 6. Height, Datums & "Unknown is Not Zero"

- **Height Unit:** Metres.
- **Missing or Null Height:** Returns `status: 'incomplete'` with `missingFields: ['heightMeters', 'heightDatum', 'heightInterpretation']`. Missing height is **NEVER** defaulted to zero.
- **Physical Elevation Limits:** Relative to the reference sphere, valid surface elevations are bounded by `[-12000, 15000]` m (spanning deepest lunar crater floors to highest basin rims).
- **Supported Datums:**
  - `'reference_sphere'`: Height measured relative to IAU reference sphere ($R = 1,737,400\text{ m}$).
  - `'terrain_surface'`: Height measured relative to local digital elevation model.
- **Deliberately Supplied Zero:**
  - `{ heightMeters: 0, heightDatum: 'reference_sphere', heightInterpretation: 'reference_surface_zero' }` is accepted as a complete observer.
  - It generates a warning: *Observer height is explicitly set to 0 metres on the reference sphere. This represents a mathematical datum, not a measured terrain surface elevation.*

---

## 7. Usage Examples Using Actual Runtime Types

### Incomplete Observer (Map Pin Drop)
```typescript
import { validateLunarObserver, isLunarObserver } from '@/lib/validation/lunar-observer';

const mapInput = {
  latitude: -85,
  longitude: 20,
  referenceFrame: 'ME',
  longitudeConvention: 'signed-east',
  elevationMeters: null,
};

const result = validateLunarObserver(mapInput);
// isLunarObserver(mapInput) -> false
// result.status -> 'incomplete'
// result.missingFields -> ['heightMeters', 'heightDatum', 'heightInterpretation']
// result.frameCompatibility.status -> 'unavailable'
```

### Complete Observer with Reference-Surface Zero
```typescript
const zeroInput = {
  latitudeDeg: -85,
  longitudeDeg: 20,
  heightMeters: 0,
  heightDatum: 'reference_sphere',
  heightInterpretation: 'reference_surface_zero',
};

const result = validateLunarObserver(zeroInput);
// isLunarObserver(zeroInput) -> true
// result.status -> 'complete'
// result.observer.height.heightInterpretation -> 'reference_surface_zero'
// result.observer.frameCompatibility.status -> 'unavailable'
```

---

## 8. Primary Sources & Retrieval Dates

1. **JPL Horizons System Manual:**
   - URL: `https://ssd.jpl.nasa.gov/horizons/manual.html` (retrieved 2026-11-14).
   - Section: *Surface-Site Coordinates*. Specifies planetocentric coordinates in Moon Mean-Earth frame.
2. **NASA NAIF SPICE Lunar Frame Kernel (`moon_080317.tf`):**
   - URL: `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf` (retrieved 2026-11-14).
   - Documents differences between DE421 `MOON_ME`, `IAU_MOON`, and `MOON_PA` frames.
3. **NASA Moon Trek Nomenclature Layer Metadata:**
   - URL: `https://trek.nasa.gov/moon/trekarcgis/rest/services/CombinedNomenclature/MapServer/0?f=json` (retrieved 2026-11-14).
   - Confirms standard reference sphere with $R = 1,737,400\text{ m}$.
4. **Report of the IAU/IAG Working Group on Cartographic Coordinates (Archinal et al., 2018):**
   - DOI: `10.1007/s10569-017-9805-5`.
   - Defines lunar cartographic standards and positive-east longitudes.

---

## 9. Verification Commands

```powershell
pnpm typecheck
pnpm lint
pnpm test:ownership
pnpm exec playwright test tests/science/lunar-observer.spec.ts
pnpm verify
```
