// Exhibit C — THE COMPUTER. Dark green-on-black terminal card containing
// the decrypting-case-files line plus one bordered card per project (amber
// title, tag, body, optional highlight line). Ported from
// legacy/Agent Office Ship.dc.html lines ~232-266 (isLaptop block).

import type { ProjectsContent } from '../../content/exhibits';

export default function LaptopContent({ content }: { content: ProjectsContent }) {
  return (
    <div className="ta-panel__section">
      <div className="ta-laptop-terminal">
        <div className="ta-laptop-terminal__line">{content.terminalLine}</div>
        <div className="ta-laptop-projects">
          {content.projects.map((p) => (
            <div className="ta-laptop-project" key={p.number}>
              <div className="ta-laptop-project__head">
                <div className="ta-laptop-project__title">
                  {p.number} · {p.title}
                </div>
                <div className="ta-laptop-project__tag">{p.tag}</div>
              </div>
              <p className="ta-laptop-project__body">{p.body}</p>
              {p.highlight && <div className="ta-laptop-project__highlight">{p.highlight}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
