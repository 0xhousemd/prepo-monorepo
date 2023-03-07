import { observer } from 'mobx-react-lite'
import { Flex, Icon, spacingIncrement, Tooltip } from 'prepo-ui'
import styled from 'styled-components'
import { useRootStore } from '../../context/RootStoreProvider'
import { displayEth } from '../../utils/number-utils'
import Skeleton from '../../components/Skeleton'
import SpecialPrePoLogo from '../../SpecialPrePOLogo'
import Link from '../../components/Link'

const Wrapper = styled.div`
  max-width: ${spacingIncrement(380)};
  padding: 0 ${spacingIncrement(8)};
  width: 100%;
`

const Box = styled.div`
  background-color: ${({ theme }): string => theme.color.neutral10};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  box-shadow: ${({ theme }): string => theme.shadow.prepo};
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(10)};
  overflow: hidden;
  padding: ${spacingIncrement(12)} ${spacingIncrement(16)};
  position: relative;
  width: 100%;
`

const LogoWrapper = styled.div`
  left: 0;
  max-width: 80%;
  position: absolute;
  top: 50%;
  transform: translateY(-47%) translateX(-12%);
  width: 100%;
  z-index: 0;
`

const Row = styled.div`
  align-items: center;
  color: ${({ theme }): string => theme.color.neutral1};
  display: flex;
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  justify-content: space-between;
  line-height: 1;
  width: 100%;
  z-index: 1;
`

const Value = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const GreenColor = styled.span`
  color: ${({ theme }): string => theme.color.success};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const BalanceBox: React.FC<{ apr: unknown }> = ({ apr }) => {
  const { collateralStore, web3Store } = useRootStore()
  const { connected } = web3Store
  const { tokenBalanceFormatInEth } = collateralStore

  const aprText = typeof apr === 'string' ? `${apr}%` : '~4.5%'

  return (
    <Wrapper>
      <Box>
        {/* Update to prePO ETH icon and apply conversion of wstETH/weth to the balance */}
        <Row>
          <Flex gap={8}>
            <Icon name="eth" width="24" height="24" />
            <p>prePO Balance</p>
          </Flex>
          {connected && tokenBalanceFormatInEth === undefined ? (
            <Skeleton height={20} width={60} />
          ) : (
            <Value>{displayEth(+(tokenBalanceFormatInEth ?? 0))}</Value>
          )}
        </Row>
        <Row>
          <Flex gap={8}>
            <Icon name="lidoETH" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacingIncrement(4),
              }}
            >
              <p>ETH Yield</p>
              <Tooltip
                overlay={
                  <p>
                    Your ETH will be automatically converted into Lido Wrapped Staked ETH (wstETH)
                    before being deposited, in order to earn staking yield.{' '}
                    <Link href="https://lido.fi" target="_blank">
                      Learn more ↗
                    </Link>
                  </p>
                }
              >
                <div>
                  <Icon name="info" width="14" height="14" color="neutral5" />
                </div>
              </Tooltip>
            </div>
          </Flex>
          <Value>
            <GreenColor>{aprText}</GreenColor>
          </Value>
        </Row>
        <LogoWrapper>
          <SpecialPrePoLogo />
        </LogoWrapper>
      </Box>
    </Wrapper>
  )
}

export default observer(BalanceBox)
