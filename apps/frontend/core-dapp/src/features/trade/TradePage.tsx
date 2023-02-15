import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import CloseTrade from './close-trade'
import OpenTrade from './open-trade'
import useTradePage from './useTradePage'
import TradePageTab from './TradePageTab'
import MarketChart from './market-chart'
import TradeSettings from './TradeSettings'
import Simulator from '../simulator'
import Card from '../../components/Card'
import { isProduction } from '../../utils/isProduction'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  margin: auto;
  max-width: ${spacingIncrement(380)};
  position: relative;
  width: 100%;
`
const TradeCard = styled(Card)`
  position: relative;
  width: 100%;
  &&& {
    .ant-card-body {
      min-height: ${spacingIncrement(240)};
      padding: 0;
    }
  }
`

const TradePage: React.FC = () => {
  useTradePage()
  const { tradeStore } = useRootStore()
  const { action } = tradeStore
  const isProd = isProduction()

  return (
    <Wrapper>
      <TradeCard>
        {!isProd && <TradePageTab />}
        {/** only show close trade flow if open/close tabs are shown */}
        {!isProd && action === 'close' ? <CloseTrade /> : <OpenTrade />}
        <TradeSettings />
      </TradeCard>
      {!isProd && <Simulator />}
      <MarketChart />
    </Wrapper>
  )
}

export default observer(TradePage)
