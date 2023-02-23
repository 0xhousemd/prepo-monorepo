import React from 'react'
import { Box, Flex, Grid, Icon, spacingIncrement, Subtitle } from 'prepo-ui'
import { Tooltip } from 'antd'
import styled from 'styled-components'
import Link from 'next/link'
import PositionLabel from './PositionLabel'
import Percent from '../../components/Percent'
import { PositionEntity } from '../../stores/entities/Position.entity'
import { numberFormatter } from '../../utils/numberFormatter'
import Skeleton from '../../components/Skeleton'

const { toUsd } = numberFormatter

export const PositionName = styled.p`
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  color: ${({ theme }): string => theme.color.secondary};
  display: -webkit-box;
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin-bottom: 0;
  overflow: hidden;
`
const PositionValue = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  margin: 0;
`
const StyledSubtitle = styled(Subtitle)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`
const StyledPositionLabel = styled(PositionLabel).attrs({ withBackground: true })`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.regular};
`

export const MarketIcon = styled(Icon).attrs({
  // Override the Icon component's inline style (display: flex)
  style: {},
})`
  display: none;

  @media (min-width: ${spacingIncrement(340)}) {
    display: flex;
  }
`

const IconLink = styled.a`
  align-items: center;
  background: ${({ theme }): string => theme.color.accentPurple};
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: 2px;

  :hover {
    opacity: 0.8;
  }
`
type PositionProps = {
  direction: PositionEntity['direction']
  growthPercentage: PositionEntity['positionGrowthPercentage']
  iconName: PositionEntity['market']['iconName']
  marketUrlId: PositionEntity['market']['urlId']
  name: PositionEntity['market']['name']
  totalPnl: PositionEntity['totalPnl']
  totalValue: PositionEntity['totalValue']
}
export const Position: React.FC<PositionProps> = ({
  direction,
  growthPercentage,
  iconName,
  marketUrlId,
  name,
  totalPnl,
  totalValue,
}) => (
  <Flex justifyContent="start" gap={8} width="100%">
    <MarketIcon name={iconName} height={spacingIncrement(48)} width={spacingIncrement(48)} />
    <Flex flexDirection="column" alignItems="start">
      <PositionName>{name}</PositionName>
      <Flex gap={4} alignItems="center">
        <>
          <PositionValue>{toUsd(totalValue)}</PositionValue>
          {growthPercentage && (
            <Percent
              format={(percentValue): string => `(${percentValue})`}
              percentagePrecision={2}
              showPlusSign
              styles={{ fontWeight: 'regular' }}
              value={growthPercentage}
            />
          )}
        </>
        <Tooltip
          overlay={
            <Grid gridTemplateColumns="1fr 1fr" gap={4} style={{ textAlign: 'start' }}>
              <StyledSubtitle>Profit</StyledSubtitle>
              <Flex gap={4}>
                <>
                  <PositionValue>{toUsd(totalPnl)}</PositionValue>
                  {growthPercentage && (
                    <Percent
                      format={(percentValue): string => `(${percentValue})`}
                      percentagePrecision={2}
                      showPlusSign
                      styles={{ fontWeight: 'regular' }}
                      value={growthPercentage}
                    />
                  )}
                </>
              </Flex>
            </Grid>
          }
        >
          <Box>
            <Icon
              name="info"
              height={spacingIncrement(16)}
              width={spacingIncrement(16)}
              color="neutral5"
            />
          </Box>
        </Tooltip>
      </Flex>
    </Flex>
    <Flex flexDirection="column" ml="auto" gap={6}>
      <StyledPositionLabel positionType={direction} />
      <Flex gap={8}>
        <Link
          href={{
            pathname: '/trade',
            query: {
              action: 'open',
              direction,
              marketId: marketUrlId,
            },
          }}
          passHref
        >
          <IconLink>
            <Icon name="plus" color="primaryLight" width="12px" height="12px" />
          </IconLink>
        </Link>
        <Link
          href={{
            pathname: '/trade',
            query: {
              action: 'close',
              direction,
              marketId: marketUrlId,
            },
          }}
          passHref
        >
          <IconLink>
            <Icon name="minus" color="primaryLight" width="12px" height="12px" />
          </IconLink>
        </Link>
      </Flex>
    </Flex>
  </Flex>
)

export const PositionSkeleton: React.FC = () => (
  <Flex justifyContent="start" gap={8} width="100%">
    <Skeleton circle height={48} width={48} />
    <Flex gap={4} flexDirection="column" alignItems="start">
      <Skeleton height={12} width={80} />
      <Flex gap={4} alignItems="center">
        <Skeleton height={12} width={50} />
        <Skeleton height={12} width={50} />
      </Flex>
    </Flex>
    <Flex flexDirection="column" ml="auto" gap={6}>
      <Skeleton height={18} width={40} />
      <Flex gap={8}>
        <Skeleton height={14} width={14} />
        <Skeleton height={14} width={14} />
      </Flex>
    </Flex>
  </Flex>
)
