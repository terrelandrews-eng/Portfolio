// Shown when WebGL is unavailable. This is the full, static, SEO-visible
// evidence index for "Case File No. 220" — every exhibit's real copy,
// rendered as plain accessible DOM instead of the 3D scene. Content is
// sourced directly from src/content/exhibits.ts and src/content/strings.ts
// (never re-typed here) so this view can never drift from the 3D panels.

import type { ExhibitContent } from '../content/exhibits';
import { CONTACT_EMAIL, EXHIBITS, LINKEDIN_URL } from '../content/exhibits';
import { STRINGS } from '../content/strings';
import './fallback.css';

function ExhibitBody({ content }: { content: ExhibitContent }) {
  switch (content.kind) {
    case 'paragraphs': {
      const imageSrc = content.image ? import.meta.env.BASE_URL + 'assets/' + content.image.src : undefined;
      return (
        <>
          {content.image && imageSrc && (
            <img className="fb-image" src={imageSrc} alt={content.image.alt} />
          )}
          {content.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </>
      );
    }

    case 'resume':
      return (
        <>
          <h3 className="fb-subhead">
            {content.name} <span className="fb-subhead__title">— {content.title}</span>
          </h3>
          <p>
            <a className="fb-link fb-link--button" href={content.resumeHref} download={content.resumeDownloadName}>
              {content.resumeLabel}
            </a>
          </p>
          <p>{content.summary}</p>
          <h4>{content.achievementsHeading}</h4>
          <ul>
            {content.achievements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <h4>{content.postingsHeading}</h4>
          <dl className="fb-postings">
            {content.postings.map((p, i) => (
              <div className="fb-posting" key={i}>
                <dt>
                  <b>{p.title}</b> <span className="fb-posting__dates">{p.dateRange}</span>
                </dt>
                <dd>{p.description}</dd>
              </div>
            ))}
          </dl>
          <h4>{content.trainingHeading}</h4>
          <p>{content.training}</p>
        </>
      );

    case 'projects':
      return (
        <>
          <p className="fb-terminal-line">{content.terminalLine}</p>
          <ul className="fb-projects">
            {content.projects.map((p) => (
              <li key={p.number}>
                <div className="fb-project__head">
                  <span className="fb-project__title">
                    {p.number} · {p.title}
                  </span>
                  <span className="fb-project__tag">{p.tag}</span>
                </div>
                <p>{p.body}</p>
                {p.highlight && <p className="fb-project__highlight">{p.highlight}</p>}
              </li>
            ))}
          </ul>
        </>
      );

    case 'contact':
      return (
        <>
          <p>{content.intro}</p>
          <ul className="fb-contact-list">
            <li>
              <span className="fb-contact-label">{content.emailLabel}</span>{' '}
              <a className="fb-link" href={`mailto:${content.email}`}>
                {content.email}
              </a>
            </li>
            <li>
              <span className="fb-contact-label">{content.linkedinLabel}</span>{' '}
              <a className="fb-link" href={content.linkedinUrl} target="_blank" rel="noopener">
                {content.linkedinHandle}
              </a>
            </li>
          </ul>
        </>
      );

    case 'pinboard':
      return (
        <>
          <p>{content.subheading}</p>
          <ul className="fb-pinboard">
            {content.cards.map((card, i) => (
              <li key={i}>
                <h4>{card.heading}</h4>
                <p>{card.lines.join(' · ')}</p>
              </li>
            ))}
          </ul>
        </>
      );

    case 'credentials':
      return (
        <>
          <h4>{content.certsHeading}</h4>
          <ul>
            {content.certs.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <h4>{content.skillsHeading}</h4>
          <ul className="fb-skills">
            {content.skills.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      );

    case 'photos':
      return (
        <>
          <ul className="fb-polaroids">
            {content.polaroids.map((p, i) => (
              <li key={i}>
                <span className="fb-polaroid__stamp">[{content.placeholderStamp}]</span> {p.caption}
              </li>
            ))}
          </ul>
          <h4>{content.fieldNotesHeading}</h4>
          <ul>
            {content.fieldNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      );

    case 'radio':
      return (
        <>
          <p className="fb-transmission">
            {content.transmissionLabel}
            <br />
            <span aria-hidden="true" className="fb-transmission__glyphs">
              {content.staticGlyphs}
            </span>
            <br />
            {content.transmissionNote}
          </p>
          <p>{content.paragraph}</p>
        </>
      );

    case 'mug':
      return (
        <>
          <p className="fb-stamp">{content.stamp}</p>
          <p>{content.paragraph}</p>
        </>
      );

    default: {
      const _exhaustive: never = content;
      return _exhaustive;
    }
  }
}

export default function StaticFallback() {
  const { topBar, footer, briefingCard, identityConfirmed } = STRINGS;

  return (
    <div className="fb-root">
      <header className="fb-header">
        <p className="fb-badge">{topBar.dossierBadge}</p>
        <h1 className="fb-title">{topBar.caseTitle}</h1>
        <p className="fb-role">{topBar.roleLine}</p>
        <p className="fb-station">{topBar.stationLine}</p>
        <p className="fb-status">
          {topBar.statusLabel} <span>{topBar.statusActive}</span>
        </p>
        <p className="fb-eyes-only">{topBar.eyesOnlyStamp}</p>
      </header>

      <main className="fb-main">
        <section className="fb-briefing" aria-labelledby="fb-briefing-heading">
          <p className="fb-briefing__badge">{briefingCard.eyesOnlyBadge}</p>
          <h2 id="fb-briefing-heading">{briefingCard.heading}</h2>
          <p>{briefingCard.body}</p>
        </section>

        <section aria-labelledby="fb-evidence-heading">
          <h2 id="fb-evidence-heading">
            {topBar.evidenceLabel} ({topBar.evidenceTotal})
          </h2>

          {EXHIBITS.map((exhibit) => (
            <article className="fb-exhibit" key={exhibit.id} id={exhibit.id} aria-labelledby={`fb-${exhibit.id}-heading`}>
              <p className="fb-exhibit__kicker">{exhibit.panelKicker}</p>
              <h3 id={`fb-${exhibit.id}-heading`}>{exhibit.panelTitle}</h3>
              <ExhibitBody content={exhibit.content} />
            </article>
          ))}
        </section>

        <section className="fb-identity" aria-labelledby="fb-identity-heading">
          <p className="fb-identity__stamp" id="fb-identity-heading">
            {identityConfirmed.stamp}
          </p>
          <p>{identityConfirmed.paragraph1}</p>
          <p>{identityConfirmed.paragraph2}</p>
          <p className="fb-identity__actions">
            <a className="fb-link fb-link--button" href={`mailto:${CONTACT_EMAIL}`}>
              {identityConfirmed.emailButton}
            </a>{' '}
            <a
              className="fb-link fb-link--button fb-link--outline"
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener"
            >
              {identityConfirmed.linkedinButton}
            </a>
          </p>
        </section>
      </main>

      <footer className="fb-footer">
        <p>{footer.coords}</p>
        <p>
          {footer.evidenceLogLabel} · {footer.fileNo}
        </p>
        <p>{footer.hintDone}</p>
      </footer>
    </div>
  );
}
