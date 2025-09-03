import React, { useState, useEffect } from 'react';
import { Entity, EntityRelationshipWithEntities, AdvancedRelationshipType } from '../types/entity';
import { api } from '../services/api';
import './EntityRelationshipVisualization.css';

interface EntityNode {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  relationships: EntityRelationshipWithEntities[];
}

interface RelationshipEdge {
  from: number;
  to: number;
  type: AdvancedRelationshipType;
  ownership: number;
  label: string;
}

const EntityRelationshipVisualization: React.FC = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationshipWithEntities[]>([]);
  const [nodes, setNodes] = useState<EntityNode[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [entitiesData, relationshipsData] = await Promise.all([
        api.get('/api/entities?limit=1000'),
        api.get('/api/relationships')
      ]);
      
      setEntities(entitiesData.data);
      setRelationships(relationshipsData.data);
      
      // Generate layout
      generateLayout(entitiesData.data, relationshipsData.data);
    } catch (err) {
      setError('Failed to load entity relationship data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateLayout = (entitiesData: Entity[], relationshipsData: EntityRelationshipWithEntities[]) => {
    // Simple circular layout for now
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    const entityNodes: EntityNode[] = entitiesData.map((entity, index) => {
      const angle = (2 * Math.PI * index) / entitiesData.length;
      return {
        id: entity.id,
        name: entity.name,
        type: entity.entity_type,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        relationships: relationshipsData.filter(rel => 
          rel.from_entity_id === entity.id || rel.to_entity_id === entity.id
        )
      };
    });

    const relationshipEdges: RelationshipEdge[] = relationshipsData.map(rel => ({
      from: rel.from_entity_id,
      to: rel.to_entity_id,
      type: rel.relationship_type,
      ownership: rel.percentage_ownership || 0,
      label: `${rel.relationship_type}${rel.percentage_ownership ? ` (${rel.percentage_ownership}%)` : ''}`
    }));

    setNodes(entityNodes);
    setEdges(relationshipEdges);
  };

  const getNodeColor = (entityType: string): string => {
    switch (entityType) {
      case 'INDIVIDUAL': return '#4CAF50';
      case 'TRUST': return '#2196F3';
      case 'LLC': return '#FF9800';
      case 'CORPORATION': return '#9C27B0';
      case 'PARTNERSHIP': return '#F44336';
      default: return '#757575';
    }
  };

  const getRelationshipColor = (type: AdvancedRelationshipType): string => {
    switch (type) {
      case AdvancedRelationshipType.TRUST_RELATIONSHIP: return '#e74c3c';
      case AdvancedRelationshipType.GRANTOR: return '#e74c3c';
      case AdvancedRelationshipType.SHAREHOLDER: return '#3498db';
      case AdvancedRelationshipType.VOTING_INTEREST: return '#3498db';
      case AdvancedRelationshipType.NON_VOTING_INTEREST: return '#5dade2';
      case AdvancedRelationshipType.FAMILY_RELATIONSHIP: return '#2ecc71';
      case AdvancedRelationshipType.BENEFICIARY: return '#f39c12';
      case AdvancedRelationshipType.PRIMARY_BENEFICIARY: return '#f39c12';
      case AdvancedRelationshipType.CONTINGENT_BENEFICIARY: return '#f8c471';
      case AdvancedRelationshipType.TRUSTEE: return '#9b59b6';
      case AdvancedRelationshipType.SUCCESSOR_TRUSTEE: return '#bb6bd9';
      case AdvancedRelationshipType.MANAGER: return '#34495e';
      case AdvancedRelationshipType.MANAGING_MEMBER: return '#34495e';
      case AdvancedRelationshipType.BOARD_MEMBER: return '#7f8c8d';
      case AdvancedRelationshipType.OFFICER: return '#566573';
      default: return '#95a5a6';
    }
  };

  const handleNodeClick = (entityId: number) => {
    setSelectedEntity(selectedEntity === entityId ? null : entityId);
  };

  if (loading) {
    return <div className="visualization-loading">Loading relationship visualization...</div>;
  }

  if (error) {
    return <div className="visualization-error">{error}</div>;
  }

  return (
    <div className="entity-relationship-visualization">
      <div className="visualization-header">
        <h3>Entity Relationship Network</h3>
        <p>Visual representation of corporate and family relationships</p>
      </div>

      <div className="visualization-controls">
        <div className="legend">
          <h4>Entity Types</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#4CAF50' }}></div>
              <span>Individual</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#2196F3' }}></div>
              <span>Trust</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#FF9800' }}></div>
              <span>LLC</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#9C27B0' }}></div>
              <span>Corporation</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#F44336' }}></div>
              <span>Partnership</span>
            </div>
          </div>
        </div>

        <div className="relationship-legend">
          <h4>Relationship Types</h4>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#e74c3c' }}></div>
              <span>Trust Relationships</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#3498db' }}></div>
              <span>Ownership/Voting</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#2ecc71' }}></div>
              <span>Family Relationships</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#f39c12' }}></div>
              <span>Beneficiaries</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#9b59b6' }}></div>
              <span>Trustees</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#34495e' }}></div>
              <span>Management</span>
            </div>
          </div>
        </div>
      </div>

      <div className="visualization-container">
        <svg width="800" height="600" className="relationship-svg">
          {/* Render edges (relationships) first so they appear behind nodes */}
          {edges.map((edge, index) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            
            if (!fromNode || !toNode) return null;
            
            return (
              <g key={index}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={getRelationshipColor(edge.type)}
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                {/* Relationship label */}
                <text
                  x={(fromNode.x + toNode.x) / 2}
                  y={(fromNode.y + toNode.y) / 2 - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                  className="relationship-label"
                >
                  {edge.ownership > 0 ? `${edge.ownership}%` : edge.type.replace('_', ' ')}
                </text>
              </g>
            );
          })}
          
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#666"
              />
            </marker>
          </defs>
          
          {/* Render nodes (entities) */}
          {nodes.map(node => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r="25"
                fill={getNodeColor(node.type)}
                stroke={selectedEntity === node.id ? "#000" : "#fff"}
                strokeWidth={selectedEntity === node.id ? "3" : "2"}
                className="entity-node"
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={node.x}
                y={node.y + 35}
                textAnchor="middle"
                fontSize="12"
                fill="#333"
                className="entity-label"
              >
                {node.name.length > 15 ? `${node.name.substring(0, 12)}...` : node.name}
              </text>
              <text
                x={node.x}
                y={node.y + 50}
                textAnchor="middle"
                fontSize="10"
                fill="#666"
                className="entity-type-label"
              >
                {node.type.replace('_', ' ')}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {selectedEntity && (
        <div className="entity-details-panel">
          <h4>Entity Details</h4>
          {(() => {
            const entity = entities.find(e => e.id === selectedEntity);
            const entityRelationships = relationships.filter(r => 
              r.from_entity_id === selectedEntity || r.to_entity_id === selectedEntity
            );
            
            return entity ? (
              <div>
                <h5>{entity.name}</h5>
                <p><strong>Type:</strong> {entity.entity_type.replace('_', ' ')}</p>
                {entity.tax_id && <p><strong>Tax ID:</strong> {entity.tax_id}</p>}
                {entity.formation_date && <p><strong>Formation Date:</strong> {entity.formation_date}</p>}
                
                <h6>Relationships ({entityRelationships.length})</h6>
                {entityRelationships.map(rel => (
                  <div key={rel.id} className="relationship-item">
                    <span className="relationship-type">{rel.relationship_type.replace('_', ' ')}</span>
                    {rel.from_entity_id === selectedEntity ? (
                      <span> → {entities.find(e => e.id === rel.to_entity_id)?.name}</span>
                    ) : (
                      <span> ← {entities.find(e => e.id === rel.from_entity_id)?.name}</span>
                    )}
                    {rel.percentage_ownership > 0 && (
                      <span className="ownership-percentage"> ({rel.percentage_ownership}%)</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      )}

      <div className="visualization-stats">
        <div className="stat-item">
          <span className="stat-value">{entities.length}</span>
          <span className="stat-label">Total Entities</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{relationships.length}</span>
          <span className="stat-label">Relationships</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {relationships.filter(r => r.relationship_type === AdvancedRelationshipType.FAMILY_RELATIONSHIP).length}
          </span>
          <span className="stat-label">Family Links</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {relationships.filter(r => r.percentage_ownership > 0).length}
          </span>
          <span className="stat-label">Ownership Links</span>
        </div>
      </div>
    </div>
  );
};

export default EntityRelationshipVisualization;