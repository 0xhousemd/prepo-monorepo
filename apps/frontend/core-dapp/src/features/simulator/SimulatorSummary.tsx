import { spacingIncrement } from 'prepo-ui'
import styled, { Color } from 'styled-components'
import { Range } from '../../types/market.types'
import { Direction } from '../trade/TradeStore'
import SummaryRecord from '../../components/SummaryRecord'
import Skeleton from '../../components/Skeleton'
import { compactNumber } from '../../utils/number-utils'

type Props = {
  direction: Direction
  payoutRange?: Range
  entryPrice?: number
  exitPrice?: number
  tradeSize?: number
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(8)};
  line-height: 1;
`

const ColoredLabel = styled.span<{ color: keyof Color }>`
  color: ${({ color, theme }): string => theme.color[color]};
`

// the first part computes the position's growth %
// e.g. if enter price is $0.3 and exit at $0.6, position is 200%
// the subtract part computes the pnl in percentage
// e.g. with the $0.3 -> $0.6 example, 200% - 100% -> 100% profit
const getPnlPercentage = (entry?: number, exit?: number): number | undefined => {
  if (entry === undefined || exit === undefined) return undefined
  return (1 / entry) * exit - 1
}

const SimulatorSummary: React.FC<Props> = ({ payoutRange, entryPrice, exitPrice, tradeSize }) => {
  const estimatedPnl = getPnlPercentage(entryPrice, exitPrice)

  const maxProfit = getPnlPercentage(entryPrice, payoutRange?.[1])
  const maxLoss = getPnlPercentage(entryPrice, payoutRange?.[0])

  const renderPnlUI = (
    pnlPercentage?: number,
    options: {
      color?: keyof Color
      prefix?: string
    } = {}
  ): React.ReactNode => {
    const { color, prefix } = options

    if (pnlPercentage === undefined)
      return <ColoredLabel color={color ?? 'success'}>???</ColoredLabel>

    const pnlAmount =
      tradeSize === undefined || tradeSize === 0
        ? ''
        : `(${compactNumber(Math.abs(tradeSize * pnlPercentage), { showUsdSign: true })})`

    return (
      <p>
        <ColoredLabel color={color ?? (pnlPercentage >= 0 ? 'success' : 'error')}>
          {prefix ?? (pnlPercentage >= 0 ? '+' : '-')}
          {(Math.abs(pnlPercentage) * 100).toFixed(2)}%
        </ColoredLabel>{' '}
        {pnlAmount}
      </p>
    )
  }

  return (
    <Wrapper>
      <SummaryRecord label={`Estimated ${(estimatedPnl ?? 0) >= 0 ? 'Profit' : 'Loss'}`}>
        {renderPnlUI(estimatedPnl)}
      </SummaryRecord>
      <SummaryRecord label="Max Profit">
        {renderPnlUI(maxProfit, { color: 'success', prefix: '+' })}
      </SummaryRecord>
      <SummaryRecord label="Max Loss">
        {renderPnlUI(maxLoss, { color: 'error', prefix: '-' })}
      </SummaryRecord>
    </Wrapper>
  )
}
export default SimulatorSummary
