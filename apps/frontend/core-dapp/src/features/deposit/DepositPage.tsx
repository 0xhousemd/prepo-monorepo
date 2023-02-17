import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { Alert, CurrencyInput, Icon, media } from 'prepo-ui'
import { useEffect } from 'react'
import DepositButton from './DepositButton'
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
    depositStore: { depositAmount, depositing, isLoadingBalance, setDepositAmount },
    preCTTokenStore,
    baseTokenStore: { balanceOfSigner, tokenBalanceFormat },
  } = useRootStore()

  useEffect(() => {
    if (tokenBalanceFormat) {
      setDepositAmount(+tokenBalanceFormat > 0 ? tokenBalanceFormat : '')
    }
  }, [setDepositAmount, tokenBalanceFormat])

  return (
    <PageCard backUrl={Routes.Portfolio} title="Deposit">
      <CurrencyInput
        balance={tokenBalanceFormat}
        disabled={depositing || isLoadingBalance}
        isBalanceZero={balanceOfSigner?.eq(0)}
        currency={{ icon: 'usdc', text: 'USDC' }}
        onChange={setDepositAmount}
        value={depositAmount}
        placeholder="0"
        showBalance
      />
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
