import { NextPage } from 'next'
import Error from 'next/error'
import SEO from '../../components/SEO'
import PortfolioFeature from '../../features/portfolio/Portfolio'
import { isProduction } from '../../utils/isProduction'

const Portfolio: NextPage = () =>
  isProduction() ? (
    <Error statusCode={404} />
  ) : (
    <>
      <SEO
        title="Portfolio | prePO"
        description="Explore your portfolio on prePO"
        ogImageUrl="/prepo-og-image.png"
      />
      <PortfolioFeature />
    </>
  )

export default Portfolio
