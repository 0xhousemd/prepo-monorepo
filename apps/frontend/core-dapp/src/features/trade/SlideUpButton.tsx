import { Icon, spacingIncrement } from 'prepo-ui'
import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react'
import styled from 'styled-components'

type Props = Omit<
  DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>,
  'ref'
> & {
  showShadow?: boolean
}

const Wrapper = styled.button<{ showShadow?: boolean }>`
  align-items: center;
  background-color: ${({ theme }): string => theme.color.transparent};
  border: solid 1px ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  box-shadow: ${({ showShadow, theme }): string => (showShadow ? theme.shadow.prepo : 'unset')};
  color: ${({ theme }): string => theme.color.neutral1};
  cursor: pointer;
  display: flex;
  gap: ${spacingIncrement(8)};
  justify-content: space-between;
  min-height: ${spacingIncrement(60)};
  padding: ${spacingIncrement(10)} ${spacingIncrement(16)};
  > div {
    display: contents;
    width: 100%;
    > div {
      width: calc(100% - 16px);
    }
  }
  :hover {
    border-color: ${({ theme }): string => theme.color.neutral5};
  }
  :disabled {
    background-color: ${({ theme }): string => theme.color.neutral12};
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.7;
    :hover {
      border-color: ${({ theme }): string => theme.color.neutral7};
    }
    * {
      cursor: not-allowed;
    }
  }
`

const ChildrenText = styled.p`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(28)};
  margin-bottom: 0;
`

const SlideUpButton: React.FC<Props> = ({ children, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Wrapper type="button" {...props}>
    {typeof children === 'string' ? <ChildrenText>{children}</ChildrenText> : <div>{children}</div>}
    <Icon name="chevron-down" />
  </Wrapper>
)

export default SlideUpButton
