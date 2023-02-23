import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { Alert, Icon, media } from 'prepo-ui'
import DepositButton from './DepositButton'
import DepositCurrencyInput from './DepositCurrencyInput'
import DepositSummary from './DepositSummary'
import DepositWarning from './DepositWarning'
import { useRootStore } from '../../context/RootStoreProvider'
import { PREPO_TESTNET_FORM } from '../../lib/constants'
import { Routes } from '../../lib/routes'
import PageCard from '../../components/PageCard'

const AlertWrapper = styled.div`
  div[class*='ant-alert-message'] {
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.base};
    `}
  }
`

const Message = styled.div`
  a {
    &:hover {
      color: ${({ theme }): string => theme.color.darkPrimary};
    }
    text-decoration: underline;
    white-space: nowrap;
  }
`

const DepositPage: React.FC = () => {
  const {
    preCTTokenStore,
    baseTokenStore: { balanceOfSigner },
  } = useRootStore()

  return (
    <PageCard backUrl={Routes.Portfolio} title="Deposit">
      <DepositCurrencyInput />
      <DepositButton />
      <DepositWarning />
      <DepositSummary />
      {preCTTokenStore.balanceOfSigner?.eq(0) && balanceOfSigner?.eq(0) && (
        <AlertWrapper>
          <Alert
            message={
              <Message>
                Get FAKEUSD by filling out{' '}
                <a target="_blank" href={PREPO_TESTNET_FORM} rel="noreferrer">
                  this form
                </a>
                .
              </Message>
            }
            type="warning"
            showIcon
            icon={<Icon name="info" color="warning" />}
          />
        </AlertWrapper>
      )}
    </PageCard>
  )
}

export default observer(DepositPage)
