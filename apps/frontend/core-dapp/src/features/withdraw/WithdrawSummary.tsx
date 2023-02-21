import { Flex } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import Skeleton from '../../components/Skeleton'
import SummaryRecord from '../../components/SummaryRecord'
import { useRootStore } from '../../context/RootStoreProvider'
import { EstimatedWithdrawalReceivedAmount } from '../definitions'
import { PPORewardSummaryRecord } from '../../components/PpoRewardSummaryRecord'

const WithdrawSummary: React.FC = () => {
  const { baseTokenStore, withdrawStore } = useRootStore()
  const { symbolString } = baseTokenStore
  const { withdrawalAmount, receivedAmount, withdrawalFee, withdrawalFeesAmount, ppoReward } =
    withdrawStore

  // empty input or 0 input
  if (withdrawalAmount === '' || +withdrawalAmount === 0) return null

  return (
    <Flex flexDirection="column" gap={8} width="100%" px={12}>
      <SummaryRecord
        label="Received Amount"
        tooltip={
          withdrawalFee !== undefined && withdrawalFee > 0 ? (
            <EstimatedWithdrawalReceivedAmount fee={withdrawalFee} />
          ) : undefined
        }
      >
        {receivedAmount === undefined || symbolString === undefined ? (
          <Skeleton height="22px" width="64px" />
        ) : (
          `${Intl.NumberFormat(undefined, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          }).format(receivedAmount)} ${symbolString}`
        )}
      </SummaryRecord>

      <PPORewardSummaryRecord fee={withdrawalFeesAmount} ppoReward={ppoReward} />
    </Flex>
  )
}

export default observer(WithdrawSummary)
