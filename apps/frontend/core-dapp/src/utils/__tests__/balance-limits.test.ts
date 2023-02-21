import { BigNumber } from 'ethers'
import { getBalanceLimitInfo } from '../balance-limits'

describe('getBalanceLimitInfo', () => {
  const formatUnits = (value: BigNumber): string => value.toString()

  describe('not-exceeded', () => {
    it('returns not-exceeded if current amount plus additional amount is less than or equal to the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: BigNumber.from(25),
        cap: BigNumber.from(100),
        currentAmount: BigNumber.from(50),
        formatUnits,
      })

      if (result.status !== 'not-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountUnits).toBe('50')
      expect(result.capUnits).toBe('100')
      expect(result.remainingUnits).toBe('50')
    })
  })

  describe('already-exceeded', () => {
    it('returns already-exceeded if current amount is greater than the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: BigNumber.from(0),
        cap: BigNumber.from(100),
        currentAmount: BigNumber.from(120),
        formatUnits,
      })

      if (result.status !== 'already-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountUnits).toBe('120')
      expect(result.capUnits).toBe('100')
      expect(result.remainingUnits).toBe('0')
    })

    it('returns already-exceeded if current amount is equal to the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: BigNumber.from(0),
        cap: BigNumber.from(100),
        currentAmount: BigNumber.from(100),
        formatUnits,
      })

      if (result.status !== 'already-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountUnits).toBe('100')
      expect(result.capUnits).toBe('100')
      expect(result.remainingUnits).toBe('0')
    })

    it('returns already-exceeded if current amount is equal to the cap and additional amount is greater than zero', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: BigNumber.from(25),
        cap: BigNumber.from(100),
        currentAmount: BigNumber.from(100),
        formatUnits,
      })

      if (result.status !== 'already-exceeded') {
        throw new Error('Invalid status')
      }

      expect(result.amountUnits).toBe('100')
      expect(result.capUnits).toBe('100')
      expect(result.remainingUnits).toBe('0')
    })
  })

  describe('exceeded-after-transfer', () => {
    it('returns exceeded-after-transfer if current amount plus additional amount is greater than the cap', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: BigNumber.from(25),
        cap: BigNumber.from(100),
        currentAmount: BigNumber.from(80),
        formatUnits,
      })

      if (result.status !== 'exceeded-after-transfer') {
        throw new Error('Invalid status')
      }

      expect(result.amountUnits).toBe('80')
      expect(result.capUnits).toBe('100')
      expect(result.remainingUnits).toBe('20')
    })
  })

  describe('loading', () => {
    it('should return loading when any parameter is undefined', () => {
      const result = getBalanceLimitInfo({
        additionalAmount: BigNumber.from(50),
        cap: undefined,
        currentAmount: BigNumber.from(100),
        formatUnits,
      })

      expect(result.status).toEqual('loading')
    })
  })
})
