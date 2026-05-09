// =============================================================================
// Messages Page — /messages
// =============================================================================

'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChatStore } from '@/store'
import { featureFlags } from '@/config/features'
import { ConversationList } from '@/components/messaging/ConversationList'
import { MessageThread } from '@/components/messaging/MessageThread'
import { EmptyConversation } from '@/components/messaging/EmptyConversation'
import { FeatureUnavailable } from '@/components/layout/FeatureUnavailable'
import AppShell from '../AppShell'

export default function MessagesPage() {
  if (!featureFlags.messages) {
    return (
      <FeatureUnavailable
        title="Messages are not available yet"
        description="Private messaging is temporarily unavailable while user safety and abuse handling tools are prepared for launch."
      />
    )
  }

  return (
    <Suspense>
      <MessagesPageContent />
    </Suspense>
  )
}

function MessagesPageContent() {
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
      <div style={{ margin: -24, height: 'calc(100dvh - 52px - env(safe-area-inset-bottom, 0px))', display: 'flex' }}>
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
