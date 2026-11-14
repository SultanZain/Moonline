# MOONLINE Lunar Coordinate System & Observer Contract

**File:** `docs/science/lunar-coordinates.md`  
**Author:** Rameen (`@Mumei-Nocturnal`)  
**Task:** `p2-coordinates-observer-contract`  
**Review & Integration:** Aligned with Sultan's architecture (`@SultanZain`, `p2-explorer`)  
**Status:** Corrected & Verified (Resolves Sultan's scientific provenance and frame verification criteria)  

---

## 1. Purpose & Scope

This document defines the scientific coordinate conventions, observer contracts, and validation semantics used by MOONLINE for lunar observer locations and candidate landing sites.

An interactive click in the OpenLayers Explorer (`PR #9`) supplies a 2D map point with latitude and longitude. However, calculating topocentric astronomical ephemeris (Sun and Earth positions via NASA JPL Horizons in Phase 3) requires a strictly validated **Astronomical Observer**:
1. **Explicit Coordinate System vs Ephemeris Reference Frame Relationship:** Differentiating between Moon Trek map coordinates and JPL Horizons Mean Earth / Polar Axis frames.
2. **Explicit Observer Height and Height Datum:** Enforcing the principle that *"Unknown height is NEVER zero"*.
3. **Exact-Pole Azimuth Singularity Policy:** Formalizing azimuth singularity at $\pm 90^\circ$.
4. **Honest Exposure:** Unverified frame transformations and provider capabilities must remain explicitly marked as **`unavailable`** rather than prematurely claiming readiness.

---

## 2. Scientific Decision & Evidence Table

Every scientific parameter is classified as **Verified Evidence**, **Derived Relationship under stated model**, **Application Validation Policy**, or **Unverified/Unavailable Mapping**:

| Parameter / Area | Scientific Specification | Epistemic Classification | Primary Evidence & Source Citation |
|---|---|---|---|
| **Map Coordinate System** | `MOON_TREK_MAP`: Moon 2000 spherical coordinate model with $R = 1,737,400\text{ m}$. | **Verified Evidence** | NASA Moon Trek Combined Nomenclature Metadata (retrieved 2026-11-14). WKT `SPHEROID["Moon_2000_IAU_IAG", 1737400.0, 0.0]`. |
| **Longitude Convention** | `positive_east` canonical signed interval $[-180.0^\circ, +180.0^\circ)$. | **Verified Evidence** | IAU/IAG Working Group on Cartographic Coordinates (Archinal et al., 2018). Positive East is standard for planetary bodies. |
| **Longitude Endpoint (+180°)** | $+180.0^\circ$ normalizes to $-180.0^\circ$ (half-open meridian identity). | **Derived Relationship** | Spherically identical meridian; standard half-open interval $[-180, +180)$ eliminates antimeridian ambiguity. |
| **Latitude Bounds** | Rigid closed interval $[-90.0^\circ, +90.0^\circ]$. | **Verified Evidence** | Spherical polar coordinates definition. Values outside this interval are invalid. |
| **Exact-Pole Azimuth** | At $\pm 90.0^\circ$, horizontal azimuth is singular and explicitly `undefined_at_pole`. | **Derived Relationship** | Differential geometry singularity: all directions from North Pole point South; all directions from South Pole point North. |
| **Elevation Validation Limits** | $[-12,000\text{ m}, +15,000\text{ m}]$ relative to reference sphere. | **Application Validation Policy** | Application safety bounds to filter nonsensical inputs. Empirical lunar extremes (e.g. Antoniadi crater floor to Engel'gardt rim) fall within this envelope. |
| **Supported Height Datum** | `reference_sphere` ($R = 1,737,400\text{ m}$). | **Application Policy** | Defined in `src/types/lunar-observer.ts`. Topographic datum is referenced to the mathematical Moon 2000 sphere. |
| **Ephemeris Frame Compatibility** | Marked explicitly as `unavailable`. | **Unverified / Unavailable Mapping** | JPL Horizons uses planetodetic surface coordinates on a mean-Earth reference ellipsoid. No unverified spherical identity is assumed. |

---

## 3. Coordinate System & Ephemeris Frame Relationships

### 3.1 Moon Trek Map System (`MOON_TREK_MAP`)
- Operates on a regular sphere with radius $R = 1,737,400\text{ m}$.
- Employs planetocentric latitudes and positive-east longitudes.
- Map points picked from the UI are strictly tagged as `coordinateSystem: "MOON_TREK_MAP"`.

### 3.2 NASA JPL Horizons Ephemeris System (`MOON_ME`)
- **Important Correction:** NASA JPL Horizons surface site specifications require **geodetic / planetodetic** surface coordinates relative to the lunar Mean Earth / Polar Axis reference ellipsoid.
- The 2008 NAIF SPICE lunar frame kernel (`moon_080317.tf`) establishes frame aliases and orientation differences between DE421 `MOON_ME`, `IAU_MOON`, and `MOON_PA`, but **does not dispense with the mathematical requirement for an explicit transformation kernel**.
- Because Moonline has not yet implemented this verified transformation kernel (scheduled for Phase 3: `p3-positions`), the validator **strictly returns `frameCompatibility: { status: 'unavailable' }`**.

```typescript
// Explicit status exposed by the validator:
frameCompatibility: {
  status: 'unavailable',
  sourceFrame: 'MOON_TREK_MAP',
  targetFrame: 'MOON_ME',
  reason: 'Rigorous coordinate transformation from Moon Trek map coordinates to JPL Horizons MOON_ME reference frame is scheduled for verification in Phase 3. Coarse spherical identity is not assumed.'
}
```

---

## 4. Observer Height, Datum, and Interpretations

### 4.1 Principle: Unknown Height is Never Zero
A missing elevation cannot be defaulted to zero:
- Setting elevation to zero silently places an observer at the reference sphere surface ($R = 1,737,400\text{ m}$).
- In deep polar craters (such as Shackleton, with depths over $4\text{ km}$), assuming height zero produces topocentric horizon and line-of-sight errors of several kilometers.
- If elevation is missing or null, the validator returns `status: "incomplete"` with `missingFields: ['heightMeters', 'heightDatum', 'heightInterpretation']`.

### 4.2 Supported Datums & Interpretations
Aligned with `src/types/lunar-observer.ts`:

1. **`heightDatum: 'reference_sphere'`**:
   - The reference sphere radius is exactly $1,737,400\text{ m}$.
   - **`reference_surface_zero`**: Strictly requires `heightMeters === 0`. Represents a mathematical zero on the sphere, not a measured terrain surface elevation.
   - **`reference_surface_offset`**: Represents an explicit non-zero offset above or below the reference sphere.
   - **`measured_terrain_elevation`**: Topographic terrain elevation measured relative to the reference sphere (e.g. from LOLA DEM datasets).

---

## 5. Pole Semantics & Azimuth Singularity

At the exact lunar poles ($\text{Latitude} = \pm 90.0^\circ$):
- Meridians converge to a single point.
- Standard horizontal azimuth (degrees from North through East) is mathematically undefined.
- The observer contract documents this condition explicitly rather than returning an arbitrary orientation:

```typescript
// North Pole (+90°)
{
  poleStatus: 'north_pole',
  azimuth: {
    status: 'undefined_at_pole',
    reason: 'At the exact North Pole (+90°), all directions point south along meridians. Local horizontal azimuth is undefined without an explicitly adopted reference meridian.'
  }
}
```

---

## 6. Runtime Validation Architecture

The runtime validator `validateLunarObserver` in `src/lib/validation/lunar-observer.ts` enforces:
1. **Input Structure:** Plain object check (`Array.isArray` is rejected with `ARRAY_NOT_PERMITTED`).
2. **Metadata Verification:** Rejection of unsupported declarations (`coordinateSystem !== 'MOON_TREK_MAP'`, `longitudeConvention !== 'positive_east'`, or invalid `referenceFrame`).
3. **Finite Numbers:** Elimination of `NaN`, `+Infinity`, and `-Infinity`.
4. **Longitude Normalization:** Conversion of inputs in $[-180^\circ, +180^\circ]$ or $[0^\circ, 360^\circ]$ to the canonical interval $[-180^\circ, +180^\circ)$.
5. **Zero Height Integrity:** Strict rejection if `reference_surface_zero` is supplied with `heightMeters !== 0`.
6. **Type Predicate Safety:** Type guards (`isLunarObserver`) strictly verify the presence of structured properties (`coordinates`, `height`, `referenceSphere`) before narrowing types, preventing runtime `TypeError` crashes.

---

## 7. Example Observer Payloads

### Incomplete Map Selection (Clicking on Explorer Map)
```typescript
import { validateLunarObserver } from '@/lib/validation/lunar-observer';

const mapInput = {
  latitudeDeg: -85.0,
  longitudeDeg: 20.0,
};

const result = validateLunarObserver(mapInput);
// result.success === false
// result.status === 'incomplete'
// result.missingFields === ['heightMeters', 'heightDatum', 'heightInterpretation']
// result.frameCompatibility.status === 'unavailable'
```

### Complete Validated Observer (Reference-Surface Zero)
```typescript
const zeroInput = {
  latitudeDeg: -89.9,
  longitudeDeg: 0.0,
  heightMeters: 0,
  heightDatum: 'reference_sphere',
  heightInterpretation: 'reference_surface_zero',
};

const result = validateLunarObserver(zeroInput);
// result.success === true
// result.status === 'complete'
// result.observer.height.heightMeters === 0
// result.observer.frameCompatibility.status === 'unavailable'
```

### Complete Validated Observer (Measured Terrain Elevation)
```typescript
const terrainInput = {
  latitudeDeg: -85.99,
  longitudeDeg: 2.93,
  heightMeters: 5040,
  heightDatum: 'reference_sphere',
  heightInterpretation: 'measured_terrain_elevation',
  heightSource: 'LOLA DEM 20m/px',
};

const result = validateLunarObserver(terrainInput);
// result.success === true
// result.status === 'complete'
// result.observer.height.heightInterpretation === 'measured_terrain_elevation'
```

---

## 8. Primary Sources & Citations

1. **NASA JPL Horizons System Manual:**
   - URL: `https://ssd.jpl.nasa.gov/horizons/manual.html` (retrieved 2026-11-14).
   - *Section: Surface-Site Coordinates*. Specifies planetodetic / geodetic coordinates relative to the lunar Mean-Earth reference ellipsoid.
2. **NASA NAIF SPICE Lunar Frame Kernel (`moon_080317.tf`):**
   - URL: `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf` (retrieved 2026-11-14).
   - Defines mathematical relationships between DE421 `MOON_ME`, `IAU_MOON`, and `MOON_PA` lunar frames.
3. **NASA Moon Trek Combined Nomenclature Metadata:**
   - URL: `https://trek.nasa.gov/moon/trekarcgis/rest/services/CombinedNomenclature/MapServer/0?f=json` (retrieved 2026-11-14).
   - Confirms standard reference sphere with $R = 1,737,400\text{ m}$.
4. **Report of the IAU/IAG Working Group on Cartographic Coordinates (Archinal et al., 2018):**
   - DOI: `10.1007/s10569-017-9805-5`.
   - Defines lunar cartographic standards and positive-east conventions.
