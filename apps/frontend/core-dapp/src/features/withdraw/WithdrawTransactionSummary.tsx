import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import TransactionSummary from '../../components/TransactionSummary/TransactionSummary'
import { Callback } from '../../types/common.types'
import { useRootStore } from '../../context/RootStoreProvider'
import { RowData } from '../../components/Table'
import { EstimatedWithdrawalReceivedAmount } from '../definitions'

const WithdrawTransactionSummary: React.FC = () => {
  const router = useRouter()
  const { preCTTokenStore, withdrawStore } = useRootStore()
  const { receivedAmount, withdrawalDisabled, withdrawUILoading, withdrawalFee } = withdrawStore
  const { withdrawHash } = preCTTokenStore

  const onCancel = (): void => {
    preCTTokenStore.setWithdrawHash(undefined)
  }

  const onComplete = (): void => {
    router.push('/markets')
  }

  const handleWithdraw = async (
    successCallback: Callback,
    failedCallback: Callback<string>
  ): Promise<void> => {
    const { error } = await withdrawStore.withdraw()
    if (error) {
      failedCallback(error)
    } else {
      successCallback()
    }
  }

  const withdrawTransactionSummary: RowData[] = [
    {
      label: 'Estimated Received Amount',
      tooltip: <EstimatedWithdrawalReceivedAmount fee={withdrawalFee} />,
      amount: receivedAmount || '0',
    },
  ]

  return (
    <TransactionSummary
      data={withdrawTransactionSummary}
      disabled={withdrawalDisabled}
      loading={withdrawUILoading}
      onCancel={onCancel}
      onComplete={onComplete}
      onConfirm={handleWithdraw}
      onRetry={handleWithdraw}
      transactionHash={withdrawHash}
    />
  )
}

export default observer(WithdrawTransactionSummary)
