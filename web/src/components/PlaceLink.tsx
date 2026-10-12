import { t } from '@shared/i18n'
import { placeLinks } from '@shared/links'
import { useEffect, useRef, useState } from 'react'
import { IoMapOutline } from 'react-icons/io5'

/**
 * An item's place: tap it to pick where it opens - Google Maps, Waze or Apple
 * Maps (user's request, 2026-10-12). A map link shows as "Map link". Same as
 * the app's PlaceLink.
 */
export function PlaceLink({ place }: { place: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  const links = placeLinks(place)

  // A tap anywhere else closes the choice.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const choices = [
    { label: t('place.googleMaps'), href: links.google },
    ...(links.waze ? [{ label: t('place.waze'), href: links.waze }] : []),
    { label: t('place.appleMaps'), href: links.apple },
  ]
  return (
    <span className="place-link" ref={box}>
      <button type="button" className="place-button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={t('place.openIn')}>
        <IoMapOutline aria-hidden />
        <span>{links.isLink ? t('place.mapLink') : place}</span>
      </button>
      {open && (
        <span className="place-menu" role="menu" aria-label={t('place.openIn')}>
          {choices.map((c) => (
            <a key={c.label} role="menuitem" href={c.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              {c.label}
            </a>
          ))}
        </span>
      )}
    </span>
  )
}
