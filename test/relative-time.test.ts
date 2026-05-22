/**
 * Unit tests for `relativeTime`: the unit-stepping logic the status bar uses
 * to phrase ages such as "5 minutes ago".
 *
 * Tests run against a frozen clock (the `mock.timers` Node helper) so the
 * elapsed time between the timestamp and the call is deterministic.
 */

import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { relativeTime } from '../src/panel/relative-time.js'

const NOW = Date.parse('2024-01-15T12:00:00Z')

function isoSecondsBefore (seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString()
}

function isoSecondsAfter (seconds: number): string {
  return new Date(NOW + seconds * 1000).toISOString()
}

test('relativeTime renders an in-the-past second-precision delta in seconds', () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    assert.equal(relativeTime(isoSecondsBefore(5)), '5 seconds ago')
  } finally {
    mock.timers.reset()
  }
})

test('relativeTime renders a minute-scale delta in minutes', () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    assert.equal(relativeTime(isoSecondsBefore(180)), '3 minutes ago')
  } finally {
    mock.timers.reset()
  }
})

test('relativeTime renders an hour-scale delta in hours', () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    assert.equal(relativeTime(isoSecondsBefore(7200)), '2 hours ago')
  } finally {
    mock.timers.reset()
  }
})

test('relativeTime renders a multi-day delta in days', () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    assert.equal(relativeTime(isoSecondsBefore(86400 * 3)), '3 days ago')
  } finally {
    mock.timers.reset()
  }
})

test('relativeTime steps up to the next unit when rounding spills it (59m 30s -> 1 hour ago)', () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    // 59 minutes 30 seconds: rounded as minutes is 60, which equals one hour;
    // the spill-up step rewrites that as "1 hour ago" rather than "60 minutes
    // ago". This is the spill-up branch of relativeTime under test.
    assert.equal(relativeTime(isoSecondsBefore(3570)), '1 hour ago')
  } finally {
    mock.timers.reset()
  }
})

test('relativeTime renders a future delta with the future preposition', () => {
  mock.timers.enable({ apis: ['Date'], now: NOW })
  try {
    assert.equal(relativeTime(isoSecondsAfter(120)), 'in 2 minutes')
  } finally {
    mock.timers.reset()
  }
})

test('relativeTime returns the input verbatim when the timestamp is not parseable', () => {
  assert.equal(relativeTime('not-a-date'), 'not-a-date')
})
