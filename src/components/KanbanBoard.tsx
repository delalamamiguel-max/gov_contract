'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ContractItem {
  id: string;
  title: string;
  agency: string;
  value: string;
}

interface Columns {
  [key: string]: {
    name: string;
    items: ContractItem[];
  };
}

/** Column ids must match PIPELINE_STATUSES in src/lib/pipeline.ts. */
const COLUMN_ORDER = ['saved', 'evaluating', 'bidding', 'submitted'] as const;
const COLUMN_NAMES: Record<string, string> = {
  saved: 'Saved',
  evaluating: 'Evaluating',
  bidding: 'Writing Proposal',
  submitted: 'Submitted',
};

function emptyColumns(): Columns {
  return COLUMN_ORDER.reduce((acc, id) => {
    acc[id] = { name: COLUMN_NAMES[id], items: [] };
    return acc;
  }, {} as Columns);
}

interface SavedItem {
  noticeId: string;
  title: string;
  agency: string;
  status: string;
  value: string | null;
}

export default function KanbanBoard() {
  const [columns, setColumns] = useState<Columns>(emptyColumns());
  const [loading, setLoading] = useState(true);
  // Fix for hydration issues with react-beautiful-dnd clones
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  // Load the user's saved opportunities and bucket them into columns.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pipeline');
        const data = await res.json();
        if (cancelled) return;
        const next = emptyColumns();
        for (const it of (data.items as SavedItem[]) || []) {
          const colId = COLUMN_ORDER.includes(it.status as (typeof COLUMN_ORDER)[number]) ? it.status : 'saved';
          next[colId].items.push({
            id: it.noticeId,
            title: it.title,
            agency: it.agency,
            value: it.value || 'TBD',
          });
        }
        setColumns(next);
      } catch (err) {
        console.error('Failed to load pipeline:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      const sourceCol = columns[source.droppableId];
      const destCol = columns[destination.droppableId];
      const sourceItems = [...sourceCol.items];
      const destItems = [...destCol.items];
      const [removed] = sourceItems.splice(source.index, 1);
      destItems.splice(destination.index, 0, removed);

      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceCol, items: sourceItems },
        [destination.droppableId]: { ...destCol, items: destItems }
      });

      // Optimistically update the database
      try {
        await fetch('/api/pipeline', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draggableId,
            status: destination.droppableId
          })
        });
      } catch (err) {
        console.error('Failed to sync pipeline state:', err);
      }

    } else {
      const column = columns[source.droppableId];
      const copiedItems = [...column.items];
      const [removed] = copiedItems.splice(source.index, 1);
      copiedItems.splice(destination.index, 0, removed);

      setColumns({
        ...columns,
        [source.droppableId]: { ...column, items: copiedItems }
      });
    }
  };

  if (!isBrowser) return null; // Prevents server-side hydration mismatch for drag-and-drop

  const totalItems = Object.values(columns).reduce((n, c) => n + c.items.length, 0);
  if (!loading && totalItems === 0) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ fontSize: '1.1rem' }}>Your pipeline is empty.</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Find opportunities in <a href="/en/dashboard/search" style={{ color: 'var(--accent-primary)' }}>Search</a> or{' '}
          <a href="/en/dashboard/recommendations" style={{ color: 'var(--accent-primary)' }}>Recommended for you</a> and click <strong>Add to Pipeline</strong>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '65vh' }}>
      <DragDropContext onDragEnd={onDragEnd}>
        {Object.entries(columns).map(([columnId, column]) => (
          <div key={columnId} style={{ display: 'flex', flexDirection: 'column', width: '300px', minWidth: '300px' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: 600, 
              color: 'var(--text-secondary)', 
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {column.name}
              <span style={{ 
                background: 'rgba(42, 51, 61,0.1)', 
                padding: '0.1rem 0.5rem', 
                borderRadius: '999px', 
                fontSize: '0.75rem' 
              }}>
                {column.items.length}
              </span>
            </h3>
            
            <Droppable droppableId={columnId}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  style={{
                    background: snapshot.isDraggingOver ? 'rgba(42, 51, 61,0.05)' : 'rgba(42, 51, 61,0.02)',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    transition: 'background 0.2s ease'
                  }}
                >
                  {column.items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="glass-panel"
                          style={{
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            cursor: 'grab',
                            transform: snapshot.isDragging ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: snapshot.isDragging ? '0 10px 25px rgba(0,0,0,0.5)' : 'none',
                            ...provided.draggableProps.style
                          }}
                        >
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.3 }}>{item.title}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.agency}</p>
                          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{item.value}</span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </DragDropContext>
    </div>
  );
}
