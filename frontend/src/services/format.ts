export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`
}

export const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  pptx: 'PPTX',
  txt: 'TXT',
  png: 'PNG',
  jpg: 'JPG',
}

export const FILE_ACCEPT = '.pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg'