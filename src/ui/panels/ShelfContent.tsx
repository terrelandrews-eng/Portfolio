// Exhibit F — THE BOOKSHELF. Certifications list + field-skill pills.
// Ported from legacy/Agent Office Ship.dc.html lines ~321-346 (isShelf
// block).

import type { CredentialsContent } from '../../content/exhibits';

export default function ShelfContent({ content }: { content: CredentialsContent }) {
  return (
    <div className="ta-panel__section">
      <div className="ta-panel__heading ta-shelf-heading--first">{content.certsHeading}</div>
      <ul className="ta-panel__list">
        {content.certs.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>

      <div className="ta-panel__heading">{content.skillsHeading}</div>
      <div className="ta-shelf-pills">
        {content.skills.map((s, i) => (
          <div className="ta-shelf-pill" key={i}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
