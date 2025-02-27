import { observer } from 'mobx-react-lite'
import { Button, ButtonProps } from 'prepo-ui'
import { useRootStore } from '../../context/RootStoreProvider'

type Props = {
  hideWhenConnected?: boolean
} & ButtonProps

const ConnectButton: React.FC<Props> = ({ hideWhenConnected, ...buttonProps }) => {
  const { config, web3Store } = useRootStore()
  const { defaultNetwork } = config
  const { connecting, connected, isNetworkSupported } = web3Store

  if (connected && isNetworkSupported) return null

  // ignore whether network is supported (e.g. header connect button)
  if (connected && hideWhenConnected) return null

  const handleSwitchNetwork = (): void => {
    if (!isNetworkSupported) {
      web3Store.setNetwork(defaultNetwork)
      return
    }
    web3Store.connect()
  }

  const buttonText = isNetworkSupported
    ? 'Connect Wallet'
    : `Switch to ${defaultNetwork.displayName ?? defaultNetwork.chainName}`

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Button block disabled={connecting} onClick={handleSwitchNetwork} {...buttonProps}>
      {buttonText}
    </Button>
  )
}

export default observer(ConnectButton)
