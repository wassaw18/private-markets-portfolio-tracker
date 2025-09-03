import React, { useState } from 'react';
import EntityManagement from '../components/EntityManagement';
import EntityRelationshipManager from '../components/EntityRelationshipManager';
import EntityRelationshipVisualization from '../components/EntityRelationshipVisualization';
import './Entities.css';

const Entities: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entities' | 'relationships' | 'visualization'>('entities');

  return (
    <div className="entities-container">
      <div className="entities-header">
        <h2>Entity & Relationship Management</h2>
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'entities' ? 'active' : ''}`}
            onClick={() => setActiveTab('entities')}
          >
            Entities
          </button>
          <button
            className={`tab-button ${activeTab === 'relationships' ? 'active' : ''}`}
            onClick={() => setActiveTab('relationships')}
          >
            Relationships
          </button>
          <button
            className={`tab-button ${activeTab === 'visualization' ? 'active' : ''}`}
            onClick={() => setActiveTab('visualization')}
          >
            Visualization
          </button>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'entities' && (
          <div className="entities-tab">
            <EntityManagement />
          </div>
        )}
        
        {activeTab === 'relationships' && (
          <div className="relationships-tab">
            <EntityRelationshipManager />
          </div>
        )}
        
        {activeTab === 'visualization' && (
          <div className="visualization-tab">
            <EntityRelationshipVisualization />
          </div>
        )}
      </div>
    </div>
  );
};

export default Entities;