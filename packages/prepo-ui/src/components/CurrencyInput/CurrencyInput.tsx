import { InputProps } from 'antd'
import { displayDecimals } from 'prepo-utils'
import { useMemo, useState } from 'react'
import styled, {
  css,
  DefaultTheme,
  FlattenInterpolation,
  SimpleInterpolation,
  ThemeProps,
} from 'styled-components'
import { spacingIncrement } from '../../common-utils'
import { removeUserSelect } from '../../themes/core-dapp'
import Flex from '../Flex'
import Icon from '../Icon'
import { IconName } from '../Icon/icon.types'

export type CurrencyType = { icon: IconName; text: string; onClick?: () => void }

type Props = {
  balance?: string
  balanceNotVisible?: boolean
  isBalanceZero?: boolean
  disabled?: boolean
  onChange?: (e: string) => void
  showBalance?: boolean
}

const Balance = styled(Flex)`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`

const MaxButton = styled.button`
  ${({ theme }): SimpleInterpolation =>
    theme.isDarkMode
      ? css`
          color: ${theme.color.darkPrimaryLight};

          :hover {
            color: ${theme.color.white};
          }
        `
      : css`
          color: ${theme.color.primary};

          :hover {
            color: ${theme.color.darkPrimaryLight};
          }
        `};

  align-items: center;
  background: rgba(155, 157, 255, 0.25);
  border: none;
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  font-size: ${spacingIncrement(11)};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  height: ${spacingIncrement(16)};
  margin-left: ${spacingIncrement(4)};
  padding: ${spacingIncrement(2)} ${spacingIncrement(6)};
`

const Wrapper = styled(Flex)<{ disabled?: boolean }>`
  border: 1px solid ${({ theme }): string => theme.color.neutral12};
  cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'auto')};
  :hover {
    border: 1px solid
      ${({ disabled, theme }): string => theme.color[disabled ? 'neutral12' : 'neutral7']};
  }
`

const StyledInput = styled.input<{ disabled?: boolean }>`
  background: transparent;
  border: none;
  color: ${({ theme }): string => theme.color.neutral1};
  cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'auto')};
  font-size: ${({ theme }): string => theme.fontSize['2xl']};
  font-weight: ${({ theme }): number => theme.fontWeight.regular};
  min-width: ${spacingIncrement(40)};
  text-overflow: ellipsis;
  &:focus {
    outline: none;
  }
`
const FlexText = styled(Flex)<{ clickable?: boolean; disabled?: boolean }>`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${({ disabled }): FlattenInterpolation<ThemeProps<DefaultTheme>> =>
    disabled ? removeUserSelect : css``}
  ${({ clickable, disabled }): FlattenInterpolation<ThemeProps<DefaultTheme>> =>
    clickable
      ? css`
          box-shadow: 0 6px 10px rgba(0, 0, 0, 0.08);
          cursor: ${disabled ? 'default' : 'pointer'};
        `
      : css``}
`

const Currency: React.FC<{ disabled?: boolean; currency: CurrencyType }> = ({
  disabled,
  currency,
}) => (
  <FlexText
    disabled={disabled}
    borderRadius={16}
    onClick={currency.onClick}
    p={8}
    pr={12}
    background="neutral13"
    gap={4}
    height={40}
    clickable={currency.onClick !== undefined}
  >
    <Flex gap={8}>
      <Flex borderRadius="24px" overflow="hidden">
        <Icon name={currency.icon} height="24px" width="24px" />
      </Flex>
      {currency.text}
    </Flex>
    {currency.onClick !== undefined && <Icon name="chevron-down" width="12px" height="12px" />}
  </FlexText>
)

const CurrencyInput: React.FC<
  Omit<InputProps, 'onChange'> &
    Props & {
      currency: CurrencyType
      max?: number
    }
> = ({
  balance,
  balanceNotVisible,
  disabled,
  isBalanceZero,
  onFocus,
  onBlur,
  placeholder,
  value,
  onChange,
  currency,
  children,
  showBalance,
  max = 99_999,
}) => {
  const [focused, setFocused] = useState(false)

  const handleFocus = (e: React.FocusEvent<HTMLInputElement, Element>): void => {
    setFocused(true)
    if (onFocus) onFocus(e)
  }

  const handleMax = (): void => {
    if (onChange && balance !== undefined) onChange(balance)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    try {
      if (!onChange) return

      if (!Number.isNaN(+e.target.value) && +e.target.value > max) {
        onChange(max.toString())
      } else {
        onChange(e.target.value)
      }
    } catch (error) {
      // invalid input
    }
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement, Element>): void => {
    setFocused(false)
    if (onBlur) onBlur(e)
  }

  const inputValue = useMemo(() => {
    if (value === undefined || value === '') return ''
    const valueParts = `${value}`.split('.')
    // only format significant number so we can remain the long decimals
    const formattedSignificantNumber = Number(valueParts[0]).toLocaleString()
    if (focused) return value
    if (valueParts[1] && valueParts.length > 0)
      return `${formattedSignificantNumber}.${valueParts[1]}`
    return formattedSignificantNumber
  }, [focused, value])

  return (
    <Wrapper
      opacity={disabled ? 0.6 : 1}
      background="neutral12"
      borderRadius={20}
      p={16}
      alignItems="stretch"
      flexDirection="column"
      gap={4}
      disabled={disabled}
    >
      <Flex justifyContent="space-between">
        <StyledInput
          disabled={disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
        />
        <Currency disabled={disabled} currency={currency} />
      </Flex>
      {showBalance && (
        <Balance alignSelf="flex-end" height={16}>
          {balance !== undefined && !balanceNotVisible && (
            <>
              {`Balance: ${displayDecimals(balance)}`}
              {value !== balance && !isBalanceZero && (
                <MaxButton disabled={disabled} onClick={handleMax}>
                  MAX
                </MaxButton>
              )}
            </>
          )}
        </Balance>
      )}
      {children}
    </Wrapper>
  )
}

export default CurrencyInput
