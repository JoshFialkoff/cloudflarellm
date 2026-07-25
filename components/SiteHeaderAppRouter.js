'use client'

import { usePathname } from 'next/navigation'
import SiteHeader from './SiteHeader'

export default function SiteHeaderAppRouter() {
  const pathname = usePathname() || ''
  return <SiteHeader pathname={pathname} />
}
