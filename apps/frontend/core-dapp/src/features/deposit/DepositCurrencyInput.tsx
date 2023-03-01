import { CurrencyInput } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { useRootStore } from '../../context/RootStoreProvider'
import CurrencySlideUp from '../currencies/CurrencySlideUp'
import { Token } from '../../stores/TokensStore'

const OpenTradeCurrencyInput: React.FC = () => {
  const { tokensStore, depositStore, web3Store } = useRootStore()
  const { connected } = web3Store
  const { sortedDepositTokens } = tokensStore
  const { depositAmount, depositToken, depositing, isLoadingBalance, showCurrencySlideUp } =
    depositStore

  const balanceBN = tokensStore.getTokenBalanceBN(depositToken)
  const balance = tokensStore.getTokenBalance(depositToken)

  const handleChangeToken = (token: Token): void => {
    depositStore.setDepositTokenOverride(token)
    depositStore.setShowCurrencySlideUp(false)
  }

  return (
    <>
      <CurrencyInput
        balance={balance}
        isBalanceZero={balanceBN?.eq(0)}
        disabled={depositing || isLoadingBalance}
        currency={{
          icon: depositToken.iconName,
          text: depositToken.shortName ?? depositToken.name,
        }}
        onChange={depositStore.setDepositAmount}
        value={depositAmount}
        placeholder="0"
        showBalance
      />
      <CurrencySlideUp
        hideBalance={!connected}
        onChange={handleChangeToken}
        selectedToken={depositToken}
        tokens={sortedDepositTokens}
        slideUpCard={{
          show: showCurrencySlideUp,
          onClose: () => depositStore.setShowCurrencySlideUp(false),
          title: 'Select Payment Method',
        }}
      />
    </>
  )
}

export default observer(OpenTradeCurrencyInput)
