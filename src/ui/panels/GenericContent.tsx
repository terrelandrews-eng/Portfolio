// Generic body renderer for exhibit panels (M3.1). Switches on
// `content.kind` and dumps the variant's text fields as readable
// paragraphs/lists — NOT the final per-exhibit visual treatment. A later
// task splits each case below into its own dedicated renderer that
// matches the legacy layout (terminal blocks, pinboard cards, polaroids,
// etc). Keep this switch as the seam for that split.

import type { ReactNode } from 'react';
import type { ExhibitContent } from '../../content/exhibits';

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="ta-panel__paragraph">{children}</p>;
}

function Heading({ children }: { children: ReactNode }) {
  return <div className="ta-panel__heading">{children}</div>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="ta-panel__list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function GenericContent({ content }: { content: ExhibitContent }) {
  switch (content.kind) {
    case 'paragraphs':
      return (
        <div className="ta-panel__section">
          {content.image && (
            <img className="ta-panel__image" src={content.image.src} alt={content.image.alt} />
          )}
          {content.paragraphs.map((p, i) => (
            <Paragraph key={i}>{p}</Paragraph>
          ))}
        </div>
      );

    case 'resume':
      return (
        <div className="ta-panel__section">
          <Paragraph>
            <strong>{content.name}</strong> — {content.title}
          </Paragraph>
          <Paragraph>{content.summary}</Paragraph>
          <a className="ta-panel__link-button" href={content.resumeHref} download={content.resumeDownloadName}>
            {content.resumeLabel}
          </a>
          <Heading>{content.achievementsHeading}</Heading>
          <List items={content.achievements} />
          <Heading>{content.postingsHeading}</Heading>
          <List
            items={content.postings.map(
              (p) => `${p.title} (${p.dateRange}) — ${p.description}`
            )}
          />
          <Heading>{content.trainingHeading}</Heading>
          <Paragraph>{content.training}</Paragraph>
        </div>
      );

    case 'projects':
      return (
        <div className="ta-panel__section">
          <Paragraph>{content.terminalLine}</Paragraph>
          <List
            items={content.projects.map(
              (p) =>
                `${p.number} · ${p.title} [${p.tag}] — ${p.body}${
                  p.highlight ? ` (${p.highlight})` : ''
                }`
            )}
          />
        </div>
      );

    case 'contact':
      return (
        <div className="ta-panel__section">
          <Paragraph>{content.intro}</Paragraph>
          <List
            items={[
              `${content.emailLabel}: ${content.email}`,
              `${content.linkedinLabel}: ${content.linkedinHandle}`,
            ]}
          />
        </div>
      );

    case 'pinboard':
      return (
        <div className="ta-panel__section">
          <Paragraph>{content.subheading}</Paragraph>
          {content.cards.map((card, i) => (
            <div key={i}>
              <Heading>{card.heading}</Heading>
              <List items={card.lines} />
            </div>
          ))}
        </div>
      );

    case 'credentials':
      return (
        <div className="ta-panel__section">
          <Heading>{content.certsHeading}</Heading>
          <List items={content.certs} />
          <Heading>{content.skillsHeading}</Heading>
          <List items={content.skills} />
        </div>
      );

    case 'photos':
      return (
        <div className="ta-panel__section">
          <List
            items={content.polaroids.map((p) => `[${content.placeholderStamp}] ${p.caption}`)}
          />
          <Heading>{content.fieldNotesHeading}</Heading>
          <List items={content.fieldNotes} />
        </div>
      );

    case 'radio':
      return (
        <div className="ta-panel__section">
          <Paragraph>{content.transmissionLabel}</Paragraph>
          <Paragraph>{content.staticGlyphs}</Paragraph>
          <Paragraph>{content.transmissionNote}</Paragraph>
          <Paragraph>{content.paragraph}</Paragraph>
        </div>
      );

    case 'mug':
      return (
        <div className="ta-panel__section">
          <Paragraph>[{content.stamp}]</Paragraph>
          <Paragraph>{content.paragraph}</Paragraph>
        </div>
      );

    default: {
      // Exhaustiveness guard: TS errors here if a new ExhibitContent
      // variant is added without a case above.
      const _exhaustive: never = content;
      return _exhaustive;
    }
  }
}
