import { GetStaticProps, NextPage } from 'next'
import SEO from '../../components/SEO'
import DepositPage from '../../features/deposit/DepositPage'

const Deposit: NextPage<{ apr: unknown }> = ({ apr }) => (
  <>
    <SEO
      title="Deposit | prePO"
      description="Explore your portfolio on prePO"
      ogImageUrl="/prepo-og-image.png"
    />
    <DepositPage apr={apr} />
  </>
)

export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch('https://stake.lido.fi/api/sma-steth-apr')
  const apr = await res.json()
  return {
    props: { apr, revalidate: 3600 },
  }
}
export default Deposit
