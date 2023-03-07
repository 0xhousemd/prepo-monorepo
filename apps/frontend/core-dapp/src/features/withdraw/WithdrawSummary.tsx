import { Flex } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import Skeleton from '../../components/Skeleton'
import SummaryRecord from '../../components/SummaryRecord'
import { useRootStore } from '../../context/RootStoreProvider'
import { EstimatedWithdrawalReceivedAmount } from '../definitions'
import { PPORewardSummaryRecord } from '../../components/PpoRewardSummaryRecord'
import { displayEth } from '../../utils/number-utils'

const WithdrawSummary: React.FC = () => {
  const { baseTokenStore, withdrawStore } = useRootStore()
  const { symbolString } = baseTokenStore
  const { withdrawalAmountInEth, receivedAmountInEth, withdrawalFeesAmount, ppoReward } =
    withdrawStore

  // empty input or 0 input
  if (withdrawalAmountInEth === '' || +withdrawalAmountInEth === 0) return null

  return (
    <Flex flexDirection="column" gap={8} width="100%" px={12}>
      <SummaryRecord label="Received Amount" tooltip={<EstimatedWithdrawalReceivedAmount />}>
        {receivedAmountInEth === undefined || symbolString === undefined ? (
          <Skeleton height="22px" width="64px" />
        ) : (
          displayEth(receivedAmountInEth)
        )}
      </SummaryRecord>

      <PPORewardSummaryRecord fee={withdrawalFeesAmount} ppoReward={ppoReward} />
    </Flex>
  )
}

export default observer(WithdrawSummary)
