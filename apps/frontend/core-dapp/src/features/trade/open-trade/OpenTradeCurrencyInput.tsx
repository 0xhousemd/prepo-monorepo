import { CurrencyInput } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { useRootStore } from '../../../context/RootStoreProvider'
import CurrencySlideUp from '../../currencies/CurrencySlideUp'
import { isProduction } from '../../../utils/isProduction'
import { Token } from '../../../stores/TokensStore'

const OpenTradeCurrencyInput: React.FC = () => {
  const { tokensStore, tradeStore, web3Store } = useRootStore()
  const { connected } = web3Store
  const { sortedTradeTokens } = tokensStore
  const {
    paymentToken,
    slideUpContent,
    openingTrade,
    openTradeAmount,
    setOpenTradeAmount,
    selectedMarket,
  } = tradeStore

  const balanceBN = tokensStore.getTokenBalanceBN(paymentToken)
  const balance = tokensStore.getTokenBalance(paymentToken)

  const handleChangeToken = (token: Token): void => {
    tradeStore.setPaymentTokenOverride(token)
    tradeStore.setSlideUpContent()
  }

  return (
    <>
      <CurrencyInput
        balance={balance}
        isBalanceZero={balanceBN?.eq(0)}
        disabled={!selectedMarket || openingTrade || selectedMarket.expired}
        currency={{
          icon: paymentToken.iconName ?? 'cash',
          text: paymentToken.shortName ?? paymentToken.name,
          // TODO: remove isProduction check when deposit + trade implementation is done
          // currently the only way to switch token is via the currency slide up that is triggered by this onClick
          // by not passing anything to onClick in production, we can effectively prevent users from selecting a different token
          // before deposit + trade implementation is done
          onClick: isProduction()
            ? undefined
            : (): void => tradeStore.setSlideUpContent('OpenCurrency'),
        }}
        onChange={setOpenTradeAmount}
        value={openTradeAmount}
        placeholder="0"
        showBalance
      />
      <CurrencySlideUp
        hideBalance={!connected}
        onChange={handleChangeToken}
        selectedToken={paymentToken}
        tokens={sortedTradeTokens}
        slideUpCard={{
          show: slideUpContent === 'OpenCurrency',
          onClose: tradeStore.setSlideUpContent,
          title: 'Select Payment Method',
        }}
      />
    </>
  )
}

export default observer(OpenTradeCurrencyInput)
