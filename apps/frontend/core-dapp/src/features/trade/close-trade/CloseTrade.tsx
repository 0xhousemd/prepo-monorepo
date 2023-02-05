import { observer } from 'mobx-react-lite'
import { CurrencyInput, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import ClosePositionButton from './ClosePositionButton'
import PositionsSlideUp from './PositionsSlideUp'
import { useRootStore } from '../../../context/RootStoreProvider'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  min-height: ${spacingIncrement(324)};
  padding: ${spacingIncrement(8)};
  width: 100%;
`

const CloseTrade: React.FC = () => {
  const { tradeStore, web3Store } = useRootStore()
  const { connected } = web3Store
  const { closingPosition, closePositionValue, selectedPosition } = tradeStore

  return (
    <Wrapper>
      <PositionsSlideUp />
      <CurrencyInput
        balance={selectedPosition?.totalValue}
        currency={{ icon: 'cash', text: 'USD' }}
        disabled={!selectedPosition || !connected || closingPosition}
        isBalanceZero={selectedPosition?.totalValueBN?.eq(0)}
        onChange={tradeStore.setClosePositionValue}
        showBalance
        value={closePositionValue}
      />
      <ClosePositionButton />
      <p>TODO: Summary</p>
    </Wrapper>
  )
}

export default observer(CloseTrade)
