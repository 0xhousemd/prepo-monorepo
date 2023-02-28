import DepositButton from './DepositButton'
import DepositCurrencyInput from './DepositCurrencyInput'
import DepositSummary from './DepositSummary'
import DepositWarning from './DepositWarning'
import { Routes } from '../../lib/routes'
import PageCard from '../../components/PageCard'

const DepositPage: React.FC = () => (
  <PageCard backUrl={Routes.Portfolio} title="Deposit">
    <DepositCurrencyInput />
    <DepositButton />
    <DepositWarning />
    <DepositSummary />
  </PageCard>
)

export default DepositPage
