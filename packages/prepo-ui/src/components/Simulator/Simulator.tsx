import { useMemo, useRef, useState, useEffect } from 'react'
import { calculateValuation } from 'prepo-utils'
import styled, { useTheme } from 'styled-components'
import { getPositionFromPayoutRange } from './utils'
import Handle from './Handle'
import { spacingIncrement } from '../../common-utils'

type Range = [number, number]

const formatValuation = (valuation: number): string =>
  Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(valuation)

export type SimulatorDataProps = {
  valuationRange: Range
  payoutRange: Range
}

export type SimulatorProps = {
  data?: SimulatorDataProps
  direction: 'long' | 'short'
  entryPrice?: number
  exitPrice?: number
  onChangeEntry?: (price: number) => void
  onChangeExit?: (price: number) => void
}

const Wrapper = styled.div`
  padding: ${spacingIncrement(54)} ${spacingIncrement(28)};
  width: 100%;
`

const Track = styled.div`
  background-color: ${({ theme }): string => theme.color.neutral8};
  border-radius: ${spacingIncrement(10)};
  height: ${spacingIncrement(10)};
  position: relative;
  width: 100%;
`

const TrackProgress = styled.div`
  border: solid 2px ${({ theme }): string => theme.color.neutral7};
  border-radius: ${spacingIncrement(10)};
  height: 100%;
  position: absolute;
`

const Simulator: React.FC<SimulatorProps> = ({
  data,
  direction,
  entryPrice: defaultEntryPrice,
  exitPrice: defaultExitPrice,
  onChangeEntry,
  onChangeExit,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const { color } = useTheme()

  // value between 0 - 1 to represent position/offset on slider.
  const [entryX, setEntryX] = useState<number>()
  const [exitX, setExitX] = useState<number>()

  const [trackWidth, setTrackWidth] = useState<number>()

  // map position/offset to payout range to get token price
  const mapPositionToPrice = (position: number | undefined): number | undefined => {
    if (!data || position === undefined) return undefined
    const { payoutRange } = data
    return position * (payoutRange[1] - payoutRange[0]) + payoutRange[0]
  }

  const getValuationForPrice = (longTokenPrice: number | undefined): number | undefined => {
    if (!data || longTokenPrice === undefined) return undefined
    const { payoutRange, valuationRange } = data
    return calculateValuation({ longTokenPrice, payoutRange, valuationRange })
  }

  const handleEntryChange = (x: number): void => {
    if (trackWidth !== undefined && data) {
      const position = x / trackWidth
      setEntryX(position)
      const price = mapPositionToPrice(position)
      if (onChangeEntry && price !== undefined)
        onChangeEntry(direction === 'short' ? 1 - price : price)
    }
  }

  const handleExitChange = (x: number): void => {
    if (trackWidth !== undefined && data) {
      const position = x / trackWidth
      setExitX(position)
      const price = mapPositionToPrice(position)
      if (onChangeExit && price !== undefined)
        onChangeExit(direction === 'short' ? 1 - price : price)
    }
  }

  // takes care of syncing the entry handle
  useEffect(() => {
    if (data && defaultEntryPrice !== undefined) {
      const { payoutRange } = data

      // always use long token price to get valuation
      const longTokenPrice = direction === 'short' ? 1 - defaultEntryPrice : defaultEntryPrice
      setEntryX(getPositionFromPayoutRange(payoutRange, longTokenPrice))
    } else {
      setEntryX(undefined)
    }
  }, [data, defaultEntryPrice, direction])

  // takes care of syncing the exit handle
  useEffect(() => {
    if (data && defaultExitPrice !== undefined) {
      const { payoutRange } = data

      // always use long token price to get valuation
      const longTokenPrice = direction === 'short' ? 1 - defaultExitPrice : defaultExitPrice
      setExitX(getPositionFromPayoutRange(payoutRange, longTokenPrice))
    } else {
      setExitX(undefined)
    }
  }, [data, defaultExitPrice, direction])

  useEffect(() => {
    const handleTrackResize = (): void => {
      if (trackRef.current) setTrackWidth(trackRef.current.clientWidth)
    }

    handleTrackResize()
    const ro = new ResizeObserver(handleTrackResize)
    if (trackRef.current) ro.observe(trackRef.current)

    return () => {
      ro.disconnect()
    }
  }, [])

  const entryPrice = mapPositionToPrice(entryX)
  const exitPrice = mapPositionToPrice(exitX)

  const entryValuation = getValuationForPrice(entryPrice)
  const exitValuation = getValuationForPrice(exitPrice)

  const trackBarPosition = useMemo(() => {
    if (trackWidth === undefined) return {}

    if (
      entryValuation === undefined ||
      exitValuation === undefined ||
      entryX === undefined ||
      exitX === undefined
    )
      return { left: 0, right: 0 }
    // compute the left, right of track's colored bar
    const left = Math.min(entryX, exitX) * trackWidth
    const right = trackWidth - Math.max(entryX, exitX) * trackWidth

    return { left, right }
  }, [entryValuation, entryX, exitValuation, exitX, trackWidth])

  const dynamicColor = useMemo(() => {
    // compute background color of track bar
    // default to green
    if (
      entryValuation === undefined ||
      exitValuation === undefined ||
      entryX === undefined ||
      exitX === undefined
    )
      return 'success'
    const profitableExit = direction === 'short' ? entryX >= exitX : exitX >= entryX

    return profitableExit ? 'success' : 'error'
  }, [direction, entryValuation, entryX, exitValuation, exitX])

  const hasData = entryX !== undefined && exitX !== undefined

  const defaultEntry = direction === 'long' ? 0 : 1

  const defaultExit = direction === 'long' ? 1 : 0

  return (
    <Wrapper>
      <Track ref={trackRef}>
        {trackWidth !== undefined && (
          <>
            <TrackProgress style={{ ...trackBarPosition, backgroundColor: color[dynamicColor] }} />
            <Handle
              x={(hasData ? entryX : defaultEntry) * trackWidth}
              disabled={!hasData}
              isEntry
              color="secondary"
              value={
                !hasData || entryValuation === undefined || Number.isNaN(entryValuation)
                  ? '???'
                  : `$${formatValuation(entryValuation)}`
              }
              onChange={handleEntryChange}
            />
            <Handle
              // exit handle defaults to the right of slider when undefined (indicate max profit)
              x={(hasData ? exitX : defaultExit) * trackWidth}
              disabled={!hasData}
              color={dynamicColor}
              value={
                !hasData || exitValuation === undefined || Number.isNaN(exitValuation)
                  ? '???'
                  : `$${formatValuation(exitValuation)}`
              }
              onChange={handleExitChange}
            />
          </>
        )}
      </Track>
    </Wrapper>
  )
}

export default Simulator
