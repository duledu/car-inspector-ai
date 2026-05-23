describe('auth email verification gate', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  }

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-for-email-verification-gate'

    jest.doMock('@/config/prisma', () => ({
      prisma: prismaMock,
    }))
  })

  function reqWithToken(token: string) {
    return {
      cookies: {
        get: (name: string) => name === 'uci_at' ? { value: token } : undefined,
      },
    } as any
  }

  it('rejects unverified users by default', async () => {
    const { issueTokens, requireAuth } = await import('@/utils/auth.middleware')
    const { accessToken } = issueTokens('user-1', 'new@example.com', 'USER', false)

    const result = await requireAuth(reqWithToken(accessToken))

    expect(result).toEqual({ success: false, reason: 'Email verification required' })
  })

  it('allows unverified users only when explicitly requested', async () => {
    const { issueTokens, requireAuth } = await import('@/utils/auth.middleware')
    const { accessToken } = issueTokens('user-1', 'new@example.com', 'USER', false)

    const result = await requireAuth(reqWithToken(accessToken), { allowUnverified: true })

    expect(result).toMatchObject({
      success: true,
      userId: 'user-1',
      email: 'new@example.com',
      role: 'USER',
      emailVerified: false,
    })
  })

  it('allows verified users', async () => {
    const { issueTokens, requireAuth } = await import('@/utils/auth.middleware')
    const { accessToken } = issueTokens('user-1', 'verified@example.com', 'USER', true)

    const result = await requireAuth(reqWithToken(accessToken))

    expect(result).toMatchObject({
      success: true,
      userId: 'user-1',
      email: 'verified@example.com',
      emailVerified: true,
    })
  })

  it('checks the database for legacy tokens without an emailVerified claim', async () => {
    const jwt = await import('jsonwebtoken')
    const { requireAuth } = await import('@/utils/auth.middleware')
    prismaMock.user.findUnique.mockResolvedValue({ emailVerified: new Date() })
    const legacyToken = jwt.default.sign(
      { sub: 'user-1', email: 'legacy@example.com', role: 'USER' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' },
    )

    const result = await requireAuth(reqWithToken(legacyToken))

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { emailVerified: true },
    })
    expect(result).toMatchObject({ success: true, emailVerified: true })
  })
})
