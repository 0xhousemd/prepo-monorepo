import styled from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import BalanceBox from './BalanceBox'
import DepositButton from './DepositButton'
import DepositCurrencyInput from './DepositCurrencyInput'
import DepositSummary from './DepositSummary'
import DepositWarning from './DepositWarning'
import PageCard from '../../components/PageCard'
import Link from '../../components/Link'
import { Routes } from '../../lib/routes'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
`

const WithdrawText = styled.span`
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`

const DepositPage: React.FC<{ apr: unknown }> = ({ apr }) => (
  <Wrapper>
    <PageCard
      title="Early Deposit"
      titleTooltip={
        // TODO: update learn more link
        <span>
          Deposit early for bonus PPO rewards. The platform is estimated to launch in a few weeks.{' '}
          <span style={{ whiteSpace: 'nowrap' }}>Learn more ↗</span>
        </span>
      }
    >
      <DepositCurrencyInput />
      <DepositButton />
      <DepositWarning />
      <DepositSummary />
    </PageCard>
    <BalanceBox apr={apr} />
    <Link href={Routes.Withdraw} underline={false}>
      <WithdrawText>Withdraw &rarr;</WithdrawText>
    </Link>
  </Wrapper>
)

export default DepositPage
