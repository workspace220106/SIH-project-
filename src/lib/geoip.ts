/**
 * Offline IP geolocation.
 *
 * Two sources, in priority order:
 *
 *  1. The capture itself. `geo_country` / `asn` are part of the problem
 *     statement's minimum field set, so a well-formed capture already carries
 *     them and no lookup is needed.
 *  2. A local GeoIP database, when the operator has installed one. Build it
 *     from a MaxMind GeoLite2 Country CSV with `scripts/build-geoip.ts`, which
 *     writes `public/geoip/ipv4-country.json`.
 *
 * Nothing here touches the network at runtime. If neither source resolves an
 * address the result is `ZZ`, and the interface says so rather than guessing.
 */

export type GeoSource = 'capture' | 'database' | 'unresolved'

export interface GeoResult {
  country: string
  asn: string
  source: GeoSource
}

/** [startInclusive, endInclusive, ISO-3166-1 alpha-2, ASN] */
type Range = [number, number, string, string]

interface GeoDatabase {
  generated: string
  source: string
  ranges: Range[]
}

const UNRESOLVED: GeoResult = { country: 'ZZ', asn: 'AS0', source: 'unresolved' }

let ranges: Range[] = []
let loaded = false
let databaseLabel = ''

/** Dotted-quad to a comparable integer. Returns -1 for anything unparseable. */
export function ipToLong(ip: string): number {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return -1
  let out = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return -1
    out = out * 256 + n
  }
  return out
}

/**
 * Loads the local database if one has been installed. Absence is normal, not
 * an error — captures that carry their own country resolve without it.
 */
export async function loadGeoDatabase(url = '/geoip/ipv4-country.json'): Promise<boolean> {
  if (loaded) return ranges.length > 0
  loaded = true
  try {
    const res = await fetch(url)
    if (!res.ok) return false
    const db = (await res.json()) as GeoDatabase
    if (!Array.isArray(db.ranges)) return false
    // Sorted once so every later lookup is a binary search.
    ranges = db.ranges.slice().sort((a, b) => a[0] - b[0])
    databaseLabel = db.source || 'local database'
    return ranges.length > 0
  } catch {
    return false
  }
}

export function geoDatabaseStatus(): { loaded: boolean; entries: number; label: string } {
  return { loaded: ranges.length > 0, entries: ranges.length, label: databaseLabel }
}

/** Database lookup only. Use `resolveGeo` unless you specifically want this. */
export function lookupIp(ip: string): GeoResult {
  if (!ranges.length) return UNRESOLVED
  const key = ipToLong(ip)
  if (key < 0) return UNRESOLVED

  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [start, end, country, asn] = ranges[mid]
    if (key < start) hi = mid - 1
    else if (key > end) lo = mid + 1
    else return { country, asn, source: 'database' }
  }
  return UNRESOLVED
}

/**
 * Country and ASN for an address, preferring what the capture already states.
 */
export function resolveGeo(ip: string, fromCapture?: { country?: string; asn?: string }): GeoResult {
  const country = fromCapture?.country?.trim().toUpperCase()
  const asn = fromCapture?.asn?.trim().toUpperCase()
  if (country && country.length === 2 && country !== 'ZZ') {
    return { country, asn: asn || 'AS0', source: 'capture' }
  }
  const hit = lookupIp(ip)
  if (hit.source === 'database') {
    return { country: hit.country, asn: asn || hit.asn, source: 'database' }
  }
  return asn ? { country: 'ZZ', asn, source: 'capture' } : UNRESOLVED
}

/** For display: 'ZZ' is not a country, so say what it actually means. */
export const countryLabel = (code: string) => (code === 'ZZ' || !code ? 'UNRESOLVED' : code)
