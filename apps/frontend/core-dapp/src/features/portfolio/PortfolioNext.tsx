import styled from 'styled-components'
import { Grid } from 'prepo-ui'
import PositionsAndHistory from './PositionsAndHistoryNext'
import PortfolioValue from './PortfolioValue'

const Container = styled(Grid)`
  --portfolio-size: 16.5rem;
  --positions-size: 27.875rem;
`

const Portfolio: React.FC = () => (
  <Container
    gridTemplateColumns={{
      phone: '1fr',
      desktop: 'var(--portfolio-size) var(--positions-size) minmax(auto, var(--portfolio-size))',
    }}
    gap="2rem"
    flex={{ phone: 1, desktop: 'initial' }}
    margin="0 auto"
    width={{
      phone: '100%',
      desktop: 'fit-content',
    }}
  >
    <PortfolioValue />
    <PositionsAndHistory />
  </Container>
)

export default Portfolio
