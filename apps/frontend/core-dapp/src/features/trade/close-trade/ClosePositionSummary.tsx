import { useMemo } from 'react'
import { Flex } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { useRootStore } from '../../../context/RootStoreProvider'
import SummaryRecord from '../../../components/SummaryRecord'
import { EstimateYourProfitLoss, EstimatedValuation } from '../../definitions'
import { compactNumber } from '../../../utils/number-utils'

const Profit = styled.span`
  color: ${({ theme }): string => theme.color.success};
`

const Loss = styled.span`
  color: ${({ theme }): string => theme.color.error};
`

const ClosePositionSummary: React.FC = () => {
  const { tradeStore } = useRootStore()
  const {
    closePositionValue,
    closePositionValueBN,
    closePositionValueByCostBasis,
    selectedPosition,
    closePositionValuation,
    closePositionPnlAmount,
    insufficientBalanceForClosePosition,
    selectedMarket,
  } = tradeStore

  const isMarketResolved = !!selectedMarket?.resolved

  const pnlText = useMemo(() => {
    // this line is only to get pass type check
    // the returned value doesn't matter because
    // SummaryRecord will show loading skeleton when closePositionPnlAmount is undefined
    if (closePositionPnlAmount === undefined || closePositionValueByCostBasis === undefined)
      return ''

    const pnlPercentage = (closePositionPnlAmount / closePositionValueByCostBasis) * 100

    if (pnlPercentage >= 0) return <Profit>+{pnlPercentage.toFixed(2)}%</Profit>

    return <Loss>{pnlPercentage.toFixed(2)}%</Loss>
  }, [closePositionPnlAmount, closePositionValueByCostBasis])

  if (!selectedPosition || closePositionValue === '' || closePositionValueBN?.eq(0)) return null

  const loadingPnl =
    closePositionPnlAmount === undefined ||
    selectedPosition.totalValueBN === undefined ||
    insufficientBalanceForClosePosition === undefined

  // Only show PNL if user has a position and sufficient balance, otherwise it will always be inaccurate because costBasis is 0
  const showPnL = selectedPosition.totalValueBN?.gt(0) && !insufficientBalanceForClosePosition

  return (
    <Flex width="100%" flexDirection="column" px={12} pb={8} gap={4}>
      <SummaryRecord
        label={isMarketResolved ? 'Final Price' : 'Estimated Price'}
        loading={closePositionValuation === undefined}
        tooltip={isMarketResolved ? undefined : <EstimatedValuation />}
      >
        ${closePositionValuation === undefined ? '' : compactNumber(closePositionValuation)}
      </SummaryRecord>
      {showPnL && (
        <SummaryRecord
          label={isMarketResolved ? 'PnL' : 'Estimated PnL'}
          loading={loadingPnl}
          tooltip={isMarketResolved ? undefined : <EstimateYourProfitLoss />}
        >
          {pnlText}&nbsp;(${compactNumber(Math.abs(closePositionPnlAmount ?? 0))})
        </SummaryRecord>
      )}
    </Flex>
  )
}

export default observer(ClosePositionSummary)
