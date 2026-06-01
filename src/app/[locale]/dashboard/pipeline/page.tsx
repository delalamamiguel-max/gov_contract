export const dynamic = 'force-dynamic';
import { MoreHorizontal } from 'lucide-react';
import { listPipelineApplications } from '@/lib/dataconnect';
import { v4 as uuidv4 } from 'uuid'; // Temporary for mock tenantId

export default async function PipelinePage() {
  const columns = [
    { name: 'Interested', color: 'var(--text-secondary)' },
    { name: 'Preparing Response', color: 'var(--accent-primary)' },
    { name: 'Submitted', color: '#8b5cf6' },
    { name: 'Won', color: '#10b981' }
  ];

  // Fetch live pipeline data
  let pipelineData: any[] = [];
  try {
    // We would use the logged in user's tenantId here, mock for now
    const mockTenantId = "00000000-0000-0000-0000-000000000000"; 
    const response = await listPipelineApplications({ tenantId: mockTenantId });
    pipelineData = response.data.pipelineApplications;
  } catch (error) {
    console.error('Failed to fetch pipeline data', error);
  }

  // Fallback to mock data if DB empty
  if (pipelineData.length === 0) {
    pipelineData = [
      { id: 1, opportunity: { title: 'IT Modernization Services', agency: 'Department of Defense', responseDeadline: new Date(Date.now() + 86400000 * 14).toISOString() }, status: 'Interested' }
    ];
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Pipeline</h1>
        <p>Track your active bids and submissions.</p>
      </header>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', flexGrow: 1 }}>
        {columns.map(col => (
          <div key={col.name} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{col.name}</h3>
              </div>
              <MoreHorizontal size={18} color="var(--text-muted)" />
            </div>

            {/* Column Content Area */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              flexGrow: 1,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {pipelineData.filter(item => item.status === col.name).map((item: any) => (
                <div key={item.id} className="glass-panel" style={{ padding: '1rem', cursor: 'grab' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>{item.opportunity.title}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.opportunity.agency}</p>
                  <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    Due in {Math.ceil((new Date(item.opportunity.responseDeadline).getTime() - Date.now()) / 86400000)} days
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
