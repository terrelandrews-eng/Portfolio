// Exhibit B — THE JOURNAL. Résumé/service-record layout: name+title header
// with a download-resume button, summary paragraph, KEY ACHIEVEMENTS list,
// POSTINGS (title/date-range/description blocks), TRAINING line. Ported
// from legacy/Agent Office Ship.dc.html lines ~187-230 (isJournal block).

import type { ResumeContent } from '../../content/exhibits';

export default function JournalContent({ content }: { content: ResumeContent }) {
  return (
    <div className="ta-panel__section">
      <div className="ta-journal-header">
        <div>
          <div className="ta-journal-name">{content.name}</div>
          <div className="ta-journal-title">{content.title}</div>
        </div>
        <a
          className="ta-panel__link-button ta-journal-download"
          href={content.resumeHref}
          download={content.resumeDownloadName}
        >
          {content.resumeLabel}
        </a>
      </div>

      <p className="ta-panel__paragraph ta-journal-summary">{content.summary}</p>

      <div className="ta-panel__heading">{content.achievementsHeading}</div>
      <ul className="ta-panel__list">
        {content.achievements.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>

      <div className="ta-panel__heading">{content.postingsHeading}</div>
      <div className="ta-journal-postings">
        {content.postings.map((p, i) => (
          <div className="ta-journal-posting" key={i}>
            <div className="ta-journal-posting__head">
              <b>{p.title}</b>
              <span className="ta-journal-posting__dates">{p.dateRange}</span>
            </div>
            <div className="ta-journal-posting__desc">{p.description}</div>
          </div>
        ))}
      </div>

      <div className="ta-panel__heading">{content.trainingHeading}</div>
      <p className="ta-panel__paragraph ta-journal-training">{content.training}</p>
    </div>
  );
}
