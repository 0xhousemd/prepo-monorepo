import { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import ConnectButton from '../connect/ConnectButton'
import { useRootStore } from '../../context/RootStoreProvider'

const DepositButton: React.FC = () => {
  const { depositStore, web3Store } = useRootStore()
  const {
    depositButtonInitialLoading,
    depositDisabled,
    depositButtonLoading,
    insufficientBalance,
    globalDepositCapExceeded,
    needApproval,
  } = depositStore
  const { connected, isNetworkSupported } = web3Store

  const buttonText = useMemo(() => {
    if (depositButtonInitialLoading) return ''
    if (globalDepositCapExceeded === 'already-exceeded') return 'Deposit Cap Reached'
    if (insufficientBalance) return 'Insufficient Balance'
    if (needApproval) return 'Approve'
    return 'Deposit'
  }, [depositButtonInitialLoading, globalDepositCapExceeded, insufficientBalance, needApproval])

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
