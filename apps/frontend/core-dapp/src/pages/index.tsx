import { GetServerSideProps, NextPage } from 'next'
import { Routes } from '../lib/routes'

const Index: NextPage = () => null

// eslint-disable-next-line require-await
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect:
    // will update isProduction to use NODE_ENV check if this works
    // not sure if NODE_ENV's value for production is exactly 'production'
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          destination: Routes.Deposit,
          permanent: false,
        },
  props: {},
})

export default Index
