/**
 * Baseline tests for lib/matchingScore.js
 * Run: node --test __tests__/matchingScore.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreFacility, rankFacilities } from '../lib/matchingScore.js'

// ── Sample facility fixtures ──────────────────────────────────────────────────

const facilityAssisted = {
  id: 1,
  slug: 'sunrise-boston',
  name: 'Sunrise Senior Living of Boston',
  address: '123 Commonwealth Ave, Boston, MA 02115',
  rating: 4.7,
  complianceRating: 'Excellent',
  careTypes: ['Assisted Living', 'Memory Care'],
  monthlyMin: 4500,
  monthlyMax: 7500,
  amenities: [
    { name: 'Restaurant-Style Dining' },
    { name: 'Fitness Center' },
    { name: 'Transportation Services' },
    { name: 'Medication Management' },
    { name: 'Yoga & Wellness' },
    { name: 'Library & Reading Room' },
    { name: 'Arts & Crafts Studio' },
    { name: 'Garden & Walking Paths' },
    { name: 'Pet-Friendly Community' },
  ],
}

const facilitySkilled = {
  id: 2,
  slug: 'cambridge-care',
  name: 'Cambridge Care & Rehabilitation',
  address: '456 Massachusetts Ave, Cambridge, MA 02139',
  rating: 4.3,
  complianceRating: 'Good',
  careTypes: ['Skilled Nursing', 'Assisted Living'],
  monthlyMin: 5200,
  monthlyMax: 8500,
  amenities: [
    { name: 'Physical Therapy' },
    { name: 'Occupational Therapy' },
    { name: 'Speech Therapy' },
    { name: 'Dining Room' },
  ],
}

const intakeAssisted = {
  currentStep: 5,
  completed: true,
  answers: {
    care_needs: 'assisted',
    budget: '4000_6000',
    location: 'boston',
    timing: 'soon',
    priorities: ['compliance', 'amenities'],
  },
}

// ── scoreFacility — basic scoring ─────────────────────────────────────────────

test('scoreFacility returns score 0-100', () => {
  const result = scoreFacility(facilityAssisted, intakeAssisted)
  assert.ok(result.score >= 0 && result.score <= 100, `Score ${result.score} out of range`)
})

test('scoreFacility with no intake returns neutral score 50', () => {
  const result = scoreFacility(facilityAssisted, null)
  assert.strictEqual(result.score, 50)
})

test('scoreFacility with no intake answers returns score 50', () => {
  const result = scoreFacility(facilityAssisted, {})
  assert.strictEqual(result.score, 50)
})

test('scoreFacility care_needs match adds significant score', () => {
  const withCare = scoreFacility(facilityAssisted, intakeAssisted)
  const noCareIntake = {
    ...intakeAssisted,
    answers: { ...intakeAssisted.answers, care_needs: null },
  }
  const withoutCare = scoreFacility(facilityAssisted, noCareIntake)
  assert.ok(withCare.score > withoutCare.score, 'Care match should boost score')
})

test('scoreFacility correct care type match returns care_match tag', () => {
  const result = scoreFacility(facilityAssisted, intakeAssisted)
  const tag = result.tags.find((t) => t.key === 'care_match')
  assert.ok(tag, 'Should have care_match tag')
  assert.ok(tag.label.includes('Assisted Living'))
})

test('scoreFacility wrong care type does not return care_match tag', () => {
  const intake = {
    ...intakeAssisted,
    answers: { ...intakeAssisted.answers, care_needs: 'skilled' },
  }
  const result = scoreFacility(facilityAssisted, intake)
  const tag = result.tags.find((t) => t.key === 'care_match')
  assert.ok(!tag, 'Should not have care_match tag when care type mismatches')
})

test('scoreFacility budget fit adds budget_fit tag', () => {
  const result = scoreFacility(facilityAssisted, intakeAssisted)
  const tag = result.tags.find((t) => t.key === 'budget_fit')
  assert.ok(tag, 'Should have budget_fit tag')
})

test('scoreFacility compliance priority boosts score for Excellent rating', () => {
  const withCompliance = scoreFacility(facilityAssisted, intakeAssisted)
  const noCompliance = scoreFacility(facilityAssisted, {
    ...intakeAssisted,
    answers: { ...intakeAssisted.answers, priorities: [] },
  })
  assert.ok(withCompliance.score > noCompliance.score, 'Compliance priority should boost Excellent-rated facility')
})

test('scoreFacility pet_friendly priority adds tag when amenity present', () => {
  const intake = {
    ...intakeAssisted,
    answers: { ...intakeAssisted.answers, priorities: ['pet_friendly'] },
  }
  const result = scoreFacility(facilityAssisted, intake)
  const tag = result.tags.find((t) => t.key === 'pet_friendly')
  assert.ok(tag, 'Should have pet_friendly tag when facility has pet amenity')
})

test('scoreFacility memory_care priority adds tag when care type available', () => {
  const intake = {
    ...intakeAssisted,
    answers: { ...intakeAssisted.answers, priorities: ['memory_care'] },
  }
  const result = scoreFacility(facilityAssisted, intake)
  const tag = result.tags.find((t) => t.key === 'memory_care')
  assert.ok(tag, 'Should have memory_care tag when facility offers Memory Care')
})

test('scoreFacility rich amenities priority adds tag for 8+ amenities', () => {
  const intake = {
    ...intakeAssisted,
    answers: { ...intakeAssisted.answers, priorities: ['amenities'] },
  }
  const result = scoreFacility(facilityAssisted, intake)
  const tag = result.tags.find((t) => t.key === 'amenities')
  assert.ok(tag, 'Should have amenities tag for facility with 8+ amenities')
})

test('scoreFacility location match adds location_match tag', () => {
  const result = scoreFacility(facilityAssisted, intakeAssisted)
  const tag = result.tags.find((t) => t.key === 'location_match')
  assert.ok(tag, 'Should have location_match tag for Boston facility + boston location')
})

test('scoreFacility explanation string is non-empty', () => {
  const result = scoreFacility(facilityAssisted, intakeAssisted)
  assert.ok(typeof result.explanation === 'string' && result.explanation.length > 0)
})

test('scoreFacility breakdown is an object', () => {
  const result = scoreFacility(facilityAssisted, intakeAssisted)
  assert.ok(typeof result.breakdown === 'object' && result.breakdown !== null)
})

test('scoreFacility handles missing careTypes gracefully', () => {
  const badFacility = { ...facilityAssisted, careTypes: undefined }
  assert.doesNotThrow(() => scoreFacility(badFacility, intakeAssisted))
})

test('scoreFacility handles missing amenities gracefully', () => {
  const noAmenities = { ...facilityAssisted, amenities: undefined }
  assert.doesNotThrow(() => scoreFacility(noAmenities, intakeAssisted))
})

// ── rankFacilities ────────────────────────────────────────────────────────────

test('rankFacilities returns empty array for empty input', () => {
  const result = rankFacilities([], intakeAssisted)
  assert.deepStrictEqual(result, [])
})

test('rankFacilities returns neutral ranking when no intake', () => {
  const result = rankFacilities([facilityAssisted, facilitySkilled], null)
  assert.strictEqual(result.length, 2)
  assert.ok(result.every((r) => r.score === 50))
  assert.ok(result[0].rank === 1)
  assert.ok(result[1].rank === 2)
})

test('rankFacilities assigns rank starting at 1', () => {
  const result = rankFacilities([facilityAssisted, facilitySkilled], intakeAssisted)
  assert.ok(result.length > 0)
  const ranks = result.map((r) => r.rank)
  assert.ok(ranks.includes(1), 'Should include rank 1')
})

test('rankFacilities sorts higher scores first', () => {
  const result = rankFacilities([facilityAssisted, facilitySkilled], intakeAssisted)
  if (result.length >= 2) {
    assert.ok(result[0].score >= result[1].score, 'First result should have higher or equal score')
  }
})

test('rankFacilities each item has facility, score, tags, explanation, rank', () => {
  const result = rankFacilities([facilityAssisted], intakeAssisted)
  assert.ok(result.length > 0)
  const item = result[0]
  assert.ok('facility' in item)
  assert.ok('score' in item)
  assert.ok('tags' in item)
  assert.ok('explanation' in item)
  assert.ok('rank' in item)
})

test('rankFacilities correctly matches assisted-living intake to assisted facility', () => {
  const result = rankFacilities([facilityAssisted, facilitySkilled], intakeAssisted)
  // facilityAssisted has Assisted Living — should score higher
  const assistedResult = result.find((r) => r.facility.id === 1)
  const skilledResult = result.find((r) => r.facility.id === 2)
  if (assistedResult && skilledResult) {
    assert.ok(
      assistedResult.score >= skilledResult.score,
      `Assisted facility (${assistedResult.score}) should score >= skilled (${skilledResult.score}) for assisted intake`
    )
  }
})

test('rankFacilities for memory intake ranks memory care facility higher', () => {
  const memoryIntake = {
    ...intakeAssisted,
    answers: { ...intakeAssisted.answers, care_needs: 'memory', priorities: ['memory_care'] },
  }
  const result = rankFacilities([facilityAssisted, facilitySkilled], memoryIntake)
  const memoryFacilityResult = result.find((r) => r.facility.id === 1)
  const nonMemoryResult = result.find((r) => r.facility.id === 2)
  if (memoryFacilityResult && nonMemoryResult) {
    assert.ok(
      memoryFacilityResult.rank <= nonMemoryResult.rank,
      'Memory care facility should rank higher for memory intake'
    )
  }
})
