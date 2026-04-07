// =============================================================================
// Used Car Inspector AI — Core Type Definitions
// All shared types used across modules, services, and components
// =============================================================================

// ─── Auth & Users ─────────────────────────────────────────────────────────────

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  role: UserRole
  createdAt: string
}

export interface AuthSession {
  user: AuthUser
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export type SellerType = 'PRIVATE' | 'DEALER' | 'INDEPENDENT_DEALER'
export type VehicleStatus = 'ACTIVE' | 'PURCHASED' | 'PASSED' | 'ARCHIVED'

export interface Vehicle {
  id: string
  userId: string
  make: string
  model: string
  year: number
  mileage?: number | null
  askingPrice?: number | null
  currency: string
  sellerType: SellerType
  engineCc?: number | null
  powerKw?: number | null
  vin?: string | null
  notes?: string | null
  status: VehicleStatus
  createdAt: string
  updatedAt: string
}

export interface CreateVehiclePayload {
  make: string
  model: string
  year: number
  mileage?: number
  askingPrice?: number
  currency?: string
  sellerType?: SellerType
  engineCc?: number
  powerKw?: number
  vin?: string
  notes?: string
}

// ─── Inspection ───────────────────────────────────────────────────────────────

export type InspectionPhase =
  | 'PRE_SCREENING' | 'AI_PHOTOS' | 'EXTERIOR' | 'INTERIOR'
  | 'MECHANICAL' | 'TEST_DRIVE' | 'VIN_DOCS' | 'RISK_ANALYSIS' | 'FINAL_REPORT'

export type ChecklistCategory =
  | 'PRE_SCREENING' | 'EXTERIOR' | 'INTERIOR'
  | 'MECHANICAL' | 'TEST_DRIVE' | 'DOCUMENTS'

export type ItemStatus = 'PENDING' | 'OK' | 'WARNING' | 'PROBLEM'

export interface ChecklistItem {
  id: string
  sessionId: string
  category: ChecklistCategory
  itemKey: string
  itemLabel: string
  status: ItemStatus
  notes?: string | null
  photoUrl?: string | null
}

export interface InspectionSession {
  id: string
  userId: string
  vehicleId: string
  phase: InspectionPhase
  completedAt?: string | null
  checklistItems: ChecklistItem[]
  createdAt: string
}

export interface UpdateChecklistItemPayload {
  status: ItemStatus
  notes?: string
  photoUrl?: string
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

export type AISeverity = 'critical' | 'warning' | 'info'

export interface AIFinding {
  id: string
  area: string
  title: string
  description: string
  severity: AISeverity
  confidence: number // 0-100
  boundingBox?: { x: number; y: number; w: number; h: number }
}

export interface AIAnalysisResult {
  id: string
  vehicleId: string
  photoId?: string
  findings: AIFinding[]
  overallScore: number // 0-100, higher = fewer problems
  modelVersion: string
  processingMs?: number
  createdAt: string
}

export type PhotoAngle =
  | 'FRONT' | 'REAR' | 'LEFT_SIDE' | 'RIGHT_SIDE'
  | 'FRONT_LEFT_45' | 'FRONT_RIGHT_45' | 'ENGINE_BAY' | 'INTERIOR' | 'DETAIL'

export interface Photo {
  id: string
  vehicleId: string
  url: string
  angle: PhotoAngle
  mimeType: string
  sizeBytes: number
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

export type Verdict = 'STRONG_BUY' | 'BUY_WITH_CAUTION' | 'HIGH_RISK' | 'WALK_AWAY'

export interface ScoreDimension {
  label: string
  score: number       // 0-100
  weight: number      // percentage weight in final calculation
  explanation: string
}

export interface RiskScore {
  id: string
  vehicleId: string
  buyScore: number         // 0-100
  riskScore: number        // 100 - buyScore
  verdict: Verdict
  dimensions: {
    ai: ScoreDimension
    exterior: ScoreDimension
    interior: ScoreDimension
    mechanical: ScoreDimension
    vin: ScoreDimension
    testDrive: ScoreDimension
    documents: ScoreDimension
  }
  hasPremiumData: boolean
  reasonsFor: string[]     // top 5
  reasonsAgainst: string[] // top 5
  createdAt: string
}

export interface ScoreCalculationInput {
  aiFindings: AIFinding[]
  checklistItems: ChecklistItem[]
  vinData?: VehicleHistoryResult | null
  testDriveRatings: Record<string, number>
  hasPremiumHistory: boolean
}

// ─── Vehicle History / CarVertical Integration ────────────────────────────────

export interface MileageRecord {
  year: number
  month?: number
  km: number
  source: string
}

export interface DamageRecord {
  date: string
  type: string
  severity: 'minor' | 'moderate' | 'severe'
  repairCostEstimate?: number
  currency?: string
}

export interface OwnershipRecord {
  fromDate: string
  toDate?: string
  country: string
  ownerType: 'private' | 'fleet' | 'dealer'
}

export interface RecallItem {
  id: string
  description: string
  status: 'complete' | 'incomplete' | 'unknown'
  date?: string
}

export type RiskFlag =
  | 'MILEAGE_ROLLBACK' | 'ACCIDENT_HISTORY' | 'TOTAL_LOSS'
  | 'STOLEN' | 'OUTSTANDING_FINANCE' | 'IMPORT' | 'TAXI_USE' | 'FLOOD_DAMAGE'

// Normalized internal format — provider-agnostic
export interface VehicleHistoryResult {
  vin: string
  make: string
  model: string
  year: number
  engineSpec?: string
  countryOfOrigin?: string
  accidentCount: number
  mileageHistory: MileageRecord[]
  damageHistory: DamageRecord[]
  ownershipHistory: OwnershipRecord[]
  theftStatus: 'clean' | 'reported_stolen'
  outstandingFinance: boolean
  totalLoss: boolean
  recalls: RecallItem[]
  riskFlags: RiskFlag[]
  dataSource: string
  fetchedAt: string
}

// Interface all VIN providers must implement
export interface VehicleHistoryProviderInterface {
  providerId: string
  providerName: string
  getVehicleHistory(vin: string): Promise<VehicleHistoryResult>
  getMileageHistory(vin: string): Promise<MileageRecord[]>
  getDamageHistory(vin: string): Promise<DamageRecord[]>
  getOwnershipHistory(vin: string): Promise<OwnershipRecord[]>
  isAvailable(): Promise<boolean>
}

// ─── Payments & Premium Access ────────────────────────────────────────────────

export type PremiumProduct = 'CARVERTICAL_REPORT' | 'AI_DEEP_SCAN' | 'FULL_INSPECTION_BUNDLE'
export type PaymentStatus = 'NOT_PURCHASED' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'EXPIRED'

export interface PremiumPurchase {
  id: string
  userId: string
  vehicleId: string
  productType: PremiumProduct
  status: PaymentStatus
  amountCents: number
  currency: string
  providerTxId?: string | null
  purchasedAt?: string | null
  expiresAt?: string | null
  createdAt: string
}

export interface AccessGrant {
  id: string
  userId: string
  purchaseId: string
  productType: PremiumProduct
  vehicleId?: string | null
  grantedAt: string
  expiresAt?: string | null
  isActive: boolean
}

export interface CreateCheckoutPayload {
  vehicleId: string
  productType: PremiumProduct
}

export interface CheckoutSession {
  purchaseId: string
  checkoutUrl: string     // Stripe checkout URL
  clientSecret?: string  // For embedded payment
  expiresAt: string
}

// Interface all payment providers must implement
export interface PaymentProviderInterface {
  providerId: string
  createCheckoutSession(payload: {
    purchaseId: string
    amountCents: number
    currency: string
    description: string
    successUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
  }): Promise<{ externalId: string; checkoutUrl: string; clientSecret?: string }>
  retrievePaymentStatus(externalId: string): Promise<PaymentStatus>
  refund(externalId: string, amountCents?: number): Promise<boolean>
  constructWebhookEvent(payload: string, signature: string): Promise<WebhookEvent>
}

export interface WebhookEvent {
  type: string
  data: Record<string, unknown>
}

// ─── Community Posts ──────────────────────────────────────────────────────────

export interface Post {
  id: string
  authorId: string
  author: Pick<AuthUser, 'id' | 'name' | 'avatarUrl'>
  vehicleId?: string | null
  title: string
  content: string
  images: string[]
  tags: string[]
  published: boolean
  viewCount: number
  likeCount: number
  commentCount: number
  isLikedByMe: boolean
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  postId: string
  authorId: string
  author: Pick<AuthUser, 'id' | 'name' | 'avatarUrl'>
  content: string
  createdAt: string
}

export interface CreatePostPayload {
  title: string
  content: string
  tags?: string[]
  vehicleId?: string
  images?: string[]
}

export type PostSortOrder = 'latest' | 'popular'

export interface PostFilters {
  tags?: string[]
  sortBy?: PostSortOrder
  page?: number
  limit?: number
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export type MessageType = 'TEXT' | 'IMAGE' | 'VEHICLE_CARD' | 'REPORT_SHARE'

export interface Message {
  id: string
  conversationId: string
  senderId: string
  sender: Pick<AuthUser, 'id' | 'name' | 'avatarUrl'>
  content: string
  messageType: MessageType
  attachmentUrl?: string | null
  readAt?: string | null
  createdAt: string
}

export interface Conversation {
  id: string
  participants: Array<{
    userId: string
    user: Pick<AuthUser, 'id' | 'name' | 'avatarUrl'>
    lastReadAt?: string | null
  }>
  lastMessage?: Message | null
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export interface SendMessagePayload {
  conversationId: string
  content: string
  messageType?: MessageType
  attachmentUrl?: string
}

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface ApiError {
  message: string
  code: string
  statusCode: number
  details?: Record<string, string[]>
}

// ─── Vehicle Research / AI Pre-Inspection Guide ───────────────────────────────

export type ResearchIssueSeverity = 'high' | 'medium' | 'low'
export type ResearchTagType = 'HIGH_ATTENTION' | 'COMMON_ISSUE' | 'EXPENSIVE_RISK' | 'VISUAL_CHECK' | 'TEST_DRIVE'

export interface ResearchIssue {
  title: string
  description: string
  severity: ResearchIssueSeverity
  tags: ResearchTagType[]
}

export interface ResearchSection {
  id: string
  title: string
  items: ResearchIssue[]
}

export interface VehicleResearchResult {
  vehicleKey: string
  generatedAt: string
  confidence: 'high' | 'medium' | 'low'
  summary: string
  overallRiskLevel: 'low' | 'moderate' | 'high'
  sections: {
    commonProblems: ResearchSection
    highPriorityChecks: ResearchSection
    visualAttention: ResearchSection
    mechanicalWatchouts: ResearchSection
    testDriveFocus: ResearchSection
    costAwareness: ResearchSection
  }
  disclaimer: string
  /** Set to true when the result came from the fallback knowledge base, not live AI */
  limitedMode?: boolean
}

// ─── UI / Form helpers ────────────────────────────────────────────────────────

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface FormFieldError {
  field: string
  message: string
}
