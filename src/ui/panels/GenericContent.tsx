// Dispatcher for exhibit panel bodies (M3.2). Switches on `content.kind`
// and delegates to the dedicated per-exhibit renderer that matches the
// legacy visual treatment (résumé layout, terminal cards, pinboard,
// polaroids, etc). Keep the exhaustiveness guard below — it is the seam
// that forces a new case here whenever ExhibitContent grows a variant.

import type { ExhibitContent } from '../../content/exhibits';
import WindowContent from './WindowContent';
import JournalContent from './JournalContent';
import LaptopContent from './LaptopContent';
import PhoneContent from './PhoneContent';
import BoardContent from './BoardContent';
import ShelfContent from './ShelfContent';
import PhotosContent from './PhotosContent';
import RadioContent from './RadioContent';
import MugContent from './MugContent';

export default function GenericContent({ content }: { content: ExhibitContent }) {
  switch (content.kind) {
    case 'paragraphs':
      return <WindowContent content={content} />;

    case 'resume':
      return <JournalContent content={content} />;

    case 'projects':
      return <LaptopContent content={content} />;

    case 'contact':
      return <PhoneContent content={content} />;

    case 'pinboard':
      return <BoardContent content={content} />;

    case 'credentials':
      return <ShelfContent content={content} />;

    case 'photos':
      return <PhotosContent content={content} />;

    case 'radio':
      return <RadioContent content={content} />;

    case 'mug':
      return <MugContent content={content} />;

    default: {
      // Exhaustiveness guard: TS errors here if a new ExhibitContent
      // variant is added without a case above.
      const _exhaustive: never = content;
      return _exhaustive;
    }
  }
}
