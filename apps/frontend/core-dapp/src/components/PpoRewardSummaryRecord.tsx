import styled from 'styled-components'
import { FC } from 'react'
import { Icon, spacingIncrement } from 'prepo-ui'
import SummaryRecord from './SummaryRecord'
import { PPOReward } from '../features/definitions'
import { displayEth } from '../utils/number-utils'

const PPORewardAmountWrapper = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(4)};
  justify-content: center;
`

const PPORewardAmount = styled.p`
  color: ${({ theme }): string => theme.color.primaryLight};
  white-space: nowrap;
`

const Wrapper = styled.div`
  column-gap: ${spacingIncrement(4)};
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
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
      label="Estimated Rewards"
      loading={ppoReward === undefined || fee === undefined}
      tooltip={<PPOReward />}
    >
      <Wrapper>
        <PPORewardAmountWrapper>
          <PPORewardAmount>
            {Intl.NumberFormat(undefined, {
              maximumFractionDigits: 2,
              minimumFractionDigits: 1,
              notation: 'compact',
              signDisplay: 'exceptZero',
            }).format(+(ppoReward ?? '0'))}
          </PPORewardAmount>
          <Icon name="ppo-logo" height="12" width="12" />
        </PPORewardAmountWrapper>
        <p>({displayEth(+(fee ?? 0))})</p>
      </Wrapper>
    </SummaryRecord>
  )
}
