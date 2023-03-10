import { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import ConnectButton from '../connect/ConnectButton'
import { useRootStore } from '../../context/RootStoreProvider'

const DepositButton: React.FC = () => {
  const { depositStore, depositHookStore, web3Store } = useRootStore()
  const {
    depositButtonInitialLoading,
    depositDisabled,
    depositButtonLoading,
    insufficientBalance,
    needApproval,
  } = depositStore
  const { depositsAllowed } = depositHookStore
  const { connected, isNetworkSupported } = web3Store

  const buttonText = useMemo(() => {
    if (depositButtonInitialLoading) return ''
    if (!depositsAllowed) return 'Coming Soon'
    if (insufficientBalance) return 'Insufficient Balance'
    if (needApproval) return 'Approve'
    return 'Deposit'
  }, [depositButtonInitialLoading, depositsAllowed, insufficientBalance, needApproval])

  if (!connected || !isNetworkSupported) return <ConnectButton block />

  const handleClick = (): void => {
    if (needApproval) {
      depositStore.approve()
    } else {
      depositStore.deposit()
    }
  }

  return (
    <Button block onClick={handleClick} loading={depositButtonLoading} disabled={depositDisabled}>
      {buttonText}
    </Button>
  )
}

export default observer(DepositButton)
