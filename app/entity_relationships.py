"""
Advanced Entity Relationship Management API
Handles complex relationships, multi-entity ownership, and hierarchy visualization
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import date, datetime

from app.models import (
    Entity, EntityRelationship, InvestmentOwnership, EntityHierarchy,
    Investment, AdvancedRelationshipType, OwnershipType, EntityType
)
from app.schemas import (
    EntityRelationshipCreate, EntityRelationshipUpdate, EntityRelationship as EntityRelationshipSchema,
    EntityRelationshipWithEntities, InvestmentOwnershipCreate, InvestmentOwnershipUpdate,
    InvestmentOwnership as InvestmentOwnershipSchema, InvestmentOwnershipWithDetails,
    EntityHierarchyCreate, EntityHierarchyUpdate, EntityHierarchy as EntityHierarchySchema,
    EntityHierarchyNode, EntityWithRelationships, InvestmentWithOwnership,
    FamilyTreeResponse, OwnershipVisualizationData
)

class EntityRelationshipService:
    """Service for managing advanced entity relationships"""
    
    @staticmethod
    def create_relationship(db: Session, relationship: EntityRelationshipCreate) -> EntityRelationshipSchema:
        """Create a new entity relationship"""
        
        # Validate entities exist
        from_entity = db.query(Entity).filter(Entity.id == relationship.from_entity_id).first()
        to_entity = db.query(Entity).filter(Entity.id == relationship.to_entity_id).first()
        
        if not from_entity:
            raise HTTPException(status_code=404, detail="From entity not found")
        if not to_entity:
            raise HTTPException(status_code=404, detail="To entity not found")
        
        # Prevent self-relationships
        if relationship.from_entity_id == relationship.to_entity_id:
            raise HTTPException(status_code=400, detail="Entity cannot have relationship with itself")
        
        # Check for duplicate active relationships of the same type
        existing = db.query(EntityRelationship).filter(
            and_(
                EntityRelationship.from_entity_id == relationship.from_entity_id,
                EntityRelationship.to_entity_id == relationship.to_entity_id,
                EntityRelationship.relationship_type == relationship.relationship_type,
                EntityRelationship.is_active == True,
                or_(EntityRelationship.end_date.is_(None), EntityRelationship.end_date > date.today())
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=409, 
                detail="Active relationship of this type already exists between these entities"
            )
        
        # Create the relationship
        db_relationship = EntityRelationship(**relationship.dict())
        db.add(db_relationship)
        db.commit()
        db.refresh(db_relationship)
        
        return EntityRelationshipSchema.from_orm(db_relationship)
    
    @staticmethod
    def get_relationships(
        db: Session, 
        entity_id: Optional[int] = None,
        relationship_type: Optional[AdvancedRelationshipType] = None,
        include_inactive: bool = False
    ) -> List[EntityRelationshipWithEntities]:
        """Get entity relationships with filtering options"""
        
        # Use aliases for proper joins
        from sqlalchemy.orm import aliased
        FromEntity = aliased(Entity, name='from_entity')
        ToEntity = aliased(Entity, name='to_entity')
        
        query = db.query(
            EntityRelationship,
            FromEntity.name.label('from_entity_name'),
            FromEntity.entity_type.label('from_entity_type'),
            ToEntity.name.label('to_entity_name'),
            ToEntity.entity_type.label('to_entity_type')
        ).join(
            FromEntity, FromEntity.id == EntityRelationship.from_entity_id
        ).join(
            ToEntity, ToEntity.id == EntityRelationship.to_entity_id
        )
        
        # Filter by entity (either from or to)
        if entity_id:
            query = query.filter(
                or_(
                    EntityRelationship.from_entity_id == entity_id,
                    EntityRelationship.to_entity_id == entity_id
                )
            )
        
        # Filter by relationship type
        if relationship_type:
            query = query.filter(EntityRelationship.relationship_type == relationship_type)
        
        # Filter by active status
        if not include_inactive:
            query = query.filter(
                and_(
                    EntityRelationship.is_active == True,
                    or_(EntityRelationship.end_date.is_(None), EntityRelationship.end_date > date.today())
                )
            )
        
        results = query.all()
        
        # Convert to response format
        relationships = []
        for rel, from_name, from_type, to_name, to_type in results:
            rel_dict = EntityRelationshipSchema.from_orm(rel).dict()
            rel_dict.update({
                'from_entity_name': from_name,
                'from_entity_type': from_type,
                'to_entity_name': to_name,
                'to_entity_type': to_type
            })
            relationships.append(EntityRelationshipWithEntities(**rel_dict))
        
        return relationships
    
    @staticmethod
    def update_relationship(
        db: Session, 
        relationship_id: int, 
        relationship_update: EntityRelationshipUpdate
    ) -> EntityRelationshipSchema:
        """Update an existing entity relationship"""
        
        db_relationship = db.query(EntityRelationship).filter(EntityRelationship.id == relationship_id).first()
        if not db_relationship:
            raise HTTPException(status_code=404, detail="Relationship not found")
        
        # Update fields
        for field, value in relationship_update.dict(exclude_unset=True).items():
            setattr(db_relationship, field, value)
        
        db_relationship.updated_date = datetime.utcnow()
        db.commit()
        db.refresh(db_relationship)
        
        return EntityRelationshipSchema.from_orm(db_relationship)
    
    @staticmethod
    def delete_relationship(db: Session, relationship_id: int) -> bool:
        """Delete an entity relationship"""
        
        db_relationship = db.query(EntityRelationship).filter(EntityRelationship.id == relationship_id).first()
        if not db_relationship:
            raise HTTPException(status_code=404, detail="Relationship not found")
        
        db.delete(db_relationship)
        db.commit()
        
        return True

class InvestmentOwnershipService:
    """Service for managing multi-entity investment ownership"""
    
    @staticmethod
    def create_ownership(db: Session, ownership: InvestmentOwnershipCreate) -> InvestmentOwnershipSchema:
        """Create new investment ownership record"""
        
        # Validate investment and entity exist
        investment = db.query(Investment).filter(Investment.id == ownership.investment_id).first()
        entity = db.query(Entity).filter(Entity.id == ownership.entity_id).first()
        
        if not investment:
            raise HTTPException(status_code=404, detail="Investment not found")
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        # Check for existing ownership by this entity for this investment
        existing = db.query(InvestmentOwnership).filter(
            and_(
                InvestmentOwnership.investment_id == ownership.investment_id,
                InvestmentOwnership.entity_id == ownership.entity_id,
                or_(InvestmentOwnership.end_date.is_(None), InvestmentOwnership.end_date > ownership.effective_date)
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Active ownership record already exists for this entity and investment"
            )
        
        # Validate total ownership doesn't exceed 100%
        total_ownership = db.query(func.sum(InvestmentOwnership.ownership_percentage)).filter(
            and_(
                InvestmentOwnership.investment_id == ownership.investment_id,
                or_(InvestmentOwnership.end_date.is_(None), InvestmentOwnership.end_date > ownership.effective_date)
            )
        ).scalar() or 0.0
        
        if total_ownership + ownership.ownership_percentage > 100.01:  # Allow small rounding tolerance
            raise HTTPException(
                status_code=400,
                detail=f"Total ownership would exceed 100%. Current: {total_ownership:.2f}%, Adding: {ownership.ownership_percentage:.2f}%"
            )
        
        # Create ownership record
        db_ownership = InvestmentOwnership(**ownership.dict())
        db.add(db_ownership)
        db.commit()
        db.refresh(db_ownership)
        
        return InvestmentOwnershipSchema.from_orm(db_ownership)
    
    @staticmethod
    def get_investment_ownership(db: Session, investment_id: int) -> List[InvestmentOwnershipWithDetails]:
        """Get ownership breakdown for an investment"""
        
        query = db.query(
            InvestmentOwnership,
            Entity.name.label('entity_name'),
            Entity.entity_type.label('entity_type'),
            Investment.name.label('investment_name'),
            Investment.asset_class.label('investment_asset_class')
        ).join(Entity).join(Investment).filter(
            and_(
                InvestmentOwnership.investment_id == investment_id,
                or_(InvestmentOwnership.end_date.is_(None), InvestmentOwnership.end_date > date.today())
            )
        )
        
        results = query.all()
        
        ownership_records = []
        for ownership, entity_name, entity_type, investment_name, asset_class in results:
            ownership_dict = InvestmentOwnershipSchema.from_orm(ownership).dict()
            ownership_dict.update({
                'entity_name': entity_name,
                'entity_type': entity_type,
                'investment_name': investment_name,
                'investment_asset_class': asset_class
            })
            ownership_records.append(InvestmentOwnershipWithDetails(**ownership_dict))
        
        return ownership_records
    
    @staticmethod
    def get_entity_investments(db: Session, entity_id: int) -> List[InvestmentOwnershipWithDetails]:
        """Get all investments owned by an entity"""
        
        query = db.query(
            InvestmentOwnership,
            Entity.name.label('entity_name'),
            Entity.entity_type.label('entity_type'),
            Investment.name.label('investment_name'),
            Investment.asset_class.label('investment_asset_class')
        ).join(Entity).join(Investment).filter(
            and_(
                InvestmentOwnership.entity_id == entity_id,
                or_(InvestmentOwnership.end_date.is_(None), InvestmentOwnership.end_date > date.today())
            )
        )
        
        results = query.all()
        
        ownership_records = []
        for ownership, entity_name, entity_type, investment_name, asset_class in results:
            ownership_dict = InvestmentOwnershipSchema.from_orm(ownership).dict()
            ownership_dict.update({
                'entity_name': entity_name,
                'entity_type': entity_type,
                'investment_name': investment_name,
                'investment_asset_class': asset_class
            })
            ownership_records.append(InvestmentOwnershipWithDetails(**ownership_dict))
        
        return ownership_records
    
    @staticmethod
    def update_ownership(
        db: Session, 
        ownership_id: int, 
        ownership_update: InvestmentOwnershipUpdate
    ) -> InvestmentOwnershipSchema:
        """Update investment ownership record"""
        
        db_ownership = db.query(InvestmentOwnership).filter(InvestmentOwnership.id == ownership_id).first()
        if not db_ownership:
            raise HTTPException(status_code=404, detail="Ownership record not found")
        
        # If updating percentage, validate total doesn't exceed 100%
        if ownership_update.ownership_percentage is not None:
            other_ownership = db.query(func.sum(InvestmentOwnership.ownership_percentage)).filter(
                and_(
                    InvestmentOwnership.investment_id == db_ownership.investment_id,
                    InvestmentOwnership.id != ownership_id,
                    or_(InvestmentOwnership.end_date.is_(None), InvestmentOwnership.end_date > date.today())
                )
            ).scalar() or 0.0
            
            if other_ownership + ownership_update.ownership_percentage > 100.01:
                raise HTTPException(
                    status_code=400,
                    detail=f"Total ownership would exceed 100%. Other ownership: {other_ownership:.2f}%, Updating to: {ownership_update.ownership_percentage:.2f}%"
                )
        
        # Update fields
        for field, value in ownership_update.dict(exclude_unset=True).items():
            setattr(db_ownership, field, value)
        
        db_ownership.updated_date = datetime.utcnow()
        db.commit()
        db.refresh(db_ownership)
        
        return InvestmentOwnershipSchema.from_orm(db_ownership)
    
    @staticmethod
    def get_ownership_visualization_data(db: Session, investment_id: int) -> OwnershipVisualizationData:
        """Get data for ownership visualization charts"""
        
        investment = db.query(Investment).filter(Investment.id == investment_id).first()
        if not investment:
            raise HTTPException(status_code=404, detail="Investment not found")
        
        ownership_records = InvestmentOwnershipService.get_investment_ownership(db, investment_id)
        
        # Calculate ownership breakdown with amounts
        ownership_breakdown = []
        for record in ownership_records:
            amount = (record.ownership_percentage / 100.0) * investment.commitment_amount
            ownership_breakdown.append({
                'entity_name': record.entity_name,
                'entity_type': record.entity_type.value,
                'percentage': record.ownership_percentage,
                'amount': amount,
                'ownership_type': record.ownership_type.value
            })
        
        return OwnershipVisualizationData(
            investment_id=investment_id,
            investment_name=investment.name,
            total_commitment=investment.commitment_amount,
            ownership_breakdown=ownership_breakdown,
            effective_date=date.today()
        )

class EntityHierarchyService:
    """Service for managing entity hierarchy and family tree visualization"""
    
    @staticmethod
    def create_hierarchy_entry(db: Session, hierarchy: EntityHierarchyCreate) -> EntityHierarchySchema:
        """Create entity hierarchy entry"""
        
        # Validate entity exists
        entity = db.query(Entity).filter(Entity.id == hierarchy.entity_id).first()
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        # Validate parent entity exists (if specified)
        if hierarchy.parent_entity_id:
            parent = db.query(Entity).filter(Entity.id == hierarchy.parent_entity_id).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent entity not found")
        
        # Check for existing hierarchy entry
        existing = db.query(EntityHierarchy).filter(
            EntityHierarchy.entity_id == hierarchy.entity_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Hierarchy entry already exists for this entity"
            )
        
        # Calculate hierarchy level
        if hierarchy.parent_entity_id:
            parent_entry = db.query(EntityHierarchy).filter(
                EntityHierarchy.entity_id == hierarchy.parent_entity_id
            ).first()
            if parent_entry:
                hierarchy.hierarchy_level = parent_entry.hierarchy_level + 1
        
        # Create hierarchy entry
        db_hierarchy = EntityHierarchy(**hierarchy.dict())
        db.add(db_hierarchy)
        db.commit()
        db.refresh(db_hierarchy)
        
        # Update hierarchy path (trigger should handle this, but let's be explicit)
        EntityHierarchyService._update_hierarchy_path(db, db_hierarchy)
        
        return EntityHierarchySchema.from_orm(db_hierarchy)
    
    @staticmethod
    def _update_hierarchy_path(db: Session, hierarchy: EntityHierarchy):
        """Update the hierarchy path for an entry"""
        if hierarchy.parent_entity_id:
            parent_entry = db.query(EntityHierarchy).filter(
                EntityHierarchy.entity_id == hierarchy.parent_entity_id
            ).first()
            if parent_entry and parent_entry.hierarchy_path:
                hierarchy.hierarchy_path = f"{parent_entry.hierarchy_path}.{hierarchy.entity_id}"
            else:
                hierarchy.hierarchy_path = str(hierarchy.entity_id)
        else:
            hierarchy.hierarchy_path = str(hierarchy.entity_id)
        
        db.commit()
    
    @staticmethod
    def get_family_tree(db: Session) -> FamilyTreeResponse:
        """Get complete family tree structure"""
        
        # Get all hierarchy entries with entity details
        query = db.query(
            EntityHierarchy,
            Entity.name.label('entity_name'),
            Entity.entity_type.label('entity_type')
        ).join(Entity).order_by(EntityHierarchy.hierarchy_level, EntityHierarchy.sort_order)
        
        results = query.all()
        
        # Build tree structure
        entity_nodes = {}
        root_entities = []
        orphaned_entities = []
        
        for hierarchy, entity_name, entity_type in results:
            node = EntityHierarchyNode(
                entity_id=hierarchy.entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                parent_entity_id=hierarchy.parent_entity_id,
                hierarchy_level=hierarchy.hierarchy_level,
                children=[],
                relationship_summary=""
            )
            entity_nodes[hierarchy.entity_id] = node
            
            if hierarchy.parent_entity_id is None:
                root_entities.append(node)
        
        # Build parent-child relationships
        for hierarchy, entity_name, entity_type in results:
            if hierarchy.parent_entity_id and hierarchy.parent_entity_id in entity_nodes:
                entity_nodes[hierarchy.parent_entity_id].children.append(
                    entity_nodes[hierarchy.entity_id]
                )
        
        # Find orphaned entities (entities without hierarchy entries)
        all_entities = db.query(Entity).filter(Entity.is_active == True).all()
        hierarchy_entity_ids = {h.entity_id for h, _, _ in results}
        
        for entity in all_entities:
            if entity.id not in hierarchy_entity_ids:
                orphaned_entities.append(EntityHierarchyNode(
                    entity_id=entity.id,
                    entity_name=entity.name,
                    entity_type=entity.entity_type,
                    parent_entity_id=None,
                    hierarchy_level=1,
                    children=[],
                    relationship_summary="No hierarchy defined"
                ))
        
        max_depth = max([h.hierarchy_level for h, _, _ in results]) if results else 0
        
        return FamilyTreeResponse(
            root_entities=root_entities,
            orphaned_entities=orphaned_entities,
            total_entities=len(all_entities),
            max_hierarchy_depth=max_depth
        )
    
    @staticmethod
    def get_entity_with_relationships(db: Session, entity_id: int) -> EntityWithRelationships:
        """Get entity with all its relationships"""
        
        entity = db.query(Entity).filter(Entity.id == entity_id).first()
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        # Get entity relationships
        outgoing_relationships = EntityRelationshipService.get_relationships(db, entity_id=entity_id)
        incoming_relationships = EntityRelationshipService.get_relationships(db, entity_id=entity_id)
        
        # Get investment ownerships
        investment_ownerships = InvestmentOwnershipService.get_entity_investments(db, entity_id)
        
        # Get hierarchy position
        hierarchy_position = db.query(EntityHierarchy).filter(
            EntityHierarchy.entity_id == entity_id
        ).first()
        
        entity_dict = entity.__dict__.copy()
        entity_dict.update({
            'outgoing_relationships': [r for r in outgoing_relationships if r.from_entity_id == entity_id],
            'incoming_relationships': [r for r in incoming_relationships if r.to_entity_id == entity_id],
            'investment_ownerships': investment_ownerships,
            'hierarchy_position': EntityHierarchySchema.from_orm(hierarchy_position) if hierarchy_position else None
        })
        
        return EntityWithRelationships(**entity_dict)