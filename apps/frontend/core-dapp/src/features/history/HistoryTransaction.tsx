import React, { useMemo } from 'react'
import { Flex, Icon, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import Link from 'next/link'
import { HistoryTransaction as HistoryTransactionEntity } from './history.types'
import { buttonColors as transactionTypeColors } from './History'
import { numberFormatter } from '../../utils/numberFormatter'
import PositionLabel from '../position/PositionLabel'
import { getDateTimeFromSeconds, getFullDateShortenMonthFromSeconds } from '../../utils/date-utils'
import { useRootStore } from '../../context/RootStoreProvider'
import { PositionName } from '../position/Position'
import { Routes } from '../../lib/routes'

const { toUsd } = numberFormatter

const TransactionName = styled(PositionName).attrs({ as: 'a' })`
  :hover {
    color: ${({ theme }): string => theme.color.primaryLight};
  }
`

const Label = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  margin: 0;
`

const EventLink = styled.a<{ $event: string }>`
  align-items: center;
  background: ${({ $event, theme }): string =>
    theme.color[transactionTypeColors[$event].backgroundColor]};
  border-radius: ${spacingIncrement(8)};
  color: ${({ $event, theme }): string => theme.color[transactionTypeColors[$event].color]};
  display: flex;
  padding: ${spacingIncrement(2)} ${spacingIncrement(8)};
  white-space: nowrap;

  // Extend the color transition that exists globally on anchors
  transition: color 0.3s, background 0.3s;

  :hover {
    background: ${({ theme }): string => theme.color.accentPurple};
    color: ${({ theme }): string => theme.color.primaryLight};
  }
`

type HistoryTransactionProps = {
  historyEvent: HistoryTransactionEntity
}
const HistoryTransaction: React.FC<HistoryTransactionProps> = ({ historyEvent }) => {
  const { web3Store } = useRootStore()
  const { event, eventType, iconName, marketId, name, timestamp, transactionHash, usdValue } =
    historyEvent

  const nameRedirectUrl = useMemo(() => {
    switch (event) {
      case 'Deposited':
        return Routes.Deposit
      case 'Withdrawn':
        return Routes.Withdraw
      default:
        return {
          pathname: Routes.Trade,
          query: { action: event === 'Opened' ? 'open' : 'close', direction: eventType, marketId },
        }
    }
  }, [event, eventType, marketId])

  return (
    <Flex justifyContent="start" gap={8} width="100%">
      <Icon name={iconName} height={spacingIncrement(48)} width={spacingIncrement(48)} />
      <Flex flexDirection="column" alignItems="start">
        <Flex gap={4}>
          <Link href={nameRedirectUrl} passHref>
            <TransactionName>{name}</TransactionName>
          </Link>

          {eventType && <PositionLabel positionType={eventType} />}
        </Flex>
        <Label>{toUsd(usdValue)}</Label>
      </Flex>
      <Flex flexDirection="column" alignItems="end" ml="auto" gap={6}>
        <Link href={web3Store.getBlockExplorerUrl(transactionHash)} passHref>
          <EventLink $event={event} target="_blank" rel="noreferrer noopener nofollow">
            {event} &#x02197;
          </EventLink>
        </Link>
        <Label>{getDateTimeFromSeconds(timestamp)}</Label>
      </Flex>
    </Flex>
  )
}

export default observer(HistoryTransaction)
