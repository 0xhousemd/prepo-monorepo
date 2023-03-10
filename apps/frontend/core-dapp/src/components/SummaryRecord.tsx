import { Flex, Icon, spacingIncrement, Tooltip } from 'prepo-ui'
import styled from 'styled-components'
import Skeleton from './Skeleton'

type Props = {
  label: string
  tooltip?: React.ReactNode
  loading?: boolean
}

const LabelText = styled.p`
  font-size: ${({ theme }): string => theme.fontSize.xs};
  line-height: ${spacingIncrement(22)};
  white-space: nowrap;
`

const ValueCol = styled(Flex)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  text-align: right;
`

const Wrapper = styled(Flex)`
  color: ${({ theme }): string => theme.color.neutral3};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`
const SummaryRecord: React.FC<Props> = ({ children, label, loading, tooltip }) => (
  <Wrapper alignItems="flex-start" justifyContent="space-between" width="100%">
    <Flex gap={4}>
      <LabelText>{label}</LabelText>
      {tooltip !== undefined && (
        <Tooltip overlay={tooltip}>
          <Icon name="info-outlined" color="neutral5" height="14" width="14" />
        </Tooltip>
      )}
    </Flex>
    <ValueCol>{loading ? <Skeleton height="22px" width="64px" /> : children}</ValueCol>
  </Wrapper>
)

export default SummaryRecord
