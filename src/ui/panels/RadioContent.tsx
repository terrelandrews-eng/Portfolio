// Exhibit H — THE RADIO. FREQ 94.7 transmission block: dark amber-on-ink
// card with the transmission label, static glyphs, and note, then a
// closing paragraph. Ported from legacy/Agent Office Ship.dc.html lines
// ~382-391 (isRadio block). Static glyphs render as plain text — no
// marquee/looping animation, per prefers-reduced-motion requirements.

import type { RadioContent as RadioContentData } from '../../content/exhibits';

export default function RadioContent({ content }: { content: RadioContentData }) {
  return (
    <div className="ta-panel__section">
      <div className="ta-radio-transmission">
        <div>{content.transmissionLabel}</div>
        <div className="ta-radio-transmission__glyphs">{content.staticGlyphs}</div>
        <div>{content.transmissionNote}</div>
      </div>
      <p className="ta-panel__paragraph ta-radio-paragraph">{content.paragraph}</p>
    </div>
  );
}
