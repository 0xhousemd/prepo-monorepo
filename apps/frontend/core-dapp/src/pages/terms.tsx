import TermsPage from '../features/terms/TermsPage'
import SEO from '../components/SEO'

const TradeMarketPage: React.FC = () => (
  <>
    <SEO
      title="Terms | prePO"
      description="Trade pre-IPO stocks & pre-IDO tokens on prePO"
      ogImageUrl="/prepo-og-image.png"
    />
    <TermsPage />
  </>
)

export default TradeMarketPage
