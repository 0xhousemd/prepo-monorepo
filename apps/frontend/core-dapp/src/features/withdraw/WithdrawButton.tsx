import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import { useMemo } from 'react'
import { useRootStore } from '../../context/RootStoreProvider'
import ConnectButton from '../connect/ConnectButton'

const WithdrawButton: React.FC = () => {
  const { web3Store, withdrawStore } = useRootStore()
  const { connected, isNetworkSupported } = web3Store
  const {
    insufficientBalance,
    insufficientLiquidity,
    withdrawButtonInitialLoading,
    withdrawUILoading,
    withdrawalDisabled,
  } = withdrawStore

  const buttonText = useMemo(() => {
    if (withdrawButtonInitialLoading) return ''
    if (insufficientLiquidity) return 'Insufficient Liquidity'
    if (insufficientBalance) return 'Insufficient Balance'
    return 'Withdraw'
  }, [insufficientBalance, insufficientLiquidity, withdrawButtonInitialLoading])

  if (!connected || !isNetworkSupported) return <ConnectButton block />

  return (
    <Button
      block
      disabled={withdrawalDisabled}
      loading={withdrawUILoading}
      onClick={withdrawStore.withdraw}
    >
      {buttonText}
    </Button>
  )
}

export default observer(WithdrawButton)
