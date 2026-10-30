export async function consumeReadableStream(
  stream: ReadableStream<Uint8Array>,
  callback: (chunk: string) => void,
  signal: AbortSignal
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const cancelReader = () => {
    void reader.cancel().catch(error => {
      if (!signal.aborted) {
        console.error("Error cancelling stream reader:", error)
      }
    })
  }

  signal.addEventListener("abort", cancelReader, { once: true })

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      if (value) {
        callback(decoder.decode(value, { stream: true }))
      }
    }
  } catch (error) {
    if (signal.aborted) {
      console.error("Stream reading was aborted:", error)
    } else {
      console.error("Error consuming stream:", error)
    }
  } finally {
    signal.removeEventListener("abort", cancelReader)
    reader.releaseLock()
  }
}
