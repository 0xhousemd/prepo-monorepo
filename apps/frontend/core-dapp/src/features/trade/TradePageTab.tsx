import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'

import { TradeAction } from './TradeStore'
import { useRootStore } from '../../context/RootStoreProvider'
import PageTabs from '../../components/PageTabs'
import { TabProps } from '../../components/Tabs'

const tabs: TabProps[] = [
  { value: 'open', heading: 'Open' },
  { value: 'close', heading: 'Close' },
]

// saving these code for when we want to show settings
// const SettingsButton = styled(Button)`
//   &&&& {
//     button {
//       color: ${({ theme }): string => theme.color.neutral5};
//       padding: ${spacingIncrement(1)};
//     }
//   }
// `

const TradePageTab: React.FC = () => {
  const router = useRouter()
  const { tradeStore } = useRootStore()
  const { action, setAction } = tradeStore

  const handleClick = (newAction: string): void => {
    if (newAction === action) return
    const tradeUrl = setAction(newAction as TradeAction)
    router.push(tradeUrl)
  }

  return (
    <PageTabs
      activeKey={action === 'close' ? 'close' : 'open'}
      onChange={handleClick}
      tab={tabs}
      // saving these code for when we want to show settings
      // tabBarExtraContent={
      //   <SettingsButton
      //     icon={<Icon name="settings" height="16" width="16" />}
      //     size="xs"
      //     type="text"
      //     onClick={(): void => tradeStore.setShowSettings(true)}
      //   />
      // }
    />
  )
}

export default observer(TradePageTab)
