import { Button, Simulator, media, spacingIncrement } from 'prepo-ui'
import { useState, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import Card from '../../components/Card'
import { useRootStore } from '../../context/RootStoreProvider'

const ResetButton = styled(Button).attrs({ size: 'xs', type: 'ghost' })`
  &&& {
    .ant-btn {
      background-color: ${({ theme }): string => theme.color.purpleStroke};
      border: none;
      border-radius: ${({ theme }): string => theme.borderRadius['3xs']};
      color: ${({ theme }): string => theme.color.primaryLight};
    }
  }
`

const Wrapper = styled(Card)`
  .ant-card-body {
    display: flex;
    flex-direction: column;
    gap: ${spacingIncrement(18)};
    :after,
    :before {
      display: none;
    }
  }
  width: 100%;
  ${media.largeDesktop`
    right: ${spacingIncrement(-16)};
    position: absolute;
    top: ${spacingIncrement(58)};
    transform: translateX(100%);
    width: ${spacingIncrement(264)};
  `}
`

const Header = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`

const Title = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const SimulatorWrapper = styled.div`
  align-items: center;
  border: 1px solid ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  display: flex;
  justify-content: center;
  min-height: ${spacingIncrement(136)};
  padding: ${spacingIncrement(8)} ${spacingIncrement(4)};
`

const TradeSimulator: React.FC = () => {
  const { tradeStore, web3Store } = useRootStore()
  const { action, openTradePrice, selectedPosition } = tradeStore
  const { connected } = web3Store
  const [entryPrice, setEntryPrice] = useState<number>()
  const [exitPrice, setExitPrice] = useState<number>()
  const [isEntryPriceDirty, setIsEntryPriceDirty] = useState(false)
  const [isExitPriceDirty, setIsExitPriceDirty] = useState(false)

  // for closing, show max profit scenario if user's position is empty
  const emptyPosition =
    selectedPosition?.costBasis !== undefined && selectedPosition?.costBasis <= 0

  // compute prices to sync to
  const marketEntryPrice = useMemo(() => {
    if (action === 'open') return openTradePrice
    if (!connected || emptyPosition) return selectedPosition?.price
    return selectedPosition?.costBasis
  }, [
    action,
    connected,
    emptyPosition,
    openTradePrice,
    selectedPosition?.costBasis,
    selectedPosition?.price,
  ])

  const marketExitPrice = useMemo(() => {
    if (action === 'open' || !connected || emptyPosition)
      return selectedPosition?.market.payoutRange?.[1]

    // TODO: sync close price after close position summary PR is merged
    // (currently using default position price instead of the price that is based on input)
    return selectedPosition?.price
  }, [
    action,
    connected,
    emptyPosition,
    selectedPosition?.market.payoutRange,
    selectedPosition?.price,
  ])

  // reset handles on simulator when:
  // - switch between open <> close
  // - change direction
  useEffect(() => {
    setIsEntryPriceDirty(false)
    setIsExitPriceDirty(false)
    setEntryPrice(undefined)
    setExitPrice(undefined)
  }, [action, selectedPosition])

  // handles syncing of entry price
  useEffect(() => {
    if (!isEntryPriceDirty && marketEntryPrice !== undefined && !Number.isNaN(marketEntryPrice))
      setEntryPrice(marketEntryPrice)
  }, [entryPrice, isEntryPriceDirty, marketEntryPrice])

  // handles syncing of exit price
  useEffect(() => {
    if (!isExitPriceDirty && marketExitPrice !== undefined) setExitPrice(marketExitPrice)
  }, [exitPrice, isExitPriceDirty, marketExitPrice])

  const handleEntryChange = (price: number): void => {
    setIsEntryPriceDirty(true)
    setEntryPrice(price)
  }

  const handleExitChange = (price: number): void => {
    setIsExitPriceDirty(true)
    setExitPrice(price)
  }

  const handleReset = (): void => {
    setIsEntryPriceDirty(false)
    setIsExitPriceDirty(false)
  }

  let simulatorData
  if (selectedPosition && selectedPosition.market) {
    const { valuationRange, payoutRange } = selectedPosition.market
    // only show valuation on simulator if all necessary values are loaded
    if (valuationRange && payoutRange) simulatorData = { valuationRange, payoutRange }
  }

  return (
    <Wrapper>
      <Header>
        <Title>Profit Simulator</Title>
        {(isEntryPriceDirty || isExitPriceDirty) && (
          <ResetButton onClick={handleReset}>Reset</ResetButton>
        )}
      </Header>
      <SimulatorWrapper>
        <Simulator
          data={simulatorData}
          direction={selectedPosition?.direction ?? 'long'}
          entryPrice={entryPrice}
          exitPrice={exitPrice}
          onChangeExit={handleExitChange}
          onChangeEntry={handleEntryChange}
        />
      </SimulatorWrapper>
    </Wrapper>
  )
}
export default observer(TradeSimulator)
