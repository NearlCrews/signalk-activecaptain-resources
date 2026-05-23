import test from 'node:test'
import assert from 'node:assert/strict'
import { openSeaMapMarkerUrl } from '../src/shared/map-link.js'

test('openSeaMapMarkerUrl builds a marker URL with lat, lon, mlat, and mlon', () => {
  const url = openSeaMapMarkerUrl(42.3601, -71.0589)
  assert.ok(url.startsWith('https://map.openseamap.org/?'))
  assert.ok(url.includes('lat=42.3601'))
  assert.ok(url.includes('lon=-71.0589'))
  assert.ok(url.includes('mlat=42.3601'))
  assert.ok(url.includes('mlon=-71.0589'))
  assert.ok(url.includes('zoom=15'))
})

test('openSeaMapMarkerUrl handles negative and zero coordinates', () => {
  const url = openSeaMapMarkerUrl(-33.8688, 151.2093)
  assert.ok(url.includes('lat=-33.8688'))
  assert.ok(url.includes('lon=151.2093'))
  const zero = openSeaMapMarkerUrl(0, 0)
  assert.ok(zero.includes('lat=0'))
  assert.ok(zero.includes('lon=0'))
})
