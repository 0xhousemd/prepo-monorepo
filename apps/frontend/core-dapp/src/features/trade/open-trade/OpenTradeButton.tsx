import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import { useMemo } from 'react'
import { useRootStore } from '../../../context/RootStoreProvider'
import ConnectButton from '../../connect/ConnectButton'

const OpenTradeButton: React.FC = () => {
  const { collateralStore, tradeStore, web3Store } = useRootStore()
  const { balanceOfSigner } = collateralStore
  const { connected, isNetworkSupported } = web3Store
  const {
    insufficientBalanceForOpenTrade,
    needApproval,
    selectedMarket,
    openTradeButtonLoading,
    openTradeButtonInitialLoading,
    withinBounds,
    tradeDisabled,
  } = tradeStore

  const buttonText = useMemo(() => {
    if (!selectedMarket) return 'Select a Market'

    if (selectedMarket.resolved) return 'Market Closed'

    if (withinBounds === false) return 'Unprofitable Trade'

    if (connected) {
      if (insufficientBalanceForOpenTrade) return 'Insufficient Balance'
      if (balanceOfSigner?.gt(0) && needApproval) return 'Approve'
    }

    // during initial loading states, show only "spinner" and no text
    if (openTradeButtonInitialLoading) return ''

    return 'Trade'
  }, [
    balanceOfSigner,
    connected,
    insufficientBalanceForOpenTrade,
    needApproval,
    openTradeButtonInitialLoading,
    selectedMarket,
    withinBounds,
  ])

  if (!connected || !isNetworkSupported) return <ConnectButton />

  const handleClick = (): void => {
    if (needApproval) {
      tradeStore.approve()
    } else {
      tradeStore.openTrade()
    }
  }

  return (
    <Button
      block
      disabled={tradeDisabled || openTradeButtonLoading}
      loading={openTradeButtonLoading}
      onClick={handleClick}
    >
      {buttonText}
    </Button>
  )
}

export default observer(OpenTradeButton)
