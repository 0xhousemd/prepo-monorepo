import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomicfoundation/hardhat-chai-matchers'
import '@typechain/ethers-v5'
import '@typechain/hardhat'
import '@openzeppelin/hardhat-upgrades'
import { config as dotenvConfig } from 'dotenv'
import 'hardhat-contract-sizer'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import { HardhatUserConfig } from 'hardhat/config'
import { generateHardhatConfig, generateHardhatLocalConfig } from 'prepo-hardhat'
import { resolve } from 'path'
import 'solidity-coverage'

dotenvConfig({ path: resolve(__dirname, './.env') })

const hardhatLocalConfig = generateHardhatLocalConfig()
const hardhatConfig = generateHardhatConfig(hardhatLocalConfig)

const config: HardhatUserConfig = {
  ...hardhatConfig,
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 9999,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  typechain: {
    outDir: 'types/generated',
    target: 'ethers-v5',
    externalArtifacts: ['./externalArtifacts/**/*.json'],
  },
  /**
   * This can't be put in the shared local config since the `etherscan` field
   * is not a native Hardhat field and injected by `@nomiclabs/hardhat-ethers`.
   */
  etherscan: {
    apiKey: {
      // ethereum
      mainnet: hardhatLocalConfig.ETHERSCAN_API_KEY,
      ropsten: hardhatLocalConfig.ETHERSCAN_API_KEY,
      rinkeby: hardhatLocalConfig.ETHERSCAN_API_KEY,
      goerli: hardhatLocalConfig.ETHERSCAN_API_KEY,

      // arbitrum
      arbitrumOne: hardhatLocalConfig.ARBISCAN_API_KEY,
      arbitrumTestnet: hardhatLocalConfig.ARBISCAN_API_KEY,

      // polygon
      polygon: hardhatLocalConfig.POLYGONSCAN_API_KEY,
      polygonMumbai: hardhatLocalConfig.POLYGONSCAN_API_KEY,
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
  },
}

export default config
