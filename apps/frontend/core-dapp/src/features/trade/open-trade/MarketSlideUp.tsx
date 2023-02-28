import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import styled from 'styled-components'
import SlideUpCard from '../SlideUpCard'
import { useRootStore } from '../../../context/RootStoreProvider'
import MarketButton from '../SlideUpButton'
import SlideUpRow from '../SlideUpRow'
import PositionLoadingSkeleton from '../close-trade/PositionLoadingSkeleton'

const SelectedMarket = styled(SlideUpRow)`
  border: none;
  padding: 0;
  :hover {
    background-color: transparent;
  }
`

const MarketSlideUp: React.FC = () => {
  const router = useRouter()
  const { marketStore, tradeStore } = useRootStore()
  const { slideUpContent, selectedMarket, setSlideUpContent } = tradeStore
  const { markets } = marketStore

  const handleSelectMarket = (key: string): void => {
    const tradeUrl = tradeStore.setSelectedMarket(key)
    setSlideUpContent(undefined)
    router.push(tradeUrl)
  }

  // close SlideUp when this component is unmounted (e.g. user leaves page)
  useEffect(
    () => () => {
      setSlideUpContent(undefined)
    },
    [setSlideUpContent]
  )

  return (
    <>
      <MarketButton
        showShadow={!selectedMarket}
        onClick={(): void => setSlideUpContent('OpenMarket')}
      >
        {selectedMarket ? <SelectedMarket market={selectedMarket} /> : 'Select a Market'}
      </MarketButton>
      <SlideUpCard
        show={slideUpContent === 'OpenMarket'}
        onClose={(): void => setSlideUpContent(undefined)}
        title="Select a Market"
      >
        {selectedMarket && (
          <SlideUpRow
            market={selectedMarket}
            onClick={(): void => handleSelectMarket(selectedMarket.urlId)}
            selected
          />
        )}
        {Object.entries(markets)
          .filter(([id, market]) => id !== selectedMarket?.urlId && market.resolved !== true)
          .map(([id, market]) =>
            market.resolved === undefined ? (
              <PositionLoadingSkeleton key={id} />
            ) : (
              <SlideUpRow key={id} market={market} onClick={(): void => handleSelectMarket(id)} />
            )
          )}
      </SlideUpCard>
    </>
  )
}

export default observer(MarketSlideUp)
