import { describe, expect, it } from 'vitest'
import {
  LONG_TEXT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  parseMedicationInput,
  parseTraumaInput,
} from './medical-history'

const validMedication = {
  name: ' Sertraline ',
  dosage: '50 mg',
  frequency: 'Daily',
  startDate: '2026-01-01',
}

describe('parseMedicationInput', () => {
  it('trims text, parses dates and defaults optional fields to null', () => {
    expect(parseMedicationInput(validMedication)).toEqual({
      name: 'Sertraline',
      dosage: '50 mg',
      frequency: 'Daily',
      prescriber: null,
      startDate: new Date('2026-01-01'),
      endDate: null,
      notes: null,
    })
  })

  it('rejects a non-object body', () => {
    expect(() => parseMedicationInput(null)).toThrow(/Invalid request body/)
    expect(() => parseMedicationInput(['x'])).toThrow(/Invalid request body/)
  })

  it('requires name, dosage, frequency and start date', () => {
    expect(() => parseMedicationInput({ ...validMedication, name: '   ' })).toThrow(
      /Name is required/
    )
    expect(() => parseMedicationInput({ ...validMedication, dosage: undefined })).toThrow(
      /Dosage is required/
    )
    expect(() => parseMedicationInput({ ...validMedication, frequency: 3 })).toThrow(
      /Frequency is required/
    )
    expect(() => parseMedicationInput({ ...validMedication, startDate: '' })).toThrow(
      /Start date is required/
    )
  })

  it('rejects invalid dates', () => {
    expect(() => parseMedicationInput({ ...validMedication, startDate: 'not a date' })).toThrow(
      /Start date must be a valid date/
    )
    expect(() => parseMedicationInput({ ...validMedication, endDate: 12345 })).toThrow(
      /End date must be a valid date/
    )
  })

  it('rejects an end date before the start date', () => {
    expect(() => parseMedicationInput({ ...validMedication, endDate: '2025-12-31' })).toThrow(
      /End date cannot be before start date/
    )
  })

  it('accepts an end date on the start date', () => {
    const result = parseMedicationInput({ ...validMedication, endDate: '2026-01-01' })
    expect(result.endDate).toEqual(new Date('2026-01-01'))
  })

  it('caps text lengths', () => {
    expect(() =>
      parseMedicationInput({ ...validMedication, name: 'a'.repeat(SHORT_TEXT_MAX_LENGTH + 1) })
    ).toThrow(/Name must be at most 200 characters/)
    expect(() =>
      parseMedicationInput({ ...validMedication, notes: 'a'.repeat(LONG_TEXT_MAX_LENGTH + 1) })
    ).toThrow(/Notes must be at most 2000 characters/)
    const notes = 'a'.repeat(LONG_TEXT_MAX_LENGTH)
    expect(parseMedicationInput({ ...validMedication, notes }).notes).toBe(notes)
  })

  it('stores blank optional text as null', () => {
    const result = parseMedicationInput({ ...validMedication, prescriber: '  ', notes: '' })
    expect(result.prescriber).toBeNull()
    expect(result.notes).toBeNull()
  })

  it('ignores proof fields', () => {
    const result = parseMedicationInput({
      ...validMedication,
      proofPath: '/etc/passwd',
      proofName: 'x.pdf',
    })
    expect(result).not.toHaveProperty('proofPath')
    expect(result).not.toHaveProperty('proofName')
  })

  describe('with a current record (PATCH)', () => {
    const current = parseMedicationInput({ ...validMedication, endDate: '2026-03-01' })

    it('keeps fields the body leaves out', () => {
      expect(parseMedicationInput({ dosage: '100 mg' }, current)).toEqual({
        ...current,
        dosage: '100 mg',
      })
    })

    it('clears an optional field sent as null', () => {
      expect(parseMedicationInput({ endDate: null }, current).endDate).toBeNull()
    })

    it('rejects clearing a required field', () => {
      expect(() => parseMedicationInput({ name: '' }, current)).toThrow(/Name is required/)
    })

    it('checks date order against the stored dates', () => {
      expect(() => parseMedicationInput({ startDate: '2026-04-01' }, current)).toThrow(
        /End date cannot be before start date/
      )
    })
  })
})

describe('parseTraumaInput', () => {
  const validTrauma = { category: ' Accident ', description: ' Car crash ' }

  it('trims text and defaults the date to null', () => {
    expect(parseTraumaInput(validTrauma)).toEqual({
      category: 'Accident',
      description: 'Car crash',
      approximateDate: null,
    })
  })

  it('requires category and description', () => {
    expect(() => parseTraumaInput({ ...validTrauma, category: '' })).toThrow(/Category is required/)
    expect(() => parseTraumaInput({ ...validTrauma, description: undefined })).toThrow(
      /Description is required/
    )
  })

  it('caps text lengths', () => {
    expect(() =>
      parseTraumaInput({ ...validTrauma, category: 'a'.repeat(SHORT_TEXT_MAX_LENGTH + 1) })
    ).toThrow(/Category must be at most 200 characters/)
    expect(() =>
      parseTraumaInput({ ...validTrauma, description: 'a'.repeat(LONG_TEXT_MAX_LENGTH + 1) })
    ).toThrow(/Description must be at most 2000 characters/)
  })

  it('accepts a past date and rejects a future one', () => {
    expect(
      parseTraumaInput({ ...validTrauma, approximateDate: '2020-06-01' }).approximateDate
    ).toEqual(new Date('2020-06-01'))
    expect(() => parseTraumaInput({ ...validTrauma, approximateDate: '2999-01-01' })).toThrow(
      /Approximate date cannot be in the future/
    )
    expect(() => parseTraumaInput({ ...validTrauma, approximateDate: 'soon' })).toThrow(
      /Approximate date must be a valid date/
    )
  })

  it('keeps fields the body leaves out when patching', () => {
    const current = parseTraumaInput({ ...validTrauma, approximateDate: '2020-06-01' })
    expect(parseTraumaInput({ category: 'Loss' }, current)).toEqual({
      ...current,
      category: 'Loss',
    })
  })
})
