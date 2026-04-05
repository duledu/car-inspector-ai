// =============================================================================
// Messages Page — /messages
// =============================================================================

'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChatStore } from '@/store'
import { ConversationList } from '@/components/messaging/ConversationList'
import { MessageThread } from '@/components/messaging/MessageThread'
import { EmptyConversation } from '@/components/messaging/EmptyConversation'
import AppShell from '../AppShell'

export default function MessagesPage() {
  const searchParams = useSearchParams()
  const convId = searchParams.get('conv')

  const {
    conversations,
    activeConversationId,
    fetchConversations,
    setActiveConversation,
    fetchMessages,
  } = useChatStore()

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (convId) setActiveConversation(convId)
    else if (conversations.length > 0 && !activeConversationId) {
      setActiveConversation(conversations[0].id)
    }
  }, [convId, conversations.length])

  useEffect(() => {
    if (activeConversationId) fetchMessages(activeConversationId)
  }, [activeConversationId])

  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  return (
    <AppShell>
      {/* Full-bleed chat layout — override default page padding */}
      <div style={{ margin: -24, height: 'calc(100vh - 52px)', display: 'flex' }}>
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={setActiveConversation}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeConversation ? (
            <MessageThread conversation={activeConversation} />
          ) : (
            <EmptyConversation />
          )}
        </div>
      </div>
    </AppShell>
  )
}
