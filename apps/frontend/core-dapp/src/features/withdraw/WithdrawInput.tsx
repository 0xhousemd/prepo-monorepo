import { CurrencyInput } from 'prepo-ui'
import styled from 'styled-components'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`

const WithdrawInput: React.FC = () => {
  const { collateralStore, withdrawStore } = useRootStore()
  const { setWithdrawalAmount, withdrawalAmount } = withdrawStore
  const { balanceOfSigner, tokenBalanceFormat } = collateralStore

  return (
    <Wrapper>
      <CurrencyInput
        balance={tokenBalanceFormat}
        isBalanceZero={balanceOfSigner?.eq(0)}
        currency={{ icon: 'cash', text: 'USD' }}
        onChange={setWithdrawalAmount}
        value={withdrawalAmount}
        showBalance
      />
    </Wrapper>
  )
}

export default WithdrawInput
