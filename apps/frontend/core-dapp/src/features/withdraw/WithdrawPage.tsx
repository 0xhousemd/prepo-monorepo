import { observer } from 'mobx-react-lite'
import { CurrencyInput } from 'prepo-ui'
import WithdrawButton from './WithdrawButton'
import WithdrawSummary from './WithdrawSummary'
import WithdrawWarning from './WithdrawWarning'
import { useRootStore } from '../../context/RootStoreProvider'
import PageCard from '../../components/PageCard'
import { Routes } from '../../lib/routes'

const WithdrawPage: React.FC = () => {
  const { collateralStore, withdrawStore } = useRootStore()
  const { balanceOfSignerInEth, tokenBalanceFormatInEth } = collateralStore
  const { withdrawing, setWithdrawalAmount, withdrawalAmountInEth } = withdrawStore

  return (
    <PageCard backUrl={Routes.Deposit} title="Withdraw">
      <CurrencyInput
        balance={tokenBalanceFormatInEth}
        isBalanceZero={balanceOfSignerInEth?.eq(0)}
        currency={{ icon: 'eth', text: 'ETH' }}
        disabled={withdrawing}
        onChange={setWithdrawalAmount}
        value={withdrawalAmountInEth}
        showBalance
      />
      <WithdrawButton />
      <WithdrawWarning />
      <WithdrawSummary />
    </PageCard>
  )
}

export default observer(WithdrawPage)
