import React, { useState } from 'react';
import EntityManagement from '../components/EntityManagement';
import EntityRelationshipManager from '../components/EntityRelationshipManager';
import EntityRelationshipVisualization from '../components/EntityRelationshipVisualization';
import UploadWidget from '../components/UploadWidget';
import './Entities.css';

const Entities: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entities' | 'relationships' | 'visualization'>('entities');

  const handleEntityUploadComplete = () => {
    // Refresh entity data when upload completes
    // This will trigger a refresh in the EntityManagement component
    window.location.reload(); // Simple approach - could be improved with context/state management
  };

  return (
    <div className="entities-page">
      <div className="luxury-card page-header">
        <h1 className="luxury-heading-1">Entity & Relationship Management</h1>
      </div>

      <div className="entities-header">
        <div className="section-tabs">
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
          <>
            <div className="luxury-card entity-upload-card">
              <UploadWidget
                type="entities"
                onUploadComplete={handleEntityUploadComplete}
                size="medium"
              />
            </div>
            <div className="luxury-card entities-management-card">
              <EntityManagement />
            </div>
          </>
        )}

        {activeTab === 'relationships' && (
          <div className="section-content">
            <div className="luxury-card relationships-card">
              <EntityRelationshipManager />
            </div>
          </div>
        )}

        {activeTab === 'visualization' && (
          <div className="section-content">
            <div className="luxury-card visualization-card">
              <EntityRelationshipVisualization />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Entities;