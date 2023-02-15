import { Trans } from '@lingui/macro'
import { observer } from 'mobx-react-lite'
import { Flex, Typography } from 'prepo-ui'
import HistoryTransaction, { HistoryTransactionSkeleton } from './HistoryTransaction'
import { useRootStore } from '../../context/RootStoreProvider'

const History: React.FC = () => {
  const {
    portfolioStore: { historicalEvents },
  } = useRootStore()

  if (historicalEvents?.length === 0)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} variant="text-regular-base">
          <Trans>No transaction history.</Trans>
        </Typography>
      </Flex>
    )

  return (
    <Flex position="relative" flexDirection="column" alignItems="start" p={16} gap={16}>
      {historicalEvents ? (
        historicalEvents.map((historyEvent) => (
          <HistoryTransaction historyEvent={historyEvent} key={historyEvent.marketId} />
        ))
      ) : (
        <>
          <HistoryTransactionSkeleton />
          <HistoryTransactionSkeleton />
          <HistoryTransactionSkeleton />
        </>
      )}
    </Flex>
  )
}

export default observer(History)
