'use client'

import { usePathname } from 'next/navigation'
import SiteFooter from './SiteFooter'

export default function SiteFooterAppRouter() {
  const pathname = usePathname() || ''
  return <SiteFooter pathname={pathname} />
}
