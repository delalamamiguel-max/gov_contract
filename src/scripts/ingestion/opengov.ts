// OpenGov Procurement API Ingestion Script
// OpenGov powers state and local procurement portals

export async function fetchOpenGovOpportunities() {
  console.log('[OpenGov] Starting data ingestion...');
  
  const mockData = [
    {
      noticeId: 'OG-55555',
      title: 'City Park Landscaping and Maintenance',
      agency: 'City of Austin Parks & Rec',
      solicitationNumber: 'COA-PR-2026',
      naicsCode: '561730',
      setAsideType: 'None',
      postedDate: new Date().toISOString(),
      responseDeadline: new Date(Date.now() + 86400000 * 14).toISOString(),
      estimatedValue: 250000,
      sourceUrl: 'https://procurement.opengov.com/portal/austin/projects/55555'
    }
  ];

  return mockData;
}
