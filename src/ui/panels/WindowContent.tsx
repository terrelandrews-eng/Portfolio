// Exhibit A — THE WINDOW. Photo of the Antigua view + narration paragraph.
// Ported from legacy/Agent Office Ship.dc.html lines ~283-291 (isWindow
// block). Simple enough to reuse the shared `ta-panel__*` chrome classes
// rather than a dedicated `ta-window-*` prefix.

import type { ParagraphsContent } from '../../content/exhibits';

export default function WindowContent({ content }: { content: ParagraphsContent }) {
  const imageSrc = content.image
    ? import.meta.env.BASE_URL + 'assets/' + content.image.src
    : undefined;

  return (
    <div className="ta-panel__section">
      {content.image && imageSrc && (
        <img className="ta-panel__image" src={imageSrc} alt={content.image.alt} />
      )}
      {content.paragraphs.map((p, i) => (
        <p className="ta-panel__paragraph" key={i}>
          {p}
        </p>
      ))}
    </div>
  );
}
