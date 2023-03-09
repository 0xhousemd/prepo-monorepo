import styled from 'styled-components'
import { Button, Flex, spacingIncrement } from 'prepo-ui'
import { useState } from 'react'
import Card from '../../components/Card'

const Title = styled.h1`
  color: ${({ theme }): string => theme.color.secondary};
`

const TermsContent = styled(Card)`
  color: ${({ theme }): string => theme.color.neutral3};
  max-width: ${spacingIncrement(480)};

  &&& {
    .ant-card-body {
      align-items: center;
      display: flex;
      flex-direction: column;
    }
  }
`

const TermsList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(24)};
  max-height: ${spacingIncrement(408)};
  overflow-y: auto;
  padding: 0 ${spacingIncrement(16)};
`

const AgreeButton = styled(Button)`
  width: 100%;

  &&& {
    .ant-btn {
      width: 100%;
    }
  }
`

const TermsPage: React.FC = () => {
  const [read, setRead] = useState(false)

  return (
    <Flex flexDirection="column" gap={16}>
      <Title>prePO Terms of Service</Title>
      <TermsContent>
        <TermsList
          onScroll={(e): void => {
            if (!(e.target instanceof HTMLUListElement)) return
            const remainingScrollPx =
              e.target.scrollHeight - e.target.scrollTop - e.target.offsetHeight

            if (remainingScrollPx < 16) {
              setRead(true)
            }
          }}
        >
          <li>Lorem Ipsum is simply dummy text of the printing and typesetting industry.</li>
          <li>Lorem Ipsum is simply dummy text of the printing and typesetting industry.</li>
          <li>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
            has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown
            printer took a galley of type and scrambled it to make a type specimen book.
          </li>
          <li>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
            has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown
            printer took a galley of type and scrambled it to make a type specimen book.
          </li>
          <li>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
            has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown
            printer took a galley of type and scrambled it to make a type specimen book.
          </li>
          <li>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
            has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown
            printer took a galley of type and scrambled it to make a type specimen book.
          </li>
          <li>
            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum
            has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown
            printer took a galley of type and scrambled it to make a type specimen book.
          </li>
        </TermsList>
        <AgreeButton disabled={!read}>I Agree</AgreeButton>
      </TermsContent>
    </Flex>
  )
}

export default TermsPage
