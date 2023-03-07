import { Trans } from '@lingui/macro'
import React from 'react'
import styled from 'styled-components'

const Link = styled.a`
  font-weight: ${({ theme }): number => theme.fontWeight.bold};
  text-decoration: underline;
  white-space: nowrap;
`

const LearnMore: React.FC<{ link: string }> = ({ link }) => (
  <Link target="_blank" href={link} rel="noopener noreferrer">
    <Trans>Learn More</Trans>
  </Link>
)

const Paragraph = styled.p`
  margin: 0;
`

export const EstimatedReceivedAmount: React.FC = () => (
  <Paragraph>
    <Trans>
      The estimated ETH value that will be credited to your prePO account, after any conversion
      costs, slippage, and fees.
    </Trans>
  </Paragraph>
)

export const EstimatedWithdrawalReceivedAmount: React.FC = () => (
  <Paragraph>
    <Trans>Estimated ETH amount received after any conversion costs, slippage, and fees.</Trans>
  </Paragraph>
)

export const EstimatedValuation: React.FC = () => (
  <Paragraph>
    <Trans>
      Your expected valuation price for this trade, after accounting for any fees and price impact.
      You may receive a better or worse price if the market price changes before your transaction is
      confirmed.
    </Trans>
  </Paragraph>
)

export const EstimateYourProfitLoss: React.FC = () => (
  <Paragraph>
    <Trans>
      This is just an illustration to show how much you will gain/lose when you close your position.
    </Trans>
  </Paragraph>
)

export const ExpiryDate: React.FC = () => (
  <Paragraph>
    <Trans>
      After this date, the market will automatically resolve at the lower bound of the valuation
      range.
    </Trans>
  </Paragraph>
)

export const PayoutRange: React.FC = () => (
  <Paragraph>
    <Trans>
      A percentage range representing the minimum and maximum portion of a market&apos;s total USD
      collateral that can be redeemed by Long positions vs. Short positions.
    </Trans>
    &nbsp;
    <LearnMore link="https://docs.prepo.io/concepts/markets#payout-range" />
  </Paragraph>
)

export const PPOReward: React.FC = () => (
  <Paragraph>
    <Trans>
      The amount of PPO that you will receive immediately as a rebate incentive. PPO is prePO’s
      governance and utility token.
    </Trans>
  </Paragraph>
)

export const TransactionFee: React.FC = () => <Paragraph>Fee paid to the prePO Treasury</Paragraph>

export const ValuationRange: React.FC = () => (
  <Paragraph>
    <Trans>
      A range between two fully-diluted valuations, typically expressed in millions or billions or
      dollars.&nbsp;
    </Trans>
    <LearnMore link="https://docs.prepo.io/concepts/markets#valuation-range" />
  </Paragraph>
)
