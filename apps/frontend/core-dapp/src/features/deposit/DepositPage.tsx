import DepositButton from './DepositButton'
import DepositCurrencyInput from './DepositCurrencyInput'
import DepositSummary from './DepositSummary'
import DepositWarning from './DepositWarning'
import PageCard from '../../components/PageCard'

const DepositPage: React.FC = () => (
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
)

export default DepositPage
