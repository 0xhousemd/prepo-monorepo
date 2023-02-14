import { Button, Flex, Grid, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import prepoLogoBgDark from './prepo-logo-bg-dark.svg'
import prepoLogoBgLight from './prepo-logo-bg-light.svg'
import Skeleton from '../../components/Skeleton'
import { compactNumber } from '../../utils/number-utils'
import { useRootStore } from '../../context/RootStoreProvider'
import { Routes } from '../../lib/routes'

const Container = styled(Flex)`
  background: url('${({ theme }): string =>
      (theme.isDarkMode ? prepoLogoBgDark : prepoLogoBgLight).src}')
    no-repeat center;
  background-size: cover;
  border-radius: ${spacingIncrement(16)};
  box-shadow: ${({ theme }): string => theme.shadow.prepo};
  height: fit-content;
`
const Label = styled.span`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${spacingIncrement(14)};
  line-height: ${spacingIncrement(14)};
`

const SmallLabel = styled(Label)`
  font-size: ${spacingIncrement(12)};
`

const Value = styled.span`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${spacingIncrement(16)};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(16)};
`

const BigValue = styled(Value)`
  font-size: ${spacingIncrement(32)};
  line-height: ${spacingIncrement(34)};
`

const ActionButton = styled(Button).attrs({
  type: 'text',
  size: 'xs',
})`
  &&& {
    div {
      color: ${({ theme }): string => theme.color.primaryLight};
      font-size: ${({ theme }): string => theme.fontSize.sm};
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
      line-height: ${spacingIncrement(14)};
      padding: 0;
    }
  }
`

const PortfolioValue: React.FC = () => {
  const { portfolioStore, preCTTokenStore, web3Store } = useRootStore()
  const { portfolioValue, tradingPositionsValue } = portfolioStore
  const { tokenBalanceFormat } = preCTTokenStore
  const { connected } = web3Store

  return (
    <Container p={16} flexDirection="column" alignItems="start" justifyContent="start" gap={24}>
      <Flex flexDirection="column" alignItems="start" gap={4}>
        <SmallLabel>Portfolio Value</SmallLabel>
        {connected ? (
          <>
            {portfolioValue === undefined ? (
              <Skeleton width={120} height={34} />
            ) : (
              <BigValue>{compactNumber(+portfolioValue, { showUsdSign: true })}</BigValue>
            )}
          </>
        ) : (
          <BigValue>-</BigValue>
        )}
      </Flex>
      <Grid gridTemplateColumns="repeat(2, 1fr)" width="100%">
        <Flex flexDirection="column" alignItems="start" gap={4}>
          <Label>Open Positions</Label>
          {connected ? (
            <>
              {tradingPositionsValue === undefined ? (
                <Skeleton width={54} height={16} />
              ) : (
                <Value>{compactNumber(tradingPositionsValue, { showUsdSign: true })}</Value>
              )}
            </>
          ) : (
            <Value>-</Value>
          )}
        </Flex>
        <Flex flexDirection="column" alignItems="start" gap={4}>
          <Label>Cash Balance</Label>
          {connected ? (
            <>
              {tokenBalanceFormat === undefined ? (
                <Skeleton width={54} height={16} />
              ) : (
                <Value>{compactNumber(+tokenBalanceFormat, { showUsdSign: true })}</Value>
              )}
            </>
          ) : (
            <Value>-</Value>
          )}
        </Flex>
      </Grid>
      <Flex gap={16}>
        <ActionButton href={Routes.Deposit}>Deposit &rarr;</ActionButton>
        <ActionButton href={Routes.Withdraw}>Withdraw &rarr;</ActionButton>
      </Flex>
    </Container>
  )
}

export default observer(PortfolioValue)
