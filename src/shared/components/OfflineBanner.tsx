import { useOnlineStatus } from '@/core/network/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) {
    return null
  }

  return (
    <div className="bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-black">
      You're offline. Changes will sync once you're back online.
    </div>
  )
}
