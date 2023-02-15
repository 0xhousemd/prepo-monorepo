import { Trans } from '@lingui/macro'
import { observer } from 'mobx-react-lite'
import { Box, Flex, Typography } from 'prepo-ui'
import HistoryTransaction from './HistoryTransaction'
import { useRootStore } from '../../context/RootStoreProvider'
import { RecordSkeleton } from '../portfolio/Record'

const History: React.FC = () => {
  const {
    portfolioStore: { historicalEvents },
    web3Store,
  } = useRootStore()
  const { connected } = web3Store

  if (!connected)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} textAlign="center" variant="text-regular-base">
          <Trans>Your wallet is not connected.</Trans>
        </Typography>
      </Flex>
    )

  if (historicalEvents === undefined)
    return (
      <Box>
        <RecordSkeleton />
        <RecordSkeleton />
        <RecordSkeleton />
      </Box>
    )

  if (historicalEvents.length === 0)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} variant="text-regular-base">
          <Trans>No transaction history.</Trans>
        </Typography>
      </Flex>
    )

  return (
    <Flex position="relative" flexDirection="column" alignItems="start" p={16} gap={16}>
      {historicalEvents.map((historyEvent) => (
        <HistoryTransaction historyEvent={historyEvent} key={historyEvent.marketId} />
      ))}
    </Flex>
  )
}

export default observer(History)
