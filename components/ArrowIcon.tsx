type Direction = 'up-right' | 'right' | 'left' | 'up' | 'down';

const rotations: Record<Direction, number> = {
  'up-right': -45,
  right: 0,
  left: 180,
  up: -90,
  down: 90,
};

export default function ArrowIcon({ direction = 'up-right' }: { direction?: Direction }) {
  return (
    <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <g transform={`rotate(${rotations[direction]} 12 12)`}>
        <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
