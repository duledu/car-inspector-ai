import { buildInspectionReportPdf } from './src/lib/report/pdf.js'

const score: any = {
  id: 'test', vehicleId: 'v1', buyScore: 72, riskScore: 28, verdict: 'BUY_WITH_CAUTION',
  dimensions: {
    ai: { score: 65, label: 'AI', weight: 25, explanation: 'test' },
    exterior: { score: 80, label: 'Ext', weight: 20, explanation: 'test' },
    interior: { score: 70, label: 'Int', weight: 3, explanation: 'test' },
    mechanical: { score: 75, label: 'Mech', weight: 20, explanation: 'test' },
    documents: { score: 70, label: 'Docs', weight: 2, explanation: 'test' },
    testDrive: { score: 72, label: 'TD', weight: 10, explanation: 'test' },
    vin: { score: 65, label: 'VIN', weight: 20, explanation: 'test' },
  },
  reasonsFor: ['Good service history'], reasonsAgainst: ['Minor wear'],
  negotiationHints: ['Negotiate on cosmetics'], riskFlags: [],
  serviceHistoryStatus: 'PARTIAL', hasPremiumData: false,
  createdAt: new Date().toISOString(),
}
const vehicle: any = {
  id: 'v1', make: 'BMW', model: '3 Series', year: 2018,
  mileage: 85000, askingPrice: 18000, currency: 'EUR',
  fuelType: 'DIESEL', transmission: 'AUTOMATIC',
}
const research: any = {
  vehicleKey: '2018 BMW 3 Series', generatedAt: new Date().toISOString(),
  confidence: 'medium', summary: 'Check turbo.', overallRiskLevel: 'moderate',
  sections: {
    commonProblems: { title: 'CP', items: [{ title: 'Turbo', description: 'Wear', severity: 'high', tags: [] }] },
    highPriorityChecks: { title: 'HPC', items: [] },
    visualAttention: { title: 'VA', items: [] },
    mechanicalWatchouts: { title: 'MW', items: [] },
    testDriveFocus: { title: 'TDF', items: [] },
    costAwareness: { title: 'CA', items: [] },
  },
  disclaimer: 'Advisory only.',
}
buildInspectionReportPdf({ vehicle, score, research, findings: [], checklistItems: [], photos: [], generatedAt: new Date(), locale: 'en' })
  .then((buf: Buffer) => { console.log('PDF OK size=', buf.length); process.exit(0) })
  .catch((err: Error) => { console.error('PDF FAILED:', err.message); console.error(err.stack); process.exit(1) })
