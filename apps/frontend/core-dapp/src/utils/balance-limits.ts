import { BigNumber, utils } from 'ethers'

export type BalanceLimitInfo =
  | {
      status: 'loading'
    }
  | {
      status: 'not-exceeded' | 'already-exceeded' | 'exceeded-after-transfer'
      amountEth: string
      capEth: string
      remainingEth: string
    }

export function getBalanceLimitInfo({
  additionalAmount,
  cap,
  currentAmount,
}: {
  additionalAmount: BigNumber | undefined
  cap: BigNumber | undefined
  currentAmount: BigNumber | undefined
}): BalanceLimitInfo {
  if (currentAmount === undefined || cap === undefined || additionalAmount === undefined) {
    return { status: 'loading' }
  }

  const amountEth = utils.formatEther(currentAmount)
  const capEth = utils.formatEther(cap)

  const remainingAmount = cap.sub(currentAmount)
  const remainingEth = utils.formatEther(
    remainingAmount.gte(0) ? remainingAmount : BigNumber.from(0)
  )

  if (amountEth === undefined || capEth === undefined || remainingEth === undefined) {
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
    amountEth,
    capEth,
    remainingEth,
    status,
  }
}
