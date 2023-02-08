import { Col } from 'antd'
import { runInAction } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useMemo } from 'react'
import Skeleton from 'react-loading-skeleton'
import styled from 'styled-components'
import { media, Button, Icon, Flex, Typography, Grid } from 'prepo-ui'
import { Trans } from '@lingui/macro'
import PositionsAndHistory from './PositionsAndHistoryNext'
import { makeRepeatedValue } from '../../utils/generic-utils'
import { useRootStore } from '../../context/RootStoreProvider'
import { numberFormatter } from '../../utils/numberFormatter'

const { toUsd } = numberFormatter

const Container = styled(Flex)`
  --portfolio-size: 16.5rem;
  --positions-size: 27.875rem;
`

const Box = styled(Col)`
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
`

const BalanceText = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${({ theme }): string => theme.fontSize.md};
  margin: 0;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['4xl']};
    line-height: ${({ theme }): string => theme.fontSize['4xl']};
  `}
`

const IconWrapper = styled.div`
  cursor: pointer;
  line-height: 1;
`

const Portfolio: React.FC = () => {
  const {
    localStorageStore,
    portfolioStore,
    web3Store: { connected },
  } = useRootStore()
  const { isPortfolioVisible } = localStorageStore.storage

  const { portfolioValue } = portfolioStore
  const toggleShowPortfolio = (): void => {
    runInAction(() => {
      localStorageStore.storage.isPortfolioVisible = !isPortfolioVisible
    })
  }

  const renderPortfolioValue = useMemo(() => {
    if (!connected) return '-'
    if (!isPortfolioVisible) return makeRepeatedValue('*', 9)
    if (portfolioValue === undefined) return <Skeleton width={120} />
    return `${toUsd(portfolioValue)}`
  }, [connected, isPortfolioVisible, portfolioValue])

  return (
    <Container>
      <Grid
        gridTemplateColumns={{
          phone: '1fr',
          desktop:
            'var(--portfolio-size) var(--positions-size) minmax(auto, var(--portfolio-size))',
        }}
        gap="2rem"
        flex={{ phone: 1, desktop: 'initial' }}
        margin="0 auto"
      >
        <Box>
          <Flex flexDirection="column" alignItems="flex-start" padding={25}>
            <Flex alignItems="flex-start" flexDirection="column" gap={8}>
              <Flex justifyContent="flex-start">
                <Typography color="neutral2" variant="text-medium-md" mr={17}>
                  <Trans>Portfolio Value</Trans>
                </Typography>
                <IconWrapper onClick={toggleShowPortfolio}>
                  <Icon
                    color="secondary"
                    height="26"
                    name={isPortfolioVisible ? 'eye' : 'eye-slash'}
                    width="25"
                  />
                </IconWrapper>
              </Flex>
              <BalanceText>{renderPortfolioValue}</BalanceText>
            </Flex>
            <Grid gap={22} gridTemplateColumns="1fr 1fr" maxWidth={540} mt={17} width="100%">
              <Button block href="/portfolio/deposit">
                <Trans>Deposit</Trans>
              </Button>
              <Button type="default" href="/portfolio/withdraw" block>
                <Trans>Withdraw</Trans>
              </Button>
            </Grid>
          </Flex>
        </Box>
        <PositionsAndHistory />
      </Grid>
    </Container>
  )
}

export default observer(Portfolio)
