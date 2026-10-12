import { linkify } from '@shared/links'
import { Fragment } from 'react'

/** Text with its web links clickable (they open in a new tab). Same as the app's LinkedText. */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((p, i) =>
        p.url ? (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="text-link">
            {p.text}
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  )
}
