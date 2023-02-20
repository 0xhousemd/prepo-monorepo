import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { Alert as BaseAlert, Icon, spacingIncrement } from 'prepo-ui'
import { useRootStore } from '../../context/RootStoreProvider'
import { compactNumber, formatUsd } from '../../utils/number-utils'

const Alert = styled(BaseAlert).attrs({
  color: 'neutral1',
  icon: (
    <Icon
      name="exclamation-circle"
      color="warning"
      width={spacingIncrement(20)}
      height={spacingIncrement(20)}
    />
  ),
  showIcon: true,
  type: 'warning',
})`
  &&& {
    justify-content: center;

    .ant-alert-message {
      font-size: ${({ theme }): string => theme.fontSize.xs};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      line-height: ${spacingIncrement(16)};
    }

    .ant-alert-content {
      flex: initial;
      margin-left: ${spacingIncrement(10)};
    }
  }
`

const InlineTextButton = styled.button`
  all: unset;
  color: ${({ theme }): string => theme.color.primaryLight};
  cursor: pointer;
  text-decoration: underline;
  transition: none;

  :hover,
  :focus {
    color: ${({ theme }): string => theme.color.info};
  }

  :active {
    opacity: 0.8;
  }
`

const DepositWarning: React.FC = () => {
  const {
    depositStore: {
      globalDepositCapExceeded,
      globalNetDepositCapInUsd,
      globalRemainingDepositAmountInUsd,
      setDepositAmount,
    },
  } = useRootStore()

  if (globalDepositCapExceeded === 'already-exceeded' && globalNetDepositCapInUsd !== undefined) {
    return (
      <Alert
        message={
          <p>
            Global deposit limit reached (
            {compactNumber(+globalNetDepositCapInUsd, { showUsdSign: true })})
          </p>
        }
      />
    )
  }

  if (
    globalDepositCapExceeded === 'exceeded-if-deposit' &&
    globalRemainingDepositAmountInUsd !== undefined
  ) {
    const formattedRemainingAmount = formatUsd(+globalRemainingDepositAmountInUsd)

    return (
      <Alert
        message={
          <p>
            Global deposit limit exceeded. <br />
            Only{' '}
            <InlineTextButton
              onClick={(): void => {
                setDepositAmount(globalRemainingDepositAmountInUsd)
              }}
              title={`Deposit ${formattedRemainingAmount} instead`}
            >
              {formattedRemainingAmount}
            </InlineTextButton>{' '}
            remaining.
          </p>
        }
      />
    )
  }

  return null
}

export default observer(DepositWarning)
