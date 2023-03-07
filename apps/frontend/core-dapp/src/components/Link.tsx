import NextLink from 'next/link'
import styled, { css, SimpleInterpolation } from 'styled-components'

const Anchor = styled.a<{ $underline: boolean }>`
  color: ${({ theme }): string => theme.color.primaryLight};
  ${({ $underline }): SimpleInterpolation | string =>
    $underline
      ? css`
          text-decoration: underline;
          :hover {
            text-decoration: underline;
          }
        `
      : ''}
`

type Props = {
  href: string
  target?: '_self' | '_blank'
  className?: string
  scroll?: boolean
  underline?: boolean
}

const Link: React.FC<Props> = ({
  className,
  href,
  target = '_self',
  children,
  underline = true,
  scroll,
}) => (
  <NextLink href={href} passHref scroll={scroll}>
    <Anchor
      className={className}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : ''}
      $underline={underline}
    >
      {children}
    </Anchor>
  </NextLink>
)

export default Link
