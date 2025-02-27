import LoadingSkeleton from 'react-loading-skeleton'
import styled, { useTheme } from 'styled-components'

type Props = {
  circle?: boolean
  height?: string | number
  width?: string | number
}

const Wrapper = styled.span`
  line-height: 1;
`

// using this skeleton component will give us dark/light mode compatibility
const Skeleton: React.FC<Props> = (props) => {
  const { color } = useTheme()

  return (
    <Wrapper>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <LoadingSkeleton baseColor={color.neutral8} highlightColor={color.neutral10} {...props} />
    </Wrapper>
  )
}
export default Skeleton
