// =============================================================================
// MessageThread Component
// Right panel of the Messages page. Shows messages + input.
// =============================================================================

'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatStore, useUserStore } from '@/store'
import type { Conversation } from '@/types'

interface Props {
  readonly conversation: Conversation
}

export function MessageThread({ conversation }: Readonly<Props>) {
  const { user } = useUserStore()
  const { getMessages, sendMessage, isSending } = useChatStore()
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages = getMessages(conversation.id)
  const otherParticipant = conversation.participants.find((p) => p.userId !== user?.id)?.user

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return
    const content = inputValue.trim()
    setInputValue('')
    try {
      await sendMessage({ conversationId: conversation.id, content })
    } catch {
      setInputValue(content) // restore on failure
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherInitials =
    otherParticipant?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '??'

  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#0080ff,#a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {otherInitials}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{otherParticipant?.name ?? 'User'}</div>
          <div style={{ fontSize: 11, color: '#00e676' }}>● Online</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            aria-label="Attach file"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          scrollbarWidth: 'thin',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              fontSize: 13,
              color: 'var(--color-text-secondary)',
            }}
          >
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: 10,
                flexDirection: isMe ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
              }}
            >
              {!isMe && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#0080ff,#00d4ff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {otherInitials}
                </div>
              )}
              <div>
                <div
                  style={{
                    maxWidth: 480,
                    padding: '10px 14px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: isMe
                      ? 'linear-gradient(135deg,#0080ff,rgba(0,212,255,0.8))'
                      : 'rgba(255,255,255,0.06)',
                    color: isMe ? '#000' : 'var(--color-text-primary)',
                    border: isMe ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-secondary)',
                    marginTop: 3,
                    textAlign: isMe ? 'right' : 'left',
                  }}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {isMe && msg.readAt && ' · Read'}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send)"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 22,
            padding: '10px 18px',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
          aria-label="Send message"
          style={{
            width: 40,
            height: 40,
            background: 'linear-gradient(135deg,#0080ff,#00d4ff)',
            border: 'none',
            borderRadius: '50%',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: inputValue.trim() ? 1 : 0.5,
            transition: 'all 0.2s ease',
            color: '#fff',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function EmptyConversation() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        color: 'var(--color-text-secondary)',
      }}
    >
      <div style={{ fontSize: 48 }}>💬</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Select a conversation</div>
      <div style={{ fontSize: 13 }}>Or start a new one from the community</div>
    </div>
  )
}
