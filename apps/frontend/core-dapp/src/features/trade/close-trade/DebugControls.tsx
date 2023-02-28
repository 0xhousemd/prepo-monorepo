import { observer } from 'mobx-react-lite'
import { Flex } from 'prepo-ui'
import { useRootStore } from '../../../context/RootStoreProvider'
import { isProduction } from '../../../utils/isProduction'

export const DebugControls = observer(() => {
  const { debugStore } = useRootStore()

  if (isProduction()) return null

  return (
    <Flex
      position="fixed"
      bottom={4}
      right={4}
      border="1px solid gray"
      padding={8}
      flexDirection="column"
      gap={8}
    >
      <label htmlFor="simulate_resolved" style={{ display: 'flex', gap: 8 }}>
        <input
          type="checkbox"
          name="simulate_resolved"
          checked={debugStore.overrideFinalLongPayout !== undefined}
          onChange={(e): void => {
            if (e.target.checked) {
              debugStore.overrideFinalLongPayout = 50
            } else {
              debugStore.overrideFinalLongPayout = undefined
            }
          }}
        />
        Simulate resolved market
      </label>

      {debugStore.overrideFinalLongPayout !== undefined && (
        <label htmlFor="longPayout" style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            min={1}
            max={100}
            name="longPayout"
            value={debugStore.overrideFinalLongPayout}
            onChange={(e): void => {
              debugStore.overrideFinalLongPayout = +e.target.value
            }}
            style={{ maxWidth: 50 }}
          />
          Final long payout (%)
        </label>
      )}
    </Flex>
  )
})
