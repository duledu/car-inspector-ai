import { apiClient } from './client'

export interface ReportPhotoDraft {
  key: string
  label: string
  thumbUrl: string
}

export interface PdfReportDownload {
  blob: Blob
  filename: string
}

function filenameFromDisposition(disposition?: string): string {
  const fallback = 'Used-Cars-Doctor-AI-Inspection-Report.pdf'
  if (!disposition) return fallback
  const match = disposition.match(/filename="([^"]+)"/i) ?? disposition.match(/filename=([^;]+)/i)
  return match?.[1]?.trim() || fallback
}

export const reportApi = {
  downloadPdfReport: async (
    vehicleId: string,
    locale: string,
    photos: ReportPhotoDraft[]
  ): Promise<PdfReportDownload> => {
    const response = await apiClient.post<Blob>(
      '/report/pdf',
      { vehicleId, locale, photos },
      {
        responseType: 'blob',
        timeout: 45_000,
        headers: { 'Content-Type': 'application/json' },
      }
    )

    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition']),
    }
  },
}

