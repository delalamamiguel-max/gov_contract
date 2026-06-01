import KanbanBoard from '@/components/KanbanBoard';

export default function PipelinePage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Pipeline</h1>
        <p>Track and manage the federal contracts you are bidding on.</p>
      </header>

      <KanbanBoard />
    </div>
  );
}
