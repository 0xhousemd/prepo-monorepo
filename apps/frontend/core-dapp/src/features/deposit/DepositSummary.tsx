import { Flex } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import Skeleton from '../../components/Skeleton'
import SummaryRecord from '../../components/SummaryRecord'
import { useRootStore } from '../../context/RootStoreProvider'
import { EstimatedReceivedAmount, PPOReward } from '../definitions'
import { numberFormatter } from '../../utils/numberFormatter'

const { toUsd } = numberFormatter

const PPORewardAmount = styled.span`
  color: ${({ theme }): string => theme.color.primaryLight};
`

const DepositSummary: React.FC = () => {
  const { depositStore } = useRootStore()
  const { depositAmount, estimatedReceivedAmount, ppoReward, depositFees } = depositStore

  // empty input or 0 input
  if (depositAmount === '' || estimatedReceivedAmount === 0) return null

  return (
    <Flex flexDirection="column" gap={8} width="100%" px={12}>
      <SummaryRecord label="Estimated Received Amount" tooltip={<EstimatedReceivedAmount />}>
        {estimatedReceivedAmount === undefined ? (
          <Skeleton height="22px" width="64px" />
        ) : (
          `$${Intl.NumberFormat(undefined, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          }).format(estimatedReceivedAmount)}`
        )}
      </SummaryRecord>

      {/*
        if reward is undefined, show loading skeleton.
        if has reward, show reward UI.
        If no reward, show nothing
      */}
      {(ppoReward === undefined || +ppoReward > 0) && (
        <SummaryRecord
          label="PPO Reward"
          loading={ppoReward === undefined || depositFees === undefined}
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
          &nbsp; ({toUsd(depositFees ?? '0')})
        </SummaryRecord>
      )}
    </Flex>
  )
}

export default observer(DepositSummary)
