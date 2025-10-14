"""
Reports API Router

Provides tenant-scoped PDF report generation endpoints for portfolio analytics.
All reports are isolated by tenant and require authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime

from ..database import get_db
from ..auth import get_current_active_user
from ..models import User, Investment as InvestmentModel, Entity as EntityModel, CashFlow, Valuation, InvestmentStatus, CashFlowType
from ..report_service import PortfolioSummaryReport, HoldingsReport, EntityPerformanceReport, CashFlowActivityReport
from ..performance import calculate_irr, calculate_investment_performance, CashFlowEvent

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def format_asset_class(asset_class: str) -> str:
    """Convert database asset class values to formal display names."""
    asset_class_map = {
        'PRIVATE_EQUITY': 'Private Equity',
        'VENTURE_CAPITAL': 'Venture Capital',
        'REAL_ESTATE': 'Real Estate',
        'REAL_ASSETS': 'Real Assets',
        'INFRASTRUCTURE': 'Infrastructure',
        'PRIVATE_DEBT': 'Private Debt',
        'HEDGE_FUNDS': 'Hedge Funds',
        'NATURAL_RESOURCES': 'Natural Resources',
        'CO_INVESTMENTS': 'Co-Investments',
        'SECONDARIES': 'Secondaries',
        'Unknown': 'Other/Unknown'
    }
    return asset_class_map.get(asset_class, asset_class.replace('_', ' ').title())


@router.get("/portfolio-summary")
async def generate_portfolio_summary_report(
    as_of_date: Optional[str] = Query(None, description="Report as-of date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate Portfolio Summary Report (PDF)

    Contains:
    - Total NAV, commitments, called capital, distributions
    - Performance metrics: IRR, TVPI, DPI, RVPI
    - Asset allocation breakdown
    - Vintage year analysis
    - Investment status counts
    """
    try:
        # Parse as_of_date or use today
        report_date = date.today()
        if as_of_date:
            report_date = datetime.strptime(as_of_date, "%Y-%m-%d").date()

        # Get all investments for tenant
        investments = db.query(InvestmentModel).filter(
            InvestmentModel.tenant_id == current_user.tenant_id
        ).all()

        # Calculate summary statistics
        total_commitments = 0
        total_called = 0
        total_distributions = 0
        total_nav = 0
        active_count = 0
        realized_count = 0
        all_cash_flows = []

        # Asset allocation tracking
        asset_allocation = {}
        vintage_analysis = {}

        for inv in investments:
            commitment = inv.commitment_amount or 0
            total_commitments += commitment

            # Count by status
            if inv.status == InvestmentStatus.ACTIVE:
                active_count += 1
            elif inv.status == InvestmentStatus.REALIZED:
                realized_count += 1

            # Get cash flows
            cash_flows = db.query(CashFlow).filter(
                CashFlow.investment_id == inv.id,
                CashFlow.date <= report_date
            ).all()

            # Calculate called and distributions
            called = sum(cf.amount for cf in cash_flows if cf.amount < 0)
            distributions = sum(cf.amount for cf in cash_flows if cf.amount > 0)
            total_called += abs(called)
            total_distributions += distributions

            # Get latest valuation
            latest_val = db.query(Valuation).filter(
                Valuation.investment_id == inv.id,
                Valuation.date <= report_date
            ).order_by(Valuation.date.desc()).first()

            current_nav = latest_val.nav_value if latest_val else 0
            total_nav += current_nav

            # Track asset allocation
            asset_class_raw = inv.asset_class or "Unknown"
            asset_class_formatted = format_asset_class(asset_class_raw)
            if asset_class_formatted not in asset_allocation:
                asset_allocation[asset_class_formatted] = {
                    'asset_class': asset_class_formatted,
                    'count': 0,
                    'total_commitment': 0,
                    'current_nav': 0
                }
            asset_allocation[asset_class_formatted]['count'] += 1
            asset_allocation[asset_class_formatted]['total_commitment'] += commitment
            asset_allocation[asset_class_formatted]['current_nav'] += current_nav

            # Track vintage year
            if inv.vintage_year:
                vintage = str(inv.vintage_year)
                if vintage not in vintage_analysis:
                    vintage_analysis[vintage] = {
                        'vintage_year': vintage,
                        'count': 0,
                        'total_commitment': 0,
                        'current_nav': 0,
                        'total_called': 0,
                        'total_distributions': 0
                    }
                vintage_analysis[vintage]['count'] += 1
                vintage_analysis[vintage]['total_commitment'] += commitment
                vintage_analysis[vintage]['current_nav'] += current_nav
                vintage_analysis[vintage]['total_called'] += abs(called)
                vintage_analysis[vintage]['total_distributions'] += distributions

            # Collect cash flows for IRR calculation
            all_cash_flows.extend([
                CashFlowEvent(date=cf.date, amount=cf.amount) for cf in cash_flows
            ])

        # Add current NAV as final cash flow
        if total_nav > 0:
            all_cash_flows.append(CashFlowEvent(date=report_date, amount=total_nav))

        # Calculate performance metrics
        portfolio_irr = calculate_irr(all_cash_flows) if all_cash_flows else None
        if portfolio_irr is None:
            portfolio_irr = 0
        tvpi = (total_distributions + total_nav) / total_called if total_called > 0 else 0
        dpi = total_distributions / total_called if total_called > 0 else 0
        rvpi = total_nav / total_called if total_called > 0 else 0
        uncalled = total_commitments - total_called

        # Calculate percentages for asset allocation
        for ac in asset_allocation.values():
            ac['percentage'] = (ac['current_nav'] / total_nav * 100) if total_nav > 0 else 0

        # Calculate TVPI for vintage years
        for vy in vintage_analysis.values():
            called = vy['total_called']
            vy['tvpi'] = (vy['total_distributions'] + vy['current_nav']) / called if called > 0 else 0

        # Prepare summary stats
        summary_stats = {
            'total_nav': total_nav,
            'total_commitments': total_commitments,
            'total_called': total_called,
            'uncalled_commitments': uncalled,
            'total_distributions': total_distributions,
            'irr': portfolio_irr * 100,  # Convert to percentage
            'tvpi': tvpi,
            'dpi': dpi,
            'rvpi': rvpi,
            'active_count': active_count,
            'realized_count': realized_count,
            'total_count': len(investments)
        }

        # Sort asset allocation and vintage by NAV
        asset_allocation_list = sorted(
            asset_allocation.values(),
            key=lambda x: x['current_nav'],
            reverse=True
        )

        vintage_analysis_list = sorted(
            vintage_analysis.values(),
            key=lambda x: x['vintage_year']
        )

        # Generate PDF
        report_gen = PortfolioSummaryReport(tenant_name=current_user.tenant.name if current_user.tenant else "Portfolio")
        pdf_buffer = report_gen.generate(
            summary_stats=summary_stats,
            asset_allocation=asset_allocation_list,
            vintage_analysis=vintage_analysis_list,
            as_of_date=report_date
        )

        # Return PDF as streaming response
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=portfolio_summary_{report_date.strftime('%Y%m%d')}.pdf"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/holdings")
async def generate_holdings_report(
    as_of_date: Optional[str] = Query(None, description="Report as-of date (YYYY-MM-DD)"),
    group_by: Optional[str] = Query("entity", description="Group holdings by: entity, asset_class, or vintage"),
    status_filter: Optional[str] = Query("ACTIVE", description="Filter by status: ACTIVE, REALIZED, ALL"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate Holdings Report (PDF)

    Contains:
    - All active investments with current NAV
    - Commitment, called amounts, uncalled commitments
    - Performance metrics by investment
    - Can be grouped by entity or asset class
    """
    try:
        # Parse as_of_date or use today
        report_date = date.today()
        if as_of_date:
            report_date = datetime.strptime(as_of_date, "%Y-%m-%d").date()

        # Build query
        query = db.query(InvestmentModel).filter(
            InvestmentModel.tenant_id == current_user.tenant_id
        )

        # Apply status filter
        if status_filter and status_filter != "ALL":
            query = query.filter(InvestmentModel.status == status_filter)

        investments = query.all()

        # Build holdings data
        holdings = []
        for inv in investments:
            # Get entity name
            entity = db.query(EntityModel).filter(EntityModel.id == inv.entity_id).first()
            entity_name = entity.name if entity else "N/A"

            # Get cash flows
            cash_flows = db.query(CashFlow).filter(
                CashFlow.investment_id == inv.id,
                CashFlow.date <= report_date
            ).all()

            # Use type-based filtering for accuracy
            outflow_types = [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION, CashFlowType.FEES]
            inflow_types = [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]

            called = abs(sum(cf.amount for cf in cash_flows if cf.type in outflow_types))
            distributions = abs(sum(cf.amount for cf in cash_flows if cf.type in inflow_types))
            uncalled = (inv.commitment_amount or 0) - called

            # Get latest valuation
            latest_val = db.query(Valuation).filter(
                Valuation.investment_id == inv.id,
                Valuation.date <= report_date
            ).order_by(Valuation.date.desc()).first()

            current_nav = latest_val.nav_value if latest_val else 0

            # Calculate TVPI
            tvpi = (distributions + current_nav) / called if called > 0 else 0

            holdings.append({
                'investment_name': inv.name,
                'entity_name': entity_name,
                'asset_class': inv.asset_class or 'Unknown',
                'vintage_year': inv.vintage_year,
                'commitment_amount': inv.commitment_amount or 0,
                'called_amount': called,
                'uncalled_amount': uncalled,
                'current_nav': current_nav,
                'distributions': distributions,
                'tvpi': tvpi
            })

        # Sort holdings by group
        if group_by == "entity":
            holdings.sort(key=lambda x: (x['entity_name'], x['investment_name']))
        elif group_by == "asset_class":
            holdings.sort(key=lambda x: (x['asset_class'], x['investment_name']))
        elif group_by == "vintage":
            holdings.sort(key=lambda x: (x['vintage_year'] or 0, x['investment_name']))
        else:
            holdings.sort(key=lambda x: x['investment_name'])

        # Generate PDF
        report_gen = HoldingsReport(tenant_name=current_user.tenant.name if current_user.tenant else "Portfolio")
        pdf_buffer = report_gen.generate(
            holdings=holdings,
            grouped_by=group_by,
            as_of_date=report_date
        )

        # Return PDF
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=holdings_report_{report_date.strftime('%Y%m%d')}.pdf"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/entity-performance")
async def generate_entity_performance_report(
    as_of_date: Optional[str] = Query(None, description="Report as-of date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate Entity-Level Performance Report (PDF)

    Contains:
    - Each entity's total commitments, NAV, distributions
    - Performance metrics aggregated by entity
    - Investment count per entity
    """
    try:
        # Parse as_of_date or use today
        report_date = date.today()
        if as_of_date:
            report_date = datetime.strptime(as_of_date, "%Y-%m-%d").date()

        # Get all entities for tenant
        entities = db.query(EntityModel).filter(
            EntityModel.tenant_id == current_user.tenant_id
        ).all()

        entity_data = []

        for entity in entities:
            # Get investments for this entity
            investments = db.query(InvestmentModel).filter(
                InvestmentModel.entity_id == entity.id,
                InvestmentModel.tenant_id == current_user.tenant_id
            ).all()

            if not investments:
                continue

            total_commitment = 0
            total_called = 0
            total_distributions = 0
            total_nav = 0
            all_cash_flows = []

            for inv in investments:
                total_commitment += inv.commitment_amount or 0

                # Get cash flows
                cash_flows = db.query(CashFlow).filter(
                    CashFlow.investment_id == inv.id,
                    CashFlow.date <= report_date
                ).all()

                # Use type-based filtering for accuracy
                outflow_types = [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION, CashFlowType.FEES]
                inflow_types = [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]

                called = abs(sum(cf.amount for cf in cash_flows if cf.type in outflow_types))
                distributions = abs(sum(cf.amount for cf in cash_flows if cf.type in inflow_types))
                total_called += called
                total_distributions += distributions

                # Get latest valuation
                latest_val = db.query(Valuation).filter(
                    Valuation.investment_id == inv.id,
                    Valuation.date <= report_date
                ).order_by(Valuation.date.desc()).first()

                current_nav = latest_val.nav_value if latest_val else 0
                total_nav += current_nav

                # Collect cash flows for IRR
                all_cash_flows.extend([
                    CashFlowEvent(date=cf.date, amount=cf.amount) for cf in cash_flows
                ])

            # Add current NAV for IRR calculation
            if total_nav > 0:
                all_cash_flows.append(CashFlowEvent(date=report_date, amount=total_nav))

            # Calculate metrics
            entity_irr = calculate_irr(all_cash_flows) if all_cash_flows else None
            if entity_irr is None:
                entity_irr = 0
            tvpi = (total_distributions + total_nav) / total_called if total_called > 0 else 0

            entity_data.append({
                'entity_name': entity.name,
                'entity_type': entity.entity_type,
                'investment_count': len(investments),
                'total_commitment': total_commitment,
                'total_called': total_called,
                'total_distributions': total_distributions,
                'current_nav': total_nav,
                'tvpi': tvpi,
                'irr': entity_irr * 100  # Convert to percentage
            })

        # Sort by NAV descending
        entity_data.sort(key=lambda x: x['current_nav'], reverse=True)

        # Generate PDF
        report_gen = EntityPerformanceReport(tenant_name=current_user.tenant.name if current_user.tenant else "Portfolio")
        pdf_buffer = report_gen.generate(
            entity_data=entity_data,
            as_of_date=report_date
        )

        # Return PDF
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=entity_performance_{report_date.strftime('%Y%m%d')}.pdf"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.get("/cash-flow-activity")
async def generate_cash_flow_activity_report(
    time_period: str = Query("ytd", description="Time period: ytd, last_quarter, last_year, last_3_years, inception, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
    cash_flow_types: str = Query("", description="Comma-separated cash flow types to include"),
    group_by: str = Query("none", description="Grouping: none, investment, entity, asset_class, month, quarter"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate Cash Flow Activity Report (PDF)

    Contains:
    - Capital calls and distributions over selected period
    - Optional grouping by investment, entity, asset class, or time period
    - Running totals and summary statistics
    - Visual charts showing cash flow trends
    """
    try:
        # Calculate date range based on time period
        end_dt = date.today()
        if time_period == "custom":
            if not start_date or not end_date:
                raise HTTPException(status_code=400, detail="Custom period requires start_date and end_date")
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        elif time_period == "ytd":
            start_dt = date(end_dt.year, 1, 1)
        elif time_period == "last_quarter":
            # Calculate last quarter
            current_quarter = (end_dt.month - 1) // 3
            if current_quarter == 0:
                start_dt = date(end_dt.year - 1, 10, 1)
                end_dt = date(end_dt.year - 1, 12, 31)
            else:
                start_month = (current_quarter - 1) * 3 + 1
                start_dt = date(end_dt.year, start_month, 1)
                end_month = current_quarter * 3
                if end_month == 12:
                    end_dt = date(end_dt.year, 12, 31)
                else:
                    end_dt = date(end_dt.year, end_month + 1, 1)
        elif time_period == "last_year":
            start_dt = date(end_dt.year - 1, 1, 1)
            end_dt = date(end_dt.year - 1, 12, 31)
        elif time_period == "last_3_years":
            start_dt = date(end_dt.year - 3, 1, 1)
        elif time_period == "inception":
            # Get earliest cash flow date
            earliest_cf = db.query(func.min(CashFlow.date)).filter(
                CashFlow.investment_id.in_(
                    db.query(InvestmentModel.id).filter(
                        InvestmentModel.tenant_id == current_user.tenant_id
                    )
                )
            ).scalar()
            start_dt = earliest_cf if earliest_cf else date(2000, 1, 1)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid time period: {time_period}")

        # Parse cash flow types filter
        cf_types_list = []
        if cash_flow_types:
            cf_types_str = [t.strip().upper().replace(' ', '_') for t in cash_flow_types.split(',')]
            # Map frontend values to backend enum values
            type_mapping = {
                'CAPITAL_CALL': CashFlowType.CAPITAL_CALL,
                'DISTRIBUTION': CashFlowType.DISTRIBUTION,
                'RETURN_OF_CAPITAL': CashFlowType.RETURN_OF_PRINCIPAL,
                'RETURN_OF_PRINCIPAL': CashFlowType.RETURN_OF_PRINCIPAL,
                'INCOME': CashFlowType.YIELD,
                'YIELD': CashFlowType.YIELD,
                'RECALLABLE_RETURN': CashFlowType.DISTRIBUTION,  # Treat as distribution
                'FEE': CashFlowType.FEES,
                'FEES': CashFlowType.FEES,
                'OTHER': CashFlowType.CONTRIBUTION
            }
            cf_types_list = [type_mapping.get(t, CashFlowType.CONTRIBUTION) for t in cf_types_str]

        # Query cash flows
        query = db.query(CashFlow, InvestmentModel).join(
            InvestmentModel, CashFlow.investment_id == InvestmentModel.id
        ).filter(
            InvestmentModel.tenant_id == current_user.tenant_id,
            CashFlow.date >= start_dt,
            CashFlow.date <= end_dt
        )

        # Apply cash flow type filter
        if cf_types_list:
            query = query.filter(CashFlow.type.in_(cf_types_list))

        cash_flows_data = query.order_by(CashFlow.date.desc()).all()

        # Process cash flows based on grouping
        cash_flows = []
        for cf, inv in cash_flows_data:
            # Get entity name
            entity_name = None
            if inv.entity_id:
                entity = db.query(EntityModel).filter(EntityModel.id == inv.entity_id).first()
                entity_name = entity.name if entity else None

            cash_flows.append({
                'date': cf.date,
                'investment_name': inv.name,
                'investment_id': inv.id,
                'entity_name': entity_name,
                'entity_id': inv.entity_id,
                'asset_class': format_asset_class(inv.asset_class) if inv.asset_class else "Other",
                'type': cf.type,
                'amount': cf.amount,
                'notes': cf.notes
            })

        # Calculate summary statistics - use type-based filtering for safety
        outflow_types = [CashFlowType.CAPITAL_CALL, CashFlowType.CONTRIBUTION, CashFlowType.FEES]
        inflow_types = [CashFlowType.DISTRIBUTION, CashFlowType.YIELD, CashFlowType.RETURN_OF_PRINCIPAL]

        total_calls = sum(abs(cf['amount']) for cf in cash_flows if cf['type'] in outflow_types)
        total_distributions = sum(abs(cf['amount']) for cf in cash_flows if cf['type'] in inflow_types)
        net_cash_flow = total_distributions - total_calls

        # Group data if requested
        grouped_data = None
        if group_by != 'none':
            grouped_data = {}

            if group_by == 'investment':
                for cf in cash_flows:
                    key = cf['investment_name']
                    if key not in grouped_data:
                        grouped_data[key] = {
                            'name': key,
                            'calls': 0,
                            'distributions': 0,
                            'net': 0,
                            'count': 0
                        }
                    if cf['type'] in outflow_types:
                        grouped_data[key]['calls'] += abs(cf['amount'])
                    elif cf['type'] in inflow_types:
                        grouped_data[key]['distributions'] += abs(cf['amount'])
                    grouped_data[key]['net'] = grouped_data[key]['distributions'] - grouped_data[key]['calls']
                    grouped_data[key]['count'] += 1

            elif group_by == 'entity':
                for cf in cash_flows:
                    key = cf['entity_name'] or 'No Entity'
                    if key not in grouped_data:
                        grouped_data[key] = {
                            'name': key,
                            'calls': 0,
                            'distributions': 0,
                            'net': 0,
                            'count': 0
                        }
                    if cf['type'] in outflow_types:
                        grouped_data[key]['calls'] += abs(cf['amount'])
                    elif cf['type'] in inflow_types:
                        grouped_data[key]['distributions'] += abs(cf['amount'])
                    grouped_data[key]['net'] = grouped_data[key]['distributions'] - grouped_data[key]['calls']
                    grouped_data[key]['count'] += 1

            elif group_by == 'asset_class':
                for cf in cash_flows:
                    key = cf['asset_class']
                    if key not in grouped_data:
                        grouped_data[key] = {
                            'name': key,
                            'calls': 0,
                            'distributions': 0,
                            'net': 0,
                            'count': 0
                        }
                    if cf['type'] in outflow_types:
                        grouped_data[key]['calls'] += abs(cf['amount'])
                    elif cf['type'] in inflow_types:
                        grouped_data[key]['distributions'] += abs(cf['amount'])
                    grouped_data[key]['net'] = grouped_data[key]['distributions'] - grouped_data[key]['calls']
                    grouped_data[key]['count'] += 1

            elif group_by in ['month', 'quarter']:
                for cf in cash_flows:
                    if group_by == 'month':
                        key = cf['date'].strftime('%Y-%m')
                    else:  # quarter
                        quarter = (cf['date'].month - 1) // 3 + 1
                        key = f"{cf['date'].year}-Q{quarter}"

                    if key not in grouped_data:
                        grouped_data[key] = {
                            'name': key,
                            'calls': 0,
                            'distributions': 0,
                            'net': 0,
                            'count': 0
                        }
                    if cf['type'] in outflow_types:
                        grouped_data[key]['calls'] += abs(cf['amount'])
                    elif cf['type'] in inflow_types:
                        grouped_data[key]['distributions'] += abs(cf['amount'])
                    grouped_data[key]['net'] = grouped_data[key]['distributions'] - grouped_data[key]['calls']
                    grouped_data[key]['count'] += 1

            # Convert to list and sort
            grouped_data = sorted(grouped_data.values(), key=lambda x: abs(x['net']), reverse=True)

        # Generate PDF
        report_gen = CashFlowActivityReport(tenant_name=current_user.tenant.name if current_user.tenant else "Portfolio")
        pdf_buffer = report_gen.generate(
            cash_flows=cash_flows,
            grouped_data=grouped_data,
            group_by=group_by,
            start_date=start_dt,
            end_date=end_dt,
            summary_stats={
                'total_calls': total_calls,
                'total_distributions': total_distributions,
                'net_cash_flow': net_cash_flow,
                'transaction_count': len(cash_flows)
            }
        )

        # Return PDF
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=cash_flow_activity_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.pdf"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error generating cash flow activity report: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Log to console
        raise HTTPException(status_code=500, detail=error_detail)
