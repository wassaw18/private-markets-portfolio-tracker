"""
PDF Report Generation Service

Provides professional PDF report generation for portfolio analytics.
Uses ReportLab for high-quality output with consistent branding.
"""

from io import BytesIO
from datetime import date, datetime
from typing import List, Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# Professional color scheme
BRAND_PRIMARY = colors.HexColor('#1a1a2e')
BRAND_SECONDARY = colors.HexColor('#16213e')
BRAND_ACCENT = colors.HexColor('#0f3460')
HEADER_GRAY = colors.HexColor('#e8e8e8')
TABLE_HEADER = colors.HexColor('#2c3e50')
TABLE_ALT_ROW = colors.HexColor('#f8f9fa')


class ReportGenerator:
    """Base class for generating professional PDF reports"""

    def __init__(self, tenant_name: str = "Private Markets Portfolio"):
        self.tenant_name = tenant_name
        self.buffer = BytesIO()
        self.page_size = letter
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Set up custom paragraph styles"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=BRAND_PRIMARY,
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))

        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='ReportSubtitle',
            parent=self.styles['Normal'],
            fontSize=12,
            textColor=BRAND_SECONDARY,
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName='Helvetica'
        ))

        # Section heading
        self.styles.add(ParagraphStyle(
            name='SectionHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=BRAND_PRIMARY,
            spaceBefore=20,
            spaceAfter=12,
            fontName='Helvetica-Bold'
        ))

        # Table header style
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.white,
            fontName='Helvetica-Bold'
        ))

    def _create_header(self, title: str, subtitle: str, as_of_date: date) -> List:
        """Create report header"""
        elements = []

        # Title
        elements.append(Paragraph(title, self.styles['ReportTitle']))

        # Subtitle with tenant name
        elements.append(Paragraph(f"{self.tenant_name}", self.styles['ReportSubtitle']))
        elements.append(Paragraph(subtitle, self.styles['ReportSubtitle']))

        # As of date
        date_str = f"As of {as_of_date.strftime('%B %d, %Y')}"
        elements.append(Paragraph(date_str, self.styles['ReportSubtitle']))

        elements.append(Spacer(1, 0.3 * inch))
        elements.append(HRFlowable(width="100%", thickness=2, color=BRAND_ACCENT))
        elements.append(Spacer(1, 0.2 * inch))

        return elements

    def _create_footer(self, canvas, doc):
        """Create footer with page numbers"""
        canvas.saveState()
        page_num = canvas.getPageNumber()
        text = f"Page {page_num}"
        canvas.setFont('Helvetica', 9)
        canvas.setFillColor(colors.gray)
        canvas.drawRightString(7.5 * inch, 0.5 * inch, text)
        canvas.drawString(1 * inch, 0.5 * inch, f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}")
        canvas.restoreState()

    def _format_currency(self, value: float) -> str:
        """Format currency values"""
        if value is None:
            return "$0"
        return f"${value:,.0f}"

    def _format_percentage(self, value: float) -> str:
        """Format percentage values"""
        if value is None:
            return "0.0%"
        return f"{value:.1f}%"

    def _format_multiple(self, value: float) -> str:
        """Format multiple values (TVPI, DPI, etc.)"""
        if value is None:
            return "0.00x"
        return f"{value:.2f}x"

    def _create_summary_table(self, data: List[tuple], col_widths: List[float] = None) -> Table:
        """Create a styled summary table"""
        if col_widths is None:
            col_widths = [3 * inch, 2 * inch]

        table = Table(data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), HEADER_GRAY),
            ('TEXTCOLOR', (0, 0), (-1, -1), BRAND_PRIMARY),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ]))
        return table

    def _create_data_table(self, headers: List[str], data: List[List[str]], col_widths: List[float] = None) -> Table:
        """Create a styled data table with headers"""
        # Combine headers and data
        table_data = [headers] + data

        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),

            # Data rows styling
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 6),

            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ALT_ROW]),

            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        return table

    def build_pdf(self, elements: List) -> BytesIO:
        """Build the PDF document"""
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=self.page_size,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch
        )

        doc.build(elements, onFirstPage=self._create_footer, onLaterPages=self._create_footer)
        self.buffer.seek(0)
        return self.buffer


