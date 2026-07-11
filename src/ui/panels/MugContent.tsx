// Exhibit I — THE MUG. "#1 DAD" double-border stamp (rotated) + paragraph.
// Ported from legacy/Agent Office Ship.dc.html lines ~393-402 (isMug
// block).

import type { MugContent as MugContentData } from '../../content/exhibits';

export default function MugContent({ content }: { content: MugContentData }) {
  return (
    <div className="ta-panel__section">
      <div className="ta-mug-stamp">{content.stamp}</div>
      <p className="ta-panel__paragraph ta-mug-paragraph">{content.paragraph}</p>
    </div>
  );
}
