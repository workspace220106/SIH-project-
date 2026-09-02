/**
 * Converts a MaxMind GeoLite2 Country (and optionally ASN) CSV export into the
 * compact range table the app loads at `public/geoip/ipv4-country.json`.
 *
 * GeoLite2 is free but requires a MaxMind account to download. Nothing is
 * fetched here — point this at a directory you have already extracted.
 *
 *   1. Download "GeoLite2 Country: CSV Format" and, optionally, "GeoLite2 ASN:
 *      CSV Format" from https://www.maxmind.com/en/accounts/current/geoip/downloads
 *   2. Extract both into one directory, e.g. ./geolite2/
 *   3. npx esbuild scripts/build-geoip.ts --bundle --platform=node --format=cjs \
 *        --alias:@=./src --outfile=.tmp/geoip.cjs && node .tmp/geoip.cjs ./geolite2
 *
 * The app works without this file — captures that carry `geo_country` resolve
 * from the record itself.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node geoip.cjs <path-to-extracted-geolite2-csv-directory>')
  process.exit(1)
}

const BLOCKS = 'GeoLite2-Country-Blocks-IPv4.csv'
const LOCATIONS = 'GeoLite2-Country-Locations-en.csv'
const ASN_BLOCKS = 'GeoLite2-ASN-Blocks-IPv4.csv'

function readCsv(file: string): string[][] {
  const path = join(dir, file)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length)
    .slice(1)
    .map((line) => line.split(','))
}

/** "1.0.0.0/24" → [firstAddress, lastAddress] as integers. */
function cidrToRange(cidr: string): [number, number] | null {
  const [ip, bitsRaw] = cidr.split('/')
  const bits = Number(bitsRaw)
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n)) || !Number.isInteger(bits)) {
    return null
  }
  const base = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
  const size = 2 ** (32 - bits)
  return [base, base + size - 1]
}

// geoname_id → ISO country code
const countryByGeoname = new Map<string, string>()
for (const row of readCsv(LOCATIONS)) {
  const geonameId = row[0]
  const iso = row[4]
  if (geonameId && iso) countryByGeoname.set(geonameId, iso.replace(/"/g, ''))
}
if (!countryByGeoname.size) {
  console.error('No locations parsed. Is ' + LOCATIONS + ' in ' + dir + '?')
  process.exit(1)
}

// Optional ASN table, keyed by range start so country ranges can borrow from it.
const asnRanges: Array<[number, number, string]> = []
for (const row of readCsv(ASN_BLOCKS)) {
  const range = cidrToRange(row[0])
  if (!range || !row[1]) continue
  asnRanges.push([range[0], range[1], 'AS' + row[1]])
}
asnRanges.sort((a, b) => a[0] - b[0])

function asnFor(start: number): string {
  let lo = 0
  let hi = asnRanges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [s, e, asn] = asnRanges[mid]
    if (start < s) hi = mid - 1
    else if (start > e) lo = mid + 1
    else return asn
  }
  return 'AS0'
}

const ranges: Array<[number, number, string, string]> = []
for (const row of readCsv(BLOCKS)) {
  const range = cidrToRange(row[0])
  if (!range) continue
  // Fall back to registered country when the network has no geoname of its own.
  const iso = countryByGeoname.get(row[1]) ?? countryByGeoname.get(row[2])
  if (!iso) continue
  ranges.push([range[0], range[1], iso, asnFor(range[0])])
}

if (!ranges.length) {
  console.error('No IPv4 blocks parsed. Is ' + BLOCKS + ' in ' + dir + '?')
  process.exit(1)
}

ranges.sort((a, b) => a[0] - b[0])

mkdirSync('public/geoip', { recursive: true })
const out = {
  generated: new Date().toISOString(),
  source: 'MaxMind GeoLite2 Country' + (asnRanges.length ? ' + ASN' : ''),
  ranges,
}
writeFileSync('public/geoip/ipv4-country.json', JSON.stringify(out), 'utf8')
console.log('wrote public/geoip/ipv4-country.json —', ranges.length, 'ranges,', asnRanges.length, 'ASN blocks')
