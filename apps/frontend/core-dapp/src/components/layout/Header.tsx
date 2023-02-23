import { Layout } from 'antd'
import styled from 'styled-components'
import { coreDappTheme, Flex, media, spacingIncrement } from 'prepo-ui'
import Navigation from '../Navigation'
import SettingsMenu from '../SettingsMenu'
import PrePOLogo from '../PrePOLogo'
import ConnectButton from '../../features/connect/ConnectButton'
import { isProduction } from '../../utils/isProduction'

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
    padding: ${spacingIncrement(16)};
    position: relative;
    ${media.desktop`
      padding: ${spacingIncrement(32)};
  `};
  }
`

const Header: React.FC = () => (
  <Wrapper>
    <AHeader>
      <Flex justifyContent="flex-start" gap={8}>
        <PrePOLogo />
        {!isProduction() && <Navigation />}
      </Flex>
      <Flex gap={8}>
        {!isProduction() && <ConnectButton size="sm" hideWhenConnected />}
        <SettingsMenu />
      </Flex>
    </AHeader>
  </Wrapper>
)

export default Header
