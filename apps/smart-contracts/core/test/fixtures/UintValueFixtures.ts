import { ethers } from 'hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { UniswapV3OracleUintValue, TestUintValue } from '../../types/generated'

export async function testUintValueFixture(): Promise<TestUintValue> {
  const factory = await ethers.getContractFactory('TestUintValue')
  return (await factory.deploy()) as TestUintValue
}

export async function smockTestUintValueFixture(): Promise<MockContract> {
  const mockFactory = await smock.mock('TestUintValue')
  return (await mockFactory.deploy()) as MockContract
}

export function fakeTestUintValueFixture(): Promise<FakeContract<TestUintValue>> {
  return smock.fake<TestUintValue>('TestUintValue')
}

export async function uniswapV3OracleUintValueFixture(
  staticOracle: string,
  baseToken: string,
  quoteToken: string
): Promise<UniswapV3OracleUintValue> {
  const factory = await ethers.getContractFactory('UniswapV3OracleUintValue')
  return (await factory.deploy(staticOracle, baseToken, quoteToken)) as UniswapV3OracleUintValue
}
