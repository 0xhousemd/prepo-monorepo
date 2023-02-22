import { observer } from 'mobx-react-lite'
import { Flex } from 'prepo-ui'
import styled from 'styled-components'
import Skeleton from '../../../components/Skeleton'
import SummaryRecord from '../../../components/SummaryRecord'
import { useRootStore } from '../../../context/RootStoreProvider'
import { numberFormatter } from '../../../utils/numberFormatter'
import { EstimatedValuation } from '../../definitions'

const { significantDigits } = numberFormatter

const RedText = styled.span`
  color: ${({ theme }): string => theme.color.error};
`

const OpenTradeSummary: React.FC = () => {
  const { tradeStore } = useRootStore()
  const { withinBounds, tradingValuation, selectedMarket, openTradeAmountBN } = tradeStore

  if (!selectedMarket || openTradeAmountBN === undefined || openTradeAmountBN.eq(0)) return null

  const loading = tradingValuation === undefined || withinBounds === undefined

  const renderValueUI = (): React.ReactNode => {
    if (loading) return <Skeleton height="22px" width="64px" />
    if (!withinBounds) return <RedText>Unprofitable</RedText>
    return `$${significantDigits(tradingValuation)}`
  }

  return (
    <Flex width="100%" px={12} pb={8}>
      <SummaryRecord label="Estimated Price" tooltip={<EstimatedValuation />}>
        {renderValueUI()}
      </SummaryRecord>
    </Flex>
  )
}

export default observer(OpenTradeSummary)
