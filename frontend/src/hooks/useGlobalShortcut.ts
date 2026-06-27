import { useEffect } from 'react'

export function useGlobalShortcut(key: string, callback: () => void, ctrlOrCmd = true) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const matchKey = event.key.toLowerCase() === key.toLowerCase()
      const matchModifier = ctrlOrCmd ? (event.metaKey || event.ctrlKey) : true
      
      if (matchKey && matchModifier) {
        event.preventDefault()
        callback()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, callback, ctrlOrCmd])
}
