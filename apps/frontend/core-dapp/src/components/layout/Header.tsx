import { Layout } from 'antd'
import styled from 'styled-components'
import { coreDappTheme, Flex, media, spacingIncrement } from 'prepo-ui'
import SettingsMenu from '../SettingsMenu'
import PrePOLogo from '../PrePOLogo'
import ConnectButton from '../../features/connect/ConnectButton'
import { Routes } from '../../lib/routes'
import { isProduction } from '../../utils/isProduction'
import Link from '../Link'

const { Z_INDEX } = coreDappTheme

const { Header: AHeader } = Layout

const Wrapper = styled.div`
  position: sticky;
  top: 0;
  z-index: ${Z_INDEX.navigation};
  .ant-layout-header {
    align-items: center;
    background-color: ${({ theme }): string => theme.color.neutral10};
    display: flex;
    height: min-content;
    justify-content: space-between;
    padding: ${spacingIncrement(32)} ${spacingIncrement(16)} ${spacingIncrement(16)};
    position: relative;
    ${media.desktop`
      padding: ${spacingIncrement(32)};
    `};
  }
`

const Banner = styled.div`
  background-color: ${({ theme }): string => theme.color.primary};
  color: ${({ theme }): string => theme.color.white};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  line-height: ${spacingIncrement(16)};
  padding: ${spacingIncrement(8)};
  text-align: center;
  width: 100%;
`

const Header: React.FC = () => (
  <Wrapper>
    <Banner>
      Early deposits open this week.{' '}
      <Link href="https://docs.prepo.io" target="_blank">
        Learn more↗
      </Link>
    </Banner>
    <AHeader>
      <Flex justifyContent="flex-start" gap={8}>
        <PrePOLogo href={Routes.Deposit} />
        {/* <Navigation /> */}
      </Flex>
      <Flex gap={8}>
        {!isProduction() && <ConnectButton size="sm" hideWhenConnected />}
        <SettingsMenu />
      </Flex>
    </AHeader>
  </Wrapper>
)

export default Header
