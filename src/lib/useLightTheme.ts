import { useEffect } from 'react'

/**
 * Applies the light "Bento & Lime" theme to pages that render outside the
 * AppShell (sign-in, onboarding, public guest pages). Lives on <html> so that
 * portals pick it up too; removed again when the page unmounts.
 */
export function useLightTheme() {
  useEffect(() => {
    const root = document.documentElement
    const had = root.classList.contains('theme-c')
    root.classList.add('theme-c')
    return () => { if (!had) root.classList.remove('theme-c') }
  }, [])
}
