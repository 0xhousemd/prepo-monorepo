import { ethers } from 'hardhat'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import {
  DepositHook,
  WithdrawHook,
  MintHook,
  RedeemHook,
  AccountList,
  AccountList__factory,
  DepositHook__factory,
  WithdrawHook__factory,
  MintHook__factory,
  RedeemHook__factory,
} from '../../types/generated'

export async function depositHookFixture(): Promise<DepositHook> {
  const factory = await ethers.getContractFactory('DepositHook')
  return (await factory.deploy()) as DepositHook
}

export async function withdrawHookFixture(baseTokenDecimals: number): Promise<WithdrawHook> {
  const factory = await ethers.getContractFactory('WithdrawHook')
  return (await factory.deploy(baseTokenDecimals)) as WithdrawHook
}

export async function mintHookFixture(): Promise<MintHook> {
  const factory = await ethers.getContractFactory('MintHook')
  return (await factory.deploy()) as MintHook
}

export async function redeemHookFixture(): Promise<RedeemHook> {
  const factory = await ethers.getContractFactory('RedeemHook')
  return (await factory.deploy()) as RedeemHook
}

export async function smockDepositHookFixture(): Promise<MockContract<DepositHook>> {
  const mockFactory = await smock.mock<DepositHook__factory>('DepositHook')
  return mockFactory.deploy()
}

export async function smockWithdrawHookFixture(
  baseTokenDecimals: number
): Promise<MockContract<WithdrawHook>> {
  const mockFactory = await smock.mock<WithdrawHook__factory>('WithdrawHook')
  return mockFactory.deploy(baseTokenDecimals)
}

export async function smockMintHookFixture(): Promise<MockContract<MintHook>> {
  const mockFactory = await smock.mock<MintHook__factory>('MintHook')
  return mockFactory.deploy()
}

export async function smockRedeemHookFixture(): Promise<MockContract<RedeemHook>> {
  const mockFactory = await smock.mock<RedeemHook__factory>('RedeemHook')
  return mockFactory.deploy()
}

export async function smockAccountListFixture(): Promise<MockContract<AccountList>> {
  const mockFactory = await smock.mock<AccountList__factory>('AccountList')
  return mockFactory.deploy()
}

export function fakeAccountListFixture(): Promise<FakeContract<AccountList>> {
  return smock.fake<AccountList>('AccountList')
}

export function fakeDepositHookFixture(): Promise<FakeContract<DepositHook>> {
  return smock.fake<DepositHook>('DepositHook')
}

export function fakeWithdrawHookFixture(): Promise<FakeContract<WithdrawHook>> {
  return smock.fake<WithdrawHook>('WithdrawHook')
}

export function fakeMintHookFixture(): Promise<FakeContract<MintHook>> {
  return smock.fake<MintHook>('MintHook')
}

export function fakeRedeemHookFixture(): Promise<FakeContract<RedeemHook>> {
  return smock.fake<RedeemHook>('RedeemHook')
}
