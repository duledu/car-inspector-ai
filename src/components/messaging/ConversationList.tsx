// =============================================================================
// ConversationList Component
// Left panel of the Messages page.
// =============================================================================

'use client'

import type { Conversation } from '@/types'

interface ConversationListProps {
  readonly conversations: Conversation[]
  readonly activeId: string | null
  readonly onSelect: (id: string) => void
}

export function ConversationList({ conversations, activeId, onSelect }: Readonly<ConversationListProps>) {
  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700 }}>Messages</div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New
        </button>
      </div>

      {/* Conversation items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <div
            style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}
          >
            No conversations yet
          </div>
        ) : (
          conversations.map((conv) => {
            const other = conv.participants[0]?.user
            const isActive = conv.id === activeId
            const initials = other?.name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) ?? '??'

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  width: '100%',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  border: 'none',
                  borderBottomColor: 'rgba(255,255,255,0.03)',
                  borderBottomWidth: 1,
                  borderBottomStyle: 'solid',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#0080ff,#00d4ff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: conv.unreadCount > 0 ? 700 : 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {other?.name ?? 'Unknown'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 2,
                    }}
                  >
                    {conv.lastMessage?.content ?? 'No messages yet'}
                  </div>
                </div>

                {/* Meta */}
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
                >
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                    {conv.updatedAt
                      ? new Date(conv.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </div>
                  {conv.unreadCount > 0 && (
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#00d4ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#000',
                      }}
                    >
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </div>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
