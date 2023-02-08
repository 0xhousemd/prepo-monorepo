import { getFullDateFromMs, getFullStringFromMs } from '../date-utils'

const validUTCMorningTimestamp = 1635143228000
const validUTCNightTimestamp = 1633198815000
const expectedValidUTCMorning = '25th October 2021, 6:27AM'
const expectedValidUTCNight = '2nd October 2021, 6:20PM'

describe('getFullDateFromMs tests', () => {
  it('should return date string given valid timestamp', () => {
    const date = getFullDateFromMs(validUTCMorningTimestamp)
    expect(date).toBe(expectedValidUTCMorning.split(',')[0])
  })
})

describe('getFullStringFromMs tests', () => {
  it('should return time string given valid timestamp', () => {
    const date = getFullStringFromMs(validUTCMorningTimestamp)
    expect(date).toBe(expectedValidUTCMorning)
  })

  it('should return time string in PM given valid night timestamp', () => {
    const date = getFullStringFromMs(validUTCNightTimestamp)
    expect(date).toBe(expectedValidUTCNight)
  })
})
