# MOONLINE Lunar Coordinate System

## 1. Purpose

This document defines the scientific coordinate conventions used by MOONLINE for lunar observer locations and landing-site candidates.

These conventions must be verified against authoritative NASA, USGS, and JPL documentation before being used in scientific calculations.

## 2. Reference Frame

- Primary lunar reference frame: Mean Earth / Polar Axis (ME).
- Ephemeris reference: DE421, subject to verification for each data source.
- Principal Axis (PA) coordinates must not be mixed with ME coordinates without an explicit frame transformation.

## 3. Latitude

- Stored as planetocentric latitude.
- Unit: degrees.
- Valid range: -90° to +90°.
- The spherical reference model makes planetocentric and planetodetic latitude numerically identical.

## 4. Longitude

- Direction: positive east.
- Unit: degrees.
- Supported representations:
  - Signed: -180° to +180°.
  - East-positive: 0° to less than 360°.
- Longitude conversions must preserve the represented location.

## 5. Reference Radius and Elevation

- Spherical reference radius: 1,737,400 metres.
- Elevation is measured relative to this reference sphere.
- Positive elevation means above the sphere.
- Negative elevation means below the sphere.
- Unknown elevation must be represented as null, never as zero.

## 6. Units

| Quantity | Unit |
|---|---|
| Latitude | degrees |
| Longitude | degrees |
| Elevation | metres |
| Reference radius | metres |
| JPL Horizons observer height | kilometres, where applicable |

Conversions between metres and kilometres must be explicit.

## 7. Validation Requirements

- Latitude and longitude must be finite numbers.
- Latitude must remain within -90° and +90°.
- Longitude must be normalized according to the selected representation.
- Elevation may be null when unknown.
- NaN and Infinity must be rejected.
- Scientific values must not be rounded prematurely.

## 8. Scientific Limitations

- Map coordinates are not automatically validated scientific observer coordinates.
- ME and PA coordinates must not be mixed without transformation.
- Unknown elevation must remain unknown.
- Geometric visibility and terrain-adjusted visibility are separate calculations.
- These conventions do not constitute landing-safety certification.

## 9. Verification Status

This document is an initial project convention record. Each convention must be linked to an authoritative source and verified before ephemeris integration.

Last updated: 2026-11-14.
