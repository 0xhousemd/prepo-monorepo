import { Box, Button, Flex, Typography } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { Trans } from '@lingui/macro'
import React from 'react'
import { Position } from './Position'
import { useRootStore } from '../../context/RootStoreProvider'
import { Routes } from '../../lib/routes'
import { RecordSkeleton } from '../portfolio/Record'

const Positions: React.FC = () => {
  const { portfolioStore, web3Store } = useRootStore()
  const { userPositions } = portfolioStore
  const { connected } = web3Store

  if (!connected)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} textAlign="center" variant="text-regular-base">
          <Trans>Your wallet is not connected.</Trans>
        </Typography>
      </Flex>
    )

  if (userPositions === undefined)
    return (
      <Box position="relative">
        <RecordSkeleton />
        <RecordSkeleton />
        <RecordSkeleton />
      </Box>
    )

  if (userPositions.length === 0)
    return (
      <Flex p={24} flexDirection="column">
        <Typography color="neutral3" mb={12} variant="text-regular-base">
          <Trans>No position found!</Trans>
        </Typography>
        <Button type="primary" size="sm" href={Routes.Trade}>
          <Trans>Trade Now</Trans>
        </Button>
      </Flex>
    )

  return (
    <Flex position="relative" flexDirection="column" alignItems="start" p={16} gap={16}>
      {userPositions.map((position) => (
        <Position
          direction={position.direction}
          iconName={position.market.iconName}
          marketUrlId={position.market.urlId}
          name={position.market.name}
          totalValue={position.totalValue}
          totalPnl={position.totalPnl}
          growthPercentage={position.positionGrowthPercentage}
          key={position.id}
        />
      ))}
    </Flex>
  )
}

export default observer(Positions)
