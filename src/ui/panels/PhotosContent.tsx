// Exhibit G — THE PHOTOS. Rotated white-framed polaroid grid with a
// CLASSIFIED stamp placeholder + caption per card, plus a FIELD NOTES
// list. Ported from legacy/Agent Office Ship.dc.html lines ~348-380
// (isPhotos block). The legacy source has no real photo assets — the
// diagonal-stripe placeholder + stamp is the actual intended look, not a
// simplification.

import type { PhotosContent as PhotosContentData } from '../../content/exhibits';

export default function PhotosContent({ content }: { content: PhotosContentData }) {
  return (
    <div className="ta-panel__section">
      <div className="ta-photos-grid">
        {content.polaroids.map((p, i) => (
          <div className="ta-photos-card" key={i}>
            <div className="ta-photos-card__frame">
              <div className="ta-photos-card__stamp">{content.placeholderStamp}</div>
            </div>
            <div className="ta-photos-card__caption">{p.caption}</div>
          </div>
        ))}
      </div>

      <div className="ta-panel__heading">{content.fieldNotesHeading}</div>
      <ul className="ta-panel__list">
        {content.fieldNotes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
