import { observer } from 'mobx-react-lite'
import { CurrencyInput } from 'prepo-ui'
import WithdrawButton from './WithdrawButton'
import WithdrawSummary from './WithdrawSummary'
import WithdrawWarning from './WithdrawWarning'
import { useRootStore } from '../../context/RootStoreProvider'
import PageCard from '../../components/PageCard'
import { Routes } from '../../lib/routes'

const WithdrawPage: React.FC = () => {
  const { preCTTokenStore, withdrawStore } = useRootStore()
  const { balanceOfSigner, tokenBalanceFormat } = preCTTokenStore
  const { withdrawing, setWithdrawalAmount, withdrawalAmount } = withdrawStore

  return (
    <PageCard backUrl={Routes.Deposit} title="Withdraw">
      <CurrencyInput
        balance={tokenBalanceFormat}
        isBalanceZero={balanceOfSigner?.eq(0)}
        currency={{ icon: 'cash', text: 'USD' }}
        disabled={withdrawing}
        onChange={setWithdrawalAmount}
        value={withdrawalAmount}
        showBalance
      />
      <WithdrawButton />
      <WithdrawWarning />
      <WithdrawSummary />
    </PageCard>
  )
}

export default observer(WithdrawPage)