class PortfolioSummaryReport(ReportGenerator):
    """Portfolio Summary Report Generator"""

    def generate(
        self,
        summary_stats: Dict[str, Any],
        asset_allocation: List[Dict[str, Any]],
        vintage_analysis: List[Dict[str, Any]],
        as_of_date: date = None
    ) -> BytesIO:
        """Generate portfolio summary report"""
        if as_of_date is None:
            as_of_date = date.today()

        elements = []

        # Header
        elements.extend(self._create_header(
            "Portfolio Summary Report",
            "Comprehensive Portfolio Performance Overview",
            as_of_date
        ))

        # Key Metrics Section
        elements.append(Paragraph("Portfolio Overview", self.styles['SectionHeading']))

        overview_data = [
            ("Total NAV", self._format_currency(summary_stats.get('total_nav', 0))),
            ("Total Commitments", self._format_currency(summary_stats.get('total_commitments', 0))),
            ("Called Capital", self._format_currency(summary_stats.get('total_called', 0))),
            ("Uncalled Commitments", self._format_currency(summary_stats.get('uncalled_commitments', 0))),
            ("Lifetime Distributions", self._format_currency(summary_stats.get('total_distributions', 0))),
        ]
        elements.append(self._create_summary_table(overview_data))
        elements.append(Spacer(1, 0.3 * inch))

        # Performance Metrics
        elements.append(Paragraph("Performance Metrics", self.styles['SectionHeading']))

        performance_data = [
            ("IRR", self._format_percentage(summary_stats.get('irr', 0))),
            ("TVPI (Total Value to Paid-In)", self._format_multiple(summary_stats.get('tvpi', 0))),
            ("DPI (Distributions to Paid-In)", self._format_multiple(summary_stats.get('dpi', 0))),
            ("RVPI (Residual Value to Paid-In)", self._format_multiple(summary_stats.get('rvpi', 0))),
        ]
        elements.append(self._create_summary_table(performance_data))
        elements.append(Spacer(1, 0.3 * inch))

        # Investment Status
        elements.append(Paragraph("Investment Status", self.styles['SectionHeading']))

        status_data = [
            ("Active Investments", str(summary_stats.get('active_count', 0))),
            ("Realized Investments", str(summary_stats.get('realized_count', 0))),
            ("Total Investments", str(summary_stats.get('total_count', 0))),
        ]
        elements.append(self._create_summary_table(status_data))

        # Asset Allocation (if data provided)
        if asset_allocation:
            elements.append(Spacer(1, 0.4 * inch))
            elements.append(Paragraph("Asset Allocation", self.styles['SectionHeading']))

            headers = ["Asset Class", "Count", "Commitment", "Current NAV", "% of NAV"]
            rows = []
            for item in asset_allocation:
                rows.append([
                    item.get('asset_class', 'Unknown'),
                    str(item.get('count', 0)),
                    self._format_currency(item.get('total_commitment', 0)),
                    self._format_currency(item.get('current_nav', 0)),
                    self._format_percentage(item.get('percentage', 0))
                ])

            col_widths = [2 * inch, 0.8 * inch, 1.3 * inch, 1.3 * inch, 1 * inch]
            elements.append(self._create_data_table(headers, rows, col_widths))

        # Vintage Year Analysis (if data provided)
        if vintage_analysis:
            elements.append(Spacer(1, 0.4 * inch))
            elements.append(Paragraph("Vintage Year Analysis", self.styles['SectionHeading']))

            headers = ["Vintage", "Count", "Commitment", "Current NAV", "TVPI"]
            rows = []
            for item in vintage_analysis:
                rows.append([
                    str(item.get('vintage_year', 'Unknown')),
                    str(item.get('count', 0)),
                    self._format_currency(item.get('total_commitment', 0)),
                    self._format_currency(item.get('current_nav', 0)),
                    self._format_multiple(item.get('tvpi', 0))
                ])

            col_widths = [1.2 * inch, 0.8 * inch, 1.5 * inch, 1.5 * inch, 1 * inch]
            elements.append(self._create_data_table(headers, rows, col_widths))

        return self.build_pdf(elements)


