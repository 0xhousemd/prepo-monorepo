import { BigNumber } from 'ethers'

export type BalanceLimitInfo =
  | {
      status: 'loading'
    }
  | {
      status: 'not-exceeded' | 'already-exceeded' | 'exceeded-after-transfer'
      amountUnits: string
      capUnits: string
      remainingUnits: string
    }

export function getBalanceLimitInfo({
  additionalAmount,
  cap,
  currentAmount,
  formatUnits,
}: {
  additionalAmount: BigNumber | undefined
  cap: BigNumber | undefined
  currentAmount: BigNumber | undefined
  formatUnits: (value: BigNumber) => string | undefined
}): BalanceLimitInfo {
  if (currentAmount === undefined || cap === undefined || additionalAmount === undefined) {
    return { status: 'loading' }
  }

  const amountUnits = formatUnits(currentAmount)
  const capUnits = formatUnits(cap)

  const remainingAmount = cap.sub(currentAmount)
  const remainingUnits = formatUnits(remainingAmount.gte(0) ? remainingAmount : BigNumber.from(0))

  if (amountUnits === undefined || capUnits === undefined || remainingUnits === undefined) {
    return { status: 'loading' }
  }

  let status: 'already-exceeded' | 'not-exceeded' | 'exceeded-after-transfer'

  if (currentAmount.gte(cap)) {
    status = 'already-exceeded'
  } else if (currentAmount.add(additionalAmount).gt(cap)) {
    status = 'exceeded-after-transfer'
  } else {
    status = 'not-exceeded'
  }

  return {
    amountUnits,
    capUnits,
    remainingUnits,
    status,
  }
}
