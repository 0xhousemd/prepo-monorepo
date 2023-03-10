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
  const {
    insufficientLiquidity,
    withdrawalAmountInEth,
    receivedAmountInEth,
    withdrawalFeesAmount,
    ppoReward,
    ppoRewardValue,
  } = withdrawStore

  // empty input or 0 input
  const emptyInput = withdrawalAmountInEth === '' || +withdrawalAmountInEth === 0
  if (emptyInput || insufficientLiquidity) return null

  return (
    <Flex flexDirection="column" gap={8} width="100%" px={12}>
      <SummaryRecord label="Estimated Amount" tooltip={<EstimatedWithdrawalReceivedAmount />}>
        {receivedAmountInEth === undefined || symbolString === undefined ? (
          <Skeleton height="22px" width="64px" />
        ) : (
          displayEth(receivedAmountInEth)
        )}
      </SummaryRecord>

      <PPORewardSummaryRecord
        fee={withdrawalFeesAmount}
        ppoReward={ppoReward}
        ppoValue={ppoRewardValue}
      />
    </Flex>
  )
}

export default observer(WithdrawSummary)
