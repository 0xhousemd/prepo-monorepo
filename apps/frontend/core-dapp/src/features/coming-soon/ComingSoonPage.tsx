import Link from 'next/link'
import { PrepoLink } from 'prepo-constants'
import { media, Icon, Flex, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const Title = styled.h1`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.md};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const ArbitrumIcon = styled(Icon).attrs({ name: 'arbitrum', height: '28px', width: '28px' })`
  svg {
    height: ${spacingIncrement(24)};
    width: ${spacingIncrement(24)};
    ${media.desktop`
    height: ${spacingIncrement(28)};
    width: ${spacingIncrement(28)};
    `}
  }
`

const DescriptionWrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  justify-content: center;
  margin-top: ${spacingIncrement(32)};
  padding: ${spacingIncrement(16)};
  ${media.desktop`
    margin-top: ${spacingIncrement(64)};
  `}
`

const Description = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  line-height: ${spacingIncrement(20)};
  text-align: center;
`

const LinkText = styled.a`
  color: ${({ theme }): string => theme.color.primaryLight};
  text-decoration: underline;
  :hover {
    color: ${({ theme }): string => theme.color.darkPrimary};
    text-decoration: underline;
  }
`

const ComingSoonPage: React.FC = () => (
  <Wrapper>
    <Flex gap={8}>
      <Title>Coming soon to Arbitrum</Title>
      <ArbitrumIcon />
    </Flex>
    <DescriptionWrapper>
      <Description>The testnet period has now ended.</Description>
      <Description>Stay tuned as we upgrade the app for launch 🚀</Description>
      <Description>
        Follow our{' '}
        <Link href={PrepoLink.discord} passHref>
          <LinkText href={PrepoLink.discord} target="_blank" rel="noreferrer">
            Discord
          </LinkText>
        </Link>{' '}
        and{' '}
        <Link href={PrepoLink.twitter} passHref>
          <LinkText href={PrepoLink.twitter} target="_blank" rel="noreferrer">
            Twitter
          </LinkText>
        </Link>{' '}
        for updates.
      </Description>
    </DescriptionWrapper>
  </Wrapper>
)

export default ComingSoonPage
