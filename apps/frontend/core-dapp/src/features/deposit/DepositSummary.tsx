import { Flex } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import Skeleton from '../../components/Skeleton'
import SummaryRecord from '../../components/SummaryRecord'
import { useRootStore } from '../../context/RootStoreProvider'
import { EstimatedReceivedAmount } from '../definitions'
import { PPORewardSummaryRecord } from '../../components/PpoRewardSummaryRecord'
import { displayEth } from '../../utils/number-utils'

const DepositSummary: React.FC = () => {
  const { depositStore } = useRootStore()
  const { depositAmount, estimatedReceivedAmount, ppoReward, depositFees } = depositStore

  // empty input or 0 input
  if (depositAmount === '' || estimatedReceivedAmount === 0) return null

  return (
    <Flex flexDirection="column" gap={8} width="100%" px={12}>
      <SummaryRecord label="Estimated Value" tooltip={<EstimatedReceivedAmount />}>
        {estimatedReceivedAmount === undefined ? (
          <Skeleton height="22px" width="64px" />
        ) : (
          displayEth(estimatedReceivedAmount)
        )}
      </SummaryRecord>

      <PPORewardSummaryRecord fee={depositFees} ppoReward={ppoReward} />
    </Flex>
  )
}

export default observer(DepositSummary)
