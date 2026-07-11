// Exhibit D — THE PHONE. "Secure line" contact card: intro paragraph plus
// two case-file action rows (email, LinkedIn). Ported from
// legacy/Agent Office Ship.dc.html lines ~268-280 (isPhone block).

import type { ContactContent } from '../../content/exhibits';

export default function PhoneContent({ content }: { content: ContactContent }) {
  return (
    <div className="ta-panel__section">
      <p className="ta-panel__paragraph ta-phone-intro">{content.intro}</p>
      <div className="ta-phone-rows">
        <a className="ta-phone-row ta-phone-row--solid" href={`mailto:${content.email}`}>
          <span className="ta-phone-row__label">{content.emailLabel}</span>
          <span className="ta-phone-row__value">{content.email}</span>
        </a>
        <a
          className="ta-phone-row ta-phone-row--outline"
          href={content.linkedinUrl}
          target="_blank"
          rel="noopener"
        >
          <span className="ta-phone-row__label">{content.linkedinLabel}</span>
          <span className="ta-phone-row__value">{content.linkedinHandle}</span>
        </a>
      </div>
    </div>
  );
}