class HoldingsReport(ReportGenerator):
    """Holdings Report Generator"""

    def generate(
        self,
        holdings: List[Dict[str, Any]],
        grouped_by: str = "entity",
        as_of_date: date = None
    ) -> BytesIO:
        """Generate holdings report"""
        if as_of_date is None:
            as_of_date = date.today()

        elements = []

        # Header
        subtitle = f"Current Active Positions Grouped by {grouped_by.title()}"
        elements.extend(self._create_header(
            "Holdings Report",
            subtitle,
            as_of_date
        ))

        # Holdings table
        elements.append(Paragraph("Investment Holdings", self.styles['SectionHeading']))

        headers = [
            "Investment",
            "Entity",
            "Asset Class",
            "Commitment",
            "Called",
            "Fees",
            "Uncalled",
            "Current NAV",
            "TVPI"
        ]

        rows = []
        for holding in holdings:
            rows.append([
                holding.get('investment_name', 'Unknown')[:25],  # Truncate long names
                holding.get('entity_name', 'N/A')[:15],
                holding.get('asset_class', 'Unknown')[:15],
                self._format_currency(holding.get('commitment_amount', 0)),
                self._format_currency(holding.get('called_amount', 0)),
                self._format_currency(holding.get('fees', 0)),
                self._format_currency(holding.get('uncalled_amount', 0)),
                self._format_currency(holding.get('current_nav', 0)),
                self._format_multiple(holding.get('tvpi', 0))
            ])

        col_widths = [1.4 * inch, 0.9 * inch, 0.8 * inch, 0.8 * inch, 0.7 * inch, 0.5 * inch, 0.7 * inch, 0.8 * inch, 0.5 * inch]
        elements.append(self._create_data_table(headers, rows, col_widths))

        # Summary totals
        elements.append(Spacer(1, 0.3 * inch))
        total_commitment = sum(h.get('commitment_amount', 0) for h in holdings)
        total_called = sum(h.get('called_amount', 0) for h in holdings)
        total_fees = sum(h.get('fees', 0) for h in holdings)
        total_nav = sum(h.get('current_nav', 0) for h in holdings)

        summary_data = [
            ("Total Commitment", self._format_currency(total_commitment)),
            ("Total Called", self._format_currency(total_called)),
            ("Total Fees", self._format_currency(total_fees)),
            ("Total NAV", self._format_currency(total_nav)),
            ("Total Investments", str(len(holdings))),
        ]
        elements.append(self._create_summary_table(summary_data))

        return self.build_pdf(elements)


class EntityPerformanceReport(ReportGenerator):
    """Entity-Level Performance Report Generator"""

    def generate(
        self,
        entity_data: List[Dict[str, Any]],
        as_of_date: date = None
    ) -> BytesIO:
        """Generate entity-level performance report"""
        if as_of_date is None:
            as_of_date = date.today()

        elements = []

        # Header
        elements.extend(self._create_header(
            "Entity-Level Performance Report",
            "Performance Metrics by Entity",
            as_of_date
        ))

        # Entity performance table
        elements.append(Paragraph("Entity Performance Summary", self.styles['SectionHeading']))

        headers = [
            "Entity",
            "Investments",
            "Commitment",
            "Called",
            "Distributions",
            "Current NAV",
            "TVPI",
            "IRR"
        ]

        rows = []
        for entity in entity_data:
            rows.append([
                entity.get('entity_name', 'Unknown')[:20],
                str(entity.get('investment_count', 0)),
                self._format_currency(entity.get('total_commitment', 0)),
                self._format_currency(entity.get('total_called', 0)),
                self._format_currency(entity.get('total_distributions', 0)),
                self._format_currency(entity.get('current_nav', 0)),
                self._format_multiple(entity.get('tvpi', 0)),
                self._format_percentage(entity.get('irr', 0))
            ])

        col_widths = [1.3 * inch, 0.7 * inch, 1 * inch, 0.9 * inch, 1 * inch, 1 * inch, 0.6 * inch, 0.6 * inch]
        elements.append(self._create_data_table(headers, rows, col_widths))

        # Portfolio totals
        elements.append(Spacer(1, 0.3 * inch))
        elements.append(Paragraph("Portfolio Totals", self.styles['SectionHeading']))

        total_commitment = sum(e.get('total_commitment', 0) for e in entity_data)
        total_called = sum(e.get('total_called', 0) for e in entity_data)
        total_distributions = sum(e.get('total_distributions', 0) for e in entity_data)
        total_nav = sum(e.get('current_nav', 0) for e in entity_data)

        summary_data = [
            ("Total Entities", str(len(entity_data))),
            ("Total Commitment", self._format_currency(total_commitment)),
            ("Total Called", self._format_currency(total_called)),
            ("Total Distributions", self._format_currency(total_distributions)),
            ("Total NAV", self._format_currency(total_nav)),
        ]
        elements.append(self._create_summary_table(summary_data))

        return self.build_pdf(elements)


