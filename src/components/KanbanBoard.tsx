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

const initialColumns: Columns = {
  saved: {
    name: 'Saved',
    items: [
      { id: 'c1', title: 'Cloud Infrastructure Migration Support', agency: 'Department of Energy', value: '$3.2M' },
      { id: 'c2', title: 'Cybersecurity Threat Analysis', agency: 'Department of Defense', value: '$1.5M' },
    ]
  },
  evaluating: {
    name: 'Evaluating',
    items: [
      { id: 'c3', title: 'Legacy System Maintenance', agency: 'Veterans Affairs', value: '$850K' },
    ]
  },
  bidding: {
    name: 'Writing Proposal',
    items: []
  },
  submitted: {
    name: 'Submitted',
    items: []
  }
};

export default function KanbanBoard() {
  const [columns, setColumns] = useState<Columns>(initialColumns);
  // Fix for hydration issues with react-beautiful-dnd clones
  const [isBrowser, setIsBrowser] = useState(false);
  
  useEffect(() => {
    setIsBrowser(true);
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
          method: 'POST',
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
                background: 'rgba(255,255,255,0.1)', 
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
                    background: snapshot.isDraggingOver ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
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
