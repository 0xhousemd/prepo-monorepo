import { observer } from 'mobx-react-lite'

import styled from 'styled-components'
import { Alert as BaseAlert, Icon, spacingIncrement } from 'prepo-ui'
import { useRootStore } from '../../context/RootStoreProvider'
import { compactNumber, displayEth } from '../../utils/number-utils'
import Link from '../../components/Link'

const Box = styled.div`
  background-color: ${({ theme }): string => theme.color.accentInfo};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  color: ${({ theme }): string => theme.color.neutral2};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  padding: ${spacingIncrement(10)} ${spacingIncrement(16)};
  width: 100%;
`

export const Alert = styled(BaseAlert).attrs({
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

export const InlineTextButton = styled.button`
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
    depositStore: { depositLimit, setDepositAmount },
  } = useRootStore()

  switch (depositLimit.status) {
    case 'already-exceeded': {
      const cap = compactNumber(+depositLimit.capUnits, { showUsdSign: true })

      return (
        <Alert
          message={
            <p>
              {depositLimit.type === 'global-limit' && <>Global deposit limit reached ({cap})</>}
              {depositLimit.type === 'user-limit' && (
                <>You&apos;ve reached your {cap} deposit limit</>
              )}
            </p>
          }
        />
      )
    }
    case 'exceeded-after-transfer': {
      const formattedRemainingAmount = displayEth(+depositLimit.remainingUnits)

      return (
        <Alert
          message={
            <p>
              Deposit limit exceeded. <br />
              Only{' '}
              <InlineTextButton
                onClick={(): void => {
                  setDepositAmount(depositLimit.remainingUnits)
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
    default: {
      // TODO: Update learn more link
      return (
        <Box>
          <p>
            Your ETH will be deposited as wstETH to earn you yield.{' '}
            <Link href="/deposit">Learn more ↗</Link>
          </p>
        </Box>
      )
    }
  }
}

export default observer(DepositWarning)
