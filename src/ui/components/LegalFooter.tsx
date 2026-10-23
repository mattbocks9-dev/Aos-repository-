import { useState } from 'react';

export function LegalFooter() {
  const [open, setOpen] = useState(false);
  return (
    <footer className="muted mt-10 border-t border-[var(--line)] pt-4 text-xs leading-relaxed">
      <p>
        Unofficial, free fan project made for fun. Not affiliated with or endorsed by Games
        Workshop.{' '}
        <button className="underline" onClick={() => setOpen(!open)} aria-expanded={open}>
          About &amp; legal
        </button>
      </p>
      {open && (
        <div className="mt-3 space-y-2" role="region" aria-label="About and legal">
          <p>
            Warhammer, Warhammer Age of Sigmar, the General&apos;s Handbook and all associated
            names, factions, units, battleplans, rules, marks and logos are ® / ™ / © Games
            Workshop Limited, variably registered around the world, and are used without permission.
            No challenge to their status is intended. This app contains no Games Workshop artwork;
            images you add stay in your browser.
          </p>
          <p>
            Army data comes from the community{' '}
            <a
              className="underline"
              href="https://github.com/BSData/age-of-sigmar-4th"
              target="_blank"
              rel="noreferrer"
            >
              BSData age-of-sigmar-4th
            </a>{' '}
            catalogues. Battleplans and battle tactics come from{' '}
            <a
              className="underline"
              href="https://wahapedia.ru/aos4/the-rules/general-s-handbook-2026-27/"
              target="_blank"
              rel="noreferrer"
            >
              Wahapedia
            </a>
            , whose map pictures are loaded from there. Neither is affiliated with this project.
          </p>
          <p>
            Provided as-is with no warranty; matchup estimates are for practice only. Use official
            publications and your event pack for real games. No accounts, analytics or server: your
            teams are saved only in this browser.
          </p>
          <p>
            Open source under the MIT License (original code only).{' '}
            <a
              className="underline"
              href="https://github.com/mattbocks9-dev/Aos-repository-"
              target="_blank"
              rel="noreferrer"
            >
              Source &amp; full notices
            </a>
            . Rights holders can request changes by opening an issue.
          </p>
        </div>
      )}
    </footer>
  );
}
