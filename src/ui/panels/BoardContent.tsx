// Exhibit E — THE BOARD. Pinned index-card grid (slight per-card rotation
// + pin dot), one card per system group. Ported from
// legacy/Agent Office Ship.dc.html lines ~293-319 (isBoard block).

import type { PinboardContent } from '../../content/exhibits';

export default function BoardContent({ content }: { content: PinboardContent }) {
  return (
    <div className="ta-panel__section">
      <p className="ta-panel__paragraph ta-board-subheading">{content.subheading}</p>
      <div className="ta-board-grid">
        {content.cards.map((card, i) => (
          <div className="ta-board-card" key={i}>
            <div className="ta-board-card__pin" />
            <div className="ta-board-card__heading">{card.heading}</div>
            <div className="ta-board-card__lines">
              {card.lines.map((line, j) => (
                <span key={j}>
                  {line}
                  {j < card.lines.length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
