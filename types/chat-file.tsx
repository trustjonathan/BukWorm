export interface ChatFile {
  id: string
  name: string
  type: string
  file: File | null
  uploadState?: "uploading" | "failed"
  uploadError?: string
}
