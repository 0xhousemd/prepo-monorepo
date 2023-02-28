import styled from 'styled-components'
import { FC } from 'react'
import SummaryRecord from './SummaryRecord'
import { PPOReward } from '../features/definitions'
import { displayEth } from '../utils/number-utils'

const PPORewardAmount = styled.span`
  color: ${({ theme }): string => theme.color.primaryLight};
`

export const PPORewardSummaryRecord: FC<{
  fee: string | undefined
  ppoReward: string | undefined
}> = ({ fee, ppoReward }) => {
  // if reward is undefined, show loading skeleton.
  // if has reward, show reward UI.
  // If no reward, show nothing
  if (ppoReward !== undefined && +ppoReward <= 0) {
    return null
  }

  return (
    <SummaryRecord
      label="PPO Reward"
      loading={ppoReward === undefined || fee === undefined}
      tooltip={<PPOReward />}
    >
      <PPORewardAmount>
        {Intl.NumberFormat(undefined, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 1,
          notation: 'compact',
          signDisplay: 'exceptZero',
        }).format(+(ppoReward ?? '0'))}
      </PPORewardAmount>
      &nbsp; ({displayEth(+(fee ?? 0))})
    </SummaryRecord>
  )
}
