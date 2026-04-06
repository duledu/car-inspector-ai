'use client'

import { useEffect, useState } from 'react'
import { communityApi } from '@/services/api/community.api'
import type { Post } from '@/types'
import AppShell from '../AppShell'

/* ── Icons ── */
function HeartIcon({ filled }: Readonly<{ filled: boolean }>) {
  return filled ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

/* ── Time helper ── */
function timeAgo(date: string) {
  const h = Math.floor((Date.now() - new Date(date).getTime()) / 3600000)
  if (h < 1)  return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

/* ── Avatar ── */
function Avatar({ name, size = 26 }: Readonly<{ name: string; size?: number }>) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(129,140,248,0.2))',
      border: '1px solid rgba(34,211,238,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.floor(size * 0.38), fontWeight: 700, color: '#22d3ee',
    }}>
      {initials}
    </div>
  )
}

export default function CommunityPage() {
  const [posts,      setPosts]      = useState<Post[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [title,      setTitle]      = useState('')
  const [content,    setContent]    = useState('')
  const [tags,       setTags]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)

  useEffect(() => { loadPosts() }, [])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const result = await communityApi.getPosts()
      setPosts(result.data)
    } catch { /* show empty state */ }
    finally  { setLoading(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const post = await communityApi.createPost({
        title,
        content,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      setPosts(prev => [post, ...prev])
      setTitle(''); setContent(''); setTags('')
      setShowForm(false)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLike = async (postId: string) => {
    try {
      const result = await communityApi.likePost(postId)
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, likeCount: result.count, isLikedByMe: result.liked } : p
      ))
    } catch { /* silent */ }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 680 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Community</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              Share findings, ask questions, get advice
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              background: showForm ? 'rgba(255,255,255,0.04)' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${showForm ? 'rgba(255,255,255,0.08)' : 'rgba(34,211,238,0.22)'}`,
              color: showForm ? 'rgba(255,255,255,0.45)' : '#22d3ee',
            }}
          >
            {showForm
              ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</>
              : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Post</>
            }
          </button>
        </div>

        {/* ── Create form ── */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,211,238,0.14)', borderRadius: 16, padding: '20px 22px', marginBottom: 18 }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#22d3ee', marginBottom: 16 }}>New Post</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                placeholder="Title — what's it about?"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
              <textarea
                placeholder="Share your findings, ask a question, or describe what you noticed during inspection…"
                value={content}
                onChange={e => setContent(e.target.value)}
                required
                style={{ minHeight: 100 }}
              />
              <input
                placeholder="Tags (comma-separated): e.g. BMW, rust, engine noise"
                value={tags}
                onChange={e => setTags(e.target.value)}
              />
              {formError && (
                <div style={{ padding: '9px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 9, fontSize: 13, color: '#f87171' }}>
                  {formError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit" disabled={submitting}
                  style={{ padding: '10px 22px', background: submitting ? 'rgba(34,211,238,0.5)' : '#22d3ee', color: '#000', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  {submitting ? 'Posting…' : 'Post'}
                </button>
                <button
                  type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Post feed ── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(n => (
              <div key={n} className="skeleton" style={{ height: 110, borderRadius: 14 }} />
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 24px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16 }}>
            <div style={{ width: 54, height: 54, borderRadius: 15, margin: '0 auto 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>No posts yet</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>Be the first to start a discussion.</div>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map(post => (
              <article
                key={post.id}
                style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}
              >
                {/* Title */}
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.2px', lineHeight: 1.3 }}>
                  {post.title}
                </div>

                {/* Excerpt */}
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65, marginBottom: 12 }}>
                  {post.content.length > 240 ? `${post.content.slice(0, 240)}…` : post.content}
                </div>

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 13 }}>
                    {post.tags.map(tag => (
                      <span key={tag} style={{ padding: '2px 8px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.14)', borderRadius: 6, fontSize: 10, fontWeight: 600, color: 'rgba(34,211,238,0.7)', letterSpacing: '0.02em' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer: author + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Avatar name={post.author.name} size={22} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', fontWeight: 500 }}>{post.author.name}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>{timeAgo(post.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => handleLike(post.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: 12, fontWeight: 600,
                        color: post.isLikedByMe ? '#f43f5e' : 'rgba(255,255,255,0.3)',
                        fontFamily: 'var(--font-sans)',
                        minHeight: 32,
                      }}
                    >
                      <HeartIcon filled={!!post.isLikedByMe} />
                      {post.likeCount}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                      <CommentIcon />
                      {post.commentCount}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
