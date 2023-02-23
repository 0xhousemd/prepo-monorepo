import { observer } from 'mobx-react-lite'
import { Flex } from 'prepo-ui'
import { useRootStore } from '../../context/RootStoreProvider'
import { compactNumber, formatUsd } from '../../utils/number-utils'
import { Alert, InlineTextButton } from '../deposit/DepositWarning'
import { formatDuration } from '../../utils/date-utils'

const WithdrawWarning: React.FC = () => {
  const {
    withdrawStore: { withdrawLimit, setWithdrawalAmount },
  } = useRootStore()

  switch (withdrawLimit.status) {
    case 'already-exceeded': {
      const cap = compactNumber(+withdrawLimit.capUnits, { showUsdSign: true })

      return (
        <Alert
          message={
            <>
              <p>Global withdrawal limit reached ({cap})</p>
              <br />
              {withdrawLimit.resetsIn !== undefined && (
                <p>Resets in {formatDuration(withdrawLimit.resetsIn)}</p>
              )}
            </>
          }
        />
      )
    }
    case 'exceeded-after-transfer': {
      const formattedRemainingAmount = formatUsd(+withdrawLimit.remainingUnits)

      return (
        <Alert
          message={
            <Flex flexDirection="column" gap={8} alignItems="start">
              <p>
                Withdrawal limit exceeded. <br />
                (
                <InlineTextButton
                  onClick={(): void => {
                    setWithdrawalAmount(withdrawLimit.remainingUnits)
                  }}
                  title={`Withdraw ${formattedRemainingAmount} instead`}
                >
                  {formattedRemainingAmount}
                </InlineTextButton>{' '}
                remaining)
              </p>
              {withdrawLimit.resetsIn !== undefined && (
                <p>Resets in {formatDuration(withdrawLimit.resetsIn)}</p>
              )}
            </Flex>
          }
        />
      )
    }
    default: {
      return null
    }
  }
}

export default observer(WithdrawWarning)
