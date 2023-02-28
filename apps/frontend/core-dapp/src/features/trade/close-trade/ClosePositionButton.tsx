import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import { useMemo } from 'react'
import { formatUnits } from 'ethers/lib/utils'
import { useRootStore } from '../../../context/RootStoreProvider'
import ConnectButton from '../../connect/ConnectButton'

const ClosePositionButton: React.FC = () => {
  const { tradeStore, web3Store } = useRootStore()
  const {
    closePositionButtonLoading,
    closePositionDisabled,
    closePositionButtonInitialLoading,
    closePositionValueBN,
    closePositionNeedApproval,
    insufficientBalanceForClosePosition,
    selectedPosition,
    selectedMarket,
  } = tradeStore
  const { connected, isNetworkSupported } = web3Store

  const selectedMarketResolved = !!selectedMarket?.resolved

  const buttonText = useMemo(() => {
    if (!selectedPosition) return 'Select a Position'
    if (closePositionButtonInitialLoading) return ''
    if (insufficientBalanceForClosePosition) return 'Insufficient Balance'
    if (closePositionNeedApproval) return 'Approve'

    const verb = selectedMarketResolved ? 'Redeem' : 'Close'

    if (
      closePositionValueBN !== undefined &&
      closePositionValueBN.gt(0) &&
      selectedPosition.totalValueBN !== undefined
    ) {
      // mul 10000 because showing percentage + 2 decimals
      const percentageBN = closePositionValueBN.mul(10000).div(selectedPosition.totalValueBN)
      const percentage = formatUnits(percentageBN, 2)
      if (percentageBN !== undefined) return `${verb} Position (${+percentage}%)`
    }

    return `${verb} Position`
  }, [
    closePositionButtonInitialLoading,
    closePositionNeedApproval,
    closePositionValueBN,
    insufficientBalanceForClosePosition,
    selectedMarketResolved,
    selectedPosition,
  ])

  if (!connected || !isNetworkSupported) return <ConnectButton block />

  const handleClick = (): void => {
    if (closePositionNeedApproval) {
      tradeStore.approveClosePositions()
    } else {
      tradeStore.closeOrRedeemPosition()
    }
  }
  return (
    <Button
      block
      disabled={closePositionDisabled}
      loading={closePositionButtonLoading}
      onClick={handleClick}
    >
      {buttonText}
    </Button>
  )
}

export default observer(ClosePositionButton)
