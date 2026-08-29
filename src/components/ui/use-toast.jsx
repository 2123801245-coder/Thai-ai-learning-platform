import { useState } from "react"

export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = (message) => {
    const id = Date.now()

    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
      },
    ])

    setTimeout(() => {
      setToasts((prev) =>
        prev.filter((item) => item.id !== id)
      )
    }, 3000)
  }

  return {
    toast,
    toasts,
  }
}