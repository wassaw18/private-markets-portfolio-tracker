import React, { useState, useEffect } from 'react';
import { Entity, EntityRelationshipWithEntities, RelationshipCategory } from '../types/entity';
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
  category: RelationshipCategory;
  type: string;
  ownership: number;
  label: string;
}

const EntityRelationshipVisualization: React.FC = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationshipWithEntities[]>([]);
  const [nodes, setNodes] = useState<EntityNode[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<number | null>(null);
  const [filteredEntityTypes, setFilteredEntityTypes] = useState<string[]>([]);
  const [filteredRelationshipCategories, setFilteredRelationshipCategories] = useState<RelationshipCategory[]>([]);
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
        api.get('/api/entity-relationships')
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
      category: rel.relationship_category,
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

  const getRelationshipColor = (category: RelationshipCategory): string => {
    switch (category) {
      case RelationshipCategory.FAMILY: return '#2ecc71';
      case RelationshipCategory.BUSINESS: return '#3498db';
      case RelationshipCategory.TRUST: return '#e74c3c';
      case RelationshipCategory.PROFESSIONAL: return '#9b59b6';
      case RelationshipCategory.OTHER: return '#95a5a6';
      default: return '#95a5a6';
    }
  };

  const handleNodeClick = (entityId: number) => {
    setSelectedEntity(selectedEntity === entityId ? null : entityId);
  };

  const toggleEntityTypeFilter = (entityType: string) => {
    setFilteredEntityTypes(prev =>
      prev.includes(entityType)
        ? prev.filter(t => t !== entityType)
        : [...prev, entityType]
    );
  };

  const toggleRelationshipCategoryFilter = (category: RelationshipCategory) => {
    setFilteredRelationshipCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearAllFilters = () => {
    setFilteredEntityTypes([]);
    setFilteredRelationshipCategories([]);
  };

  const hasActiveFilters = filteredEntityTypes.length > 0 || filteredRelationshipCategories.length > 0;

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
        {hasActiveFilters && (
          <button className="reset-filters-button" onClick={clearAllFilters}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
            Clear All Filters
          </button>
        )}
        <div className="legend">
          <h4>Entity Types (click to highlight)</h4>
          <div className="legend-items">
            <div
              className={`legend-item ${filteredEntityTypes.includes('INDIVIDUAL') ? 'legend-item-active' : ''}`}
              onClick={() => toggleEntityTypeFilter('INDIVIDUAL')}
            >
              <div className="legend-color" style={{ backgroundColor: '#4CAF50' }}></div>
              <span>Individual</span>
            </div>
            <div
              className={`legend-item ${filteredEntityTypes.includes('TRUST') ? 'legend-item-active' : ''}`}
              onClick={() => toggleEntityTypeFilter('TRUST')}
            >
              <div className="legend-color" style={{ backgroundColor: '#2196F3' }}></div>
              <span>Trust</span>
            </div>
            <div
              className={`legend-item ${filteredEntityTypes.includes('LLC') ? 'legend-item-active' : ''}`}
              onClick={() => toggleEntityTypeFilter('LLC')}
            >
              <div className="legend-color" style={{ backgroundColor: '#FF9800' }}></div>
              <span>LLC</span>
            </div>
            <div
              className={`legend-item ${filteredEntityTypes.includes('CORPORATION') ? 'legend-item-active' : ''}`}
              onClick={() => toggleEntityTypeFilter('CORPORATION')}
            >
              <div className="legend-color" style={{ backgroundColor: '#9C27B0' }}></div>
              <span>Corporation</span>
            </div>
            <div
              className={`legend-item ${filteredEntityTypes.includes('PARTNERSHIP') ? 'legend-item-active' : ''}`}
              onClick={() => toggleEntityTypeFilter('PARTNERSHIP')}
            >
              <div className="legend-color" style={{ backgroundColor: '#F44336' }}></div>
              <span>Partnership</span>
            </div>
          </div>
        </div>

        <div className="relationship-legend">
          <h4>Relationship Types (click to highlight)</h4>
          <div className="legend-items">
            <div
              className={`legend-item ${filteredRelationshipCategories.includes(RelationshipCategory.FAMILY) ? 'legend-item-active' : ''}`}
              onClick={() => toggleRelationshipCategoryFilter(RelationshipCategory.FAMILY)}
            >
              <div className="legend-line" style={{ backgroundColor: '#2ecc71' }}></div>
              <span>Family</span>
            </div>
            <div
              className={`legend-item ${filteredRelationshipCategories.includes(RelationshipCategory.BUSINESS) ? 'legend-item-active' : ''}`}
              onClick={() => toggleRelationshipCategoryFilter(RelationshipCategory.BUSINESS)}
            >
              <div className="legend-line" style={{ backgroundColor: '#3498db' }}></div>
              <span>Business</span>
            </div>
            <div
              className={`legend-item ${filteredRelationshipCategories.includes(RelationshipCategory.TRUST) ? 'legend-item-active' : ''}`}
              onClick={() => toggleRelationshipCategoryFilter(RelationshipCategory.TRUST)}
            >
              <div className="legend-line" style={{ backgroundColor: '#e74c3c' }}></div>
              <span>Trust</span>
            </div>
            <div
              className={`legend-item ${filteredRelationshipCategories.includes(RelationshipCategory.PROFESSIONAL) ? 'legend-item-active' : ''}`}
              onClick={() => toggleRelationshipCategoryFilter(RelationshipCategory.PROFESSIONAL)}
            >
              <div className="legend-line" style={{ backgroundColor: '#9b59b6' }}></div>
              <span>Professional</span>
            </div>
            <div
              className={`legend-item ${filteredRelationshipCategories.includes(RelationshipCategory.OTHER) ? 'legend-item-active' : ''}`}
              onClick={() => toggleRelationshipCategoryFilter(RelationshipCategory.OTHER)}
            >
              <div className="legend-line" style={{ backgroundColor: '#95a5a6' }}></div>
              <span>Other</span>
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

            // Check if this edge is connected to the hovered node
            const isHighlighted = hoveredEntity !== null &&
              (edge.from === hoveredEntity || edge.to === hoveredEntity);

            // Check if this edge matches the relationship filter
            const isFiltered = filteredRelationshipCategories.length > 0 &&
              filteredRelationshipCategories.includes(edge.category);

            // Dimmed if filters are active and this edge doesn't match
            const isDimmed = filteredRelationshipCategories.length > 0 && !isFiltered;

            return (
              <g key={index}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={getRelationshipColor(edge.category)}
                  strokeWidth={isHighlighted || isFiltered ? "4" : "2"}
                  strokeOpacity={isDimmed ? "0.15" : (isHighlighted || isFiltered ? "1" : "0.6")}
                  markerEnd="url(#arrowhead)"
                  className={isHighlighted || isFiltered ? "relationship-line-highlighted" : "relationship-line"}
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
                  {edge.ownership > 0 ? `${edge.ownership}%` : edge.type}
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
          {nodes.map(node => {
            const isHovered = hoveredEntity === node.id;
            const isSelected = selectedEntity === node.id;

            // Check if this node matches the entity type filter
            const isFiltered = filteredEntityTypes.length > 0 &&
              filteredEntityTypes.includes(node.type);

            // Dimmed if filters are active and this node doesn't match
            const isDimmed = filteredEntityTypes.length > 0 && !isFiltered;

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="25"
                  fill={getNodeColor(node.type)}
                  fillOpacity={isDimmed ? "0.2" : "1"}
                  stroke={isSelected ? "#000" : "#fff"}
                  strokeWidth={isSelected ? "3" : "2"}
                  strokeOpacity={isDimmed ? "0.3" : "1"}
                  className={isHovered || isFiltered ? "entity-node entity-node-hovered" : "entity-node"}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={() => setHoveredEntity(node.id)}
                  onMouseLeave={() => setHoveredEntity(null)}
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
            );
          })}
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
                    <span className="relationship-category">[{rel.relationship_category}]</span>
                    <span className="relationship-type">{rel.relationship_type}</span>
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
            {relationships.filter(r => r.relationship_category === RelationshipCategory.FAMILY).length}
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