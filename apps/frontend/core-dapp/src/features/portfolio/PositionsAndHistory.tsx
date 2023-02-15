import { t } from '@lingui/macro'
import { Box, centered, media, spacingIncrement } from 'prepo-ui'
import { useState } from 'react'
import styled, { useTheme } from 'styled-components'
import { observer } from 'mobx-react-lite'
import FilterButton from '../../components/Filter/FilterButton'
import Tabs from '../../components/Tabs'
import History from '../history/History'
import Positions from '../position/Positions'
import { useRootStore } from '../../context/RootStoreProvider'

const StyledTabs = styled(Tabs)`
  &&&& {
    .ant-select-selection-item {
      padding-right: 20px;
    }

    .ant-select-selection-item,
    .ant-tabs-tab-btn {
      font-size: ${({ theme }): string => theme.fontSize.lg};
    }

    .ant-select-arrow {
      left: 100%;
      padding: 0 ${spacingIncrement(6)};
      transform: translate(-100%, -50%);
    }

    .ant-tabs-nav {
      flex-direction: column;
      margin-bottom: 0;
      ${media.desktop`
        flex-direction: row;
      `}
    }

    .ant-tabs-nav-wrap {
      padding: ${spacingIncrement(16)};
      padding-bottom: ${spacingIncrement(2)};
    }

    .ant-tabs-extra-content {
      ${media.desktop`
        width: auto;
        padding: 0 ${spacingIncrement(30)};
      `}
      align-items: flex-end;
      display: flex;
      justify-content: flex-end;
      padding: ${spacingIncrement(20)} ${spacingIncrement(37)};
      width: 100%;
    }

    .ant-tabs-tab {
      display: flex;
      flex: 1;
      padding: 0 0 ${spacingIncrement(4)};
      width: 100%;
    }

    .ant-tabs-nav-list {
      display: grid;
      gap: ${spacingIncrement(30)};
      grid-template-columns: auto auto;
    }

    .ant-tabs-nav-list,
    .ant-tabs-tab,
    .ant-tabs-tab .ant-tabs-tab-active {
      ${centered}
    }

    .ant-tabs-ink-bar {
      border-radius: 1px 1px 0 0;
      height: ${spacingIncrement(4)};
    }
  }
`

const PositionsAndHistory: React.FC = () => {
  const { web3Store } = useRootStore()
  const [activeTab, setActiveTab] = useState(0)
  const { borderRadius, shadow } = useTheme()
  const { connected } = web3Store

  return (
    <Box borderRadius={borderRadius.lg} boxShadow={shadow.prepo} width="100%">
      <StyledTabs
        disableMore
        tabBarExtraContent={activeTab === 1 && connected && <FilterButton />}
        size="large"
        onChange={(e): void => setActiveTab(+e)}
        styles={{ activeColor: 'secondary', activeTextWeight: 'semiBold', color: 'neutral2' }}
        tab={[
          {
            heading: t`Positions`,
            content: <Positions />,
          },
          {
            heading: t`History`,
            content: <History />,
          },
        ]}
        animated={false}
      />
    </Box>
  )
}

export default observer(PositionsAndHistory)