class CashFlowActivityReport(ReportGenerator):
    """Cash Flow Activity Report generator"""

    def generate(self, cash_flows: List[Dict], grouped_data: Optional[List[Dict]], group_by: str,
                 start_date: date, end_date: date, summary_stats: Dict) -> BytesIO:
        """Generate Cash Flow Activity Report PDF"""
        elements = []

        # Create header
        title = "Cash Flow Activity Report"
        date_range = f"{start_date.strftime('%B %d, %Y')} - {end_date.strftime('%B %d, %Y')}"
        subtitle = date_range
        elements.extend(self._create_header(title, subtitle, end_date))

        # Summary statistics
        elements.append(Paragraph("Summary", self.styles['SectionHeading']))

        summary_data = [
            ("Total Capital Calls", self._format_currency(summary_stats['total_calls'])),
            ("Total Distributions", self._format_currency(summary_stats['total_distributions'])),
            ("Net Cash Flow", self._format_currency(summary_stats['net_cash_flow'])),
            ("Number of Transactions", str(summary_stats['transaction_count'])),
        ]
        elements.append(self._create_summary_table(summary_data))
        elements.append(Spacer(1, 0.3 * inch))

        # Grouped data (if applicable)
        if grouped_data and group_by != 'none':
            elements.append(Paragraph(f"Cash Flows by {self._format_group_by(group_by)}", self.styles['SectionHeading']))

            # Create grouped table
            group_table_data = [["Name", "Capital Calls", "Distributions", "Net Cash Flow", "Count"]]
            for item in grouped_data[:50]:  # Limit to top 50 for readability
                group_table_data.append([
                    item['name'],
                    self._format_currency(item['calls']),
                    self._format_currency(item['distributions']),
                    self._format_currency(item['net']),
                    str(item['count'])
                ])

            group_table = Table(group_table_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1.5*inch, 0.75*inch])
            group_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TOPPADDING', (0, 0), (-1, 0), 12),

                # Data rows styling
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),

                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ALT_ROW]),

                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(group_table)
            elements.append(Spacer(1, 0.3 * inch))

        # Detailed transaction listing (if no grouping or as supplement)
        if group_by == 'none' or len(cash_flows) <= 100:
            elements.append(Paragraph("Transaction Details", self.styles['SectionHeading']))

            # Create detailed table
            detail_table_data = [["Date", "Investment", "Type", "Amount", "Balance"]]

            running_balance = 0
            # Show transactions in chronological order for running balance
            sorted_flows = sorted(cash_flows, key=lambda x: x['date'])

            # Limit to most recent 100 transactions for PDF size
            display_flows = sorted_flows[-100:] if len(sorted_flows) > 100 else sorted_flows

            for cf in display_flows:
                amount = cf['amount']
                running_balance += amount

                # Format amount based on type
                cf_type_str = str(cf['type'])
                is_capital_call = 'CAPITAL_CALL' in cf_type_str.upper() or 'Capital Call' in cf_type_str
                amount_display = self._format_currency(abs(amount))
                if is_capital_call and amount < 0:
                    amount_display += ' (call)'

                detail_table_data.append([
                    cf['date'].strftime('%Y-%m-%d'),
                    cf['investment_name'][:30] + '...' if len(cf['investment_name']) > 30 else cf['investment_name'],
                    self._format_cf_type(cf['type']),
                    amount_display,
                    self._format_currency(running_balance)
                ])

            detail_table = Table(detail_table_data, colWidths=[0.9*inch, 2.5*inch, 1.3*inch, 1.5*inch, 1.3*inch])
            detail_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),

                # Data rows styling
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
                ('ALIGN', (0, 1), (1, -1), 'LEFT'),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),

                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_ALT_ROW]),

                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(detail_table)

            if len(cash_flows) > 100:
                elements.append(Spacer(1, 0.2 * inch))
                elements.append(Paragraph(
                    f"<i>Note: Showing most recent 100 of {len(cash_flows)} transactions</i>",
                    self.styles['Normal']
                ))

        return self.build_pdf(elements)

    def _format_group_by(self, group_by: str) -> str:
        """Format group_by value for display"""
        mapping = {
            'investment': 'Investment',
            'entity': 'Entity',
            'asset_class': 'Asset Class',
            'month': 'Month',
            'quarter': 'Quarter',
            'none': 'None'
        }
        return mapping.get(group_by, group_by.title())

    def _format_cf_type(self, cf_type: str) -> str:
        """Format cash flow type for display"""
        # cf_type comes as enum value like "Capital Call"
        return str(cf_type)
