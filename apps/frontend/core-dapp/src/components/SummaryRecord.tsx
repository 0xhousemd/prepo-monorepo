import { Flex, Icon, Tooltip } from 'prepo-ui'
import styled from 'styled-components'

type Props = {
  label: string
  tooltip?: React.ReactNode
}

const LabelText = styled.p`
  font-size: ${({ theme }): string => theme.fontSize.xs};
`

const ValueCol = styled(Flex)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
`

const Wrapper = styled(Flex)`
  color: ${({ theme }): string => theme.color.neutral3};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`
const SummaryRecord: React.FC<Props> = ({ children, label, tooltip }) => (
  <Wrapper alignItems="center" justifyContent="space-between" width="100%">
    <Flex gap={4}>
      <LabelText>{label}</LabelText>
      {tooltip !== undefined && (
        <Tooltip overlay={tooltip}>
          <Icon name="info" color="neutral5" height="16" width="16" />
        </Tooltip>
      )}
    </Flex>
    <ValueCol>{children}</ValueCol>
  </Wrapper>
)

export default SummaryRecord
