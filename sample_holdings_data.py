#!/usr/bin/env python3
"""
Create sample Excel files for testing Private Markets Portfolio Tracker
"""

import pandas as pd
from datetime import datetime, date
from io import BytesIO
import os

def create_sample_holdings():
    """Create sample investment holdings data"""
    holdings_data = [
        {
            'name': 'Acme Venture Fund III',
            'asset_class': 'VENTURE_CAPITAL',
            'investment_structure': 'LIMITED_PARTNERSHIP',
            'owner': 'Smith Family Trust',
            'strategy': 'Early Stage Technology',
            'vintage_year': 2022,
            'commitment_amount': 5000000,
            'called_amount': 2500000,
            'fees': 125000,
            'first_close_date': '2022-03-15',
            'final_close_date': '2022-09-30',
            'fund_term_years': 10,
            'investment_period_years': 5,
            'fund_size': 250000000,
            'liquidity_profile': 'ILLIQUID',
            'geography': 'North America',
            'sector': 'Technology',
            'notes': 'Top-tier VC fund focused on AI and enterprise software'
        },
        {
            'name': 'Global Private Equity Partners',
            'asset_class': 'PRIVATE_EQUITY',
            'investment_structure': 'LIMITED_PARTNERSHIP',
            'owner': 'Johnson LLC',
            'strategy': 'Mid-Market Buyout',
            'vintage_year': 2021,
            'commitment_amount': 10000000,
            'called_amount': 7500000,
            'fees': 375000,
            'first_close_date': '2021-06-01',
            'final_close_date': '2021-12-15',
            'fund_term_years': 10,
            'investment_period_years': 5,
            'fund_size': 1500000000,
            'liquidity_profile': 'ILLIQUID',
            'geography': 'Global',
            'sector': 'Healthcare',
            'notes': 'Established PE firm with strong healthcare expertise'
        },
        {
            'name': 'Prime Real Estate Fund IV',
            'asset_class': 'REAL_ESTATE',
            'investment_structure': 'LIMITED_PARTNERSHIP',
            'owner': 'Wilson Trust',
            'strategy': 'Core-Plus Real Estate',
            'vintage_year': 2023,
            'commitment_amount': 3000000,
            'called_amount': 1200000,
            'fees': 60000,
            'first_close_date': '2023-01-20',
            'final_close_date': '2023-07-31',
            'fund_term_years': 8,
            'investment_period_years': 4,
            'fund_size': 800000000,
            'liquidity_profile': 'SEMI_LIQUID',
            'geography': 'United States',
            'sector': 'Real Estate',
            'notes': 'Focus on office and industrial properties in major metros'
        },
        {
            'name': 'Credit Opportunities Fund II',
            'asset_class': 'PRIVATE_CREDIT',
            'investment_structure': 'LIMITED_PARTNERSHIP',
            'owner': 'Davis Family Office',
            'strategy': 'Direct Lending',
            'vintage_year': 2022,
            'commitment_amount': 7500000,
            'called_amount': 5250000,
            'fees': 262500,
            'first_close_date': '2022-05-10',
            'final_close_date': '2022-11-30',
            'fund_term_years': 7,
            'investment_period_years': 4,
            'fund_size': 1200000000,
            'liquidity_profile': 'SEMI_LIQUID',
            'geography': 'North America',
            'sector': 'Financial Services',
            'notes': 'Senior secured lending to middle market companies'
        },
        {
            'name': 'Emerging Markets Infrastructure',
            'asset_class': 'REAL_ASSETS',
            'investment_structure': 'LIMITED_PARTNERSHIP',
            'owner': 'Brown Corporation',
            'strategy': 'Infrastructure Development',
            'vintage_year': 2021,
            'commitment_amount': 8000000,
            'called_amount': 6400000,
            'fees': 320000,
            'first_close_date': '2021-08-15',
            'final_close_date': '2022-02-28',
            'fund_term_years': 12,
            'investment_period_years': 6,
            'fund_size': 2000000000,
            'liquidity_profile': 'ILLIQUID',
            'geography': 'Asia Pacific',
            'sector': 'Infrastructure',
            'notes': 'Focus on renewable energy and transportation infrastructure'
        }
    ]
    
    df = pd.DataFrame(holdings_data)
    
    # Create Excel file with proper formatting
    output_path = '/home/will/Tmux-Orchestrator/private-markets-tracker/sample_holdings_data.xlsx'
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Holdings Data', index=False)
        
        # Auto-adjust column widths
        worksheet = writer.sheets['Holdings Data']
        for column in worksheet.columns:
            max_length = 0
            column_name = column[0].column_letter
            
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
                    
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_name].width = adjusted_width
    
    print(f"✅ Sample holdings file created: {output_path}")
    return output_path

def create_sample_cash_flows():
    """Create sample cash flow data"""
    cash_flows_data = [
        {
            'investment_name': 'Acme Venture Fund III',
            'date': '2022-04-15',
            'amount': -1000000,
            'type': 'CAPITAL_CALL',
            'notes': 'Initial capital call for fund deployment'
        },
        {
            'investment_name': 'Acme Venture Fund III',
            'date': '2022-08-20',
            'amount': -750000,
            'type': 'CAPITAL_CALL',
            'notes': 'Second capital call'
        },
        {
            'investment_name': 'Acme Venture Fund III',
            'date': '2023-12-15',
            'amount': 250000,
            'type': 'DISTRIBUTION',
            'notes': 'Distribution from portfolio company exit'
        },
        {
            'investment_name': 'Global Private Equity Partners',
            'date': '2021-07-01',
            'amount': -2500000,
            'type': 'CAPITAL_CALL',
            'notes': 'Initial funding'
        },
        {
            'investment_name': 'Global Private Equity Partners',
            'date': '2021-10-15',
            'amount': -2000000,
            'type': 'CAPITAL_CALL',
            'notes': 'Follow-on capital call'
        },
        {
            'investment_name': 'Global Private Equity Partners',
            'date': '2022-06-30',
            'amount': -1500000,
            'type': 'CAPITAL_CALL',
            'notes': 'Additional capital call'
        },
        {
            'investment_name': 'Global Private Equity Partners',
            'date': '2023-03-15',
            'amount': 1800000,
            'type': 'DISTRIBUTION',
            'notes': 'Partial distribution from portfolio company sale'
        },
        {
            'investment_name': 'Prime Real Estate Fund IV',
            'date': '2023-02-10',
            'amount': -600000,
            'type': 'CAPITAL_CALL',
            'notes': 'Initial capital call'
        },
        {
            'investment_name': 'Prime Real Estate Fund IV',
            'date': '2023-06-30',
            'amount': -600000,
            'type': 'CAPITAL_CALL',
            'notes': 'Second quarterly call'
        },
        {
            'investment_name': 'Credit Opportunities Fund II',
            'date': '2022-06-15',
            'amount': -1750000,
            'type': 'CAPITAL_CALL',
            'notes': 'Initial funding for direct lending'
        },
        {
            'investment_name': 'Credit Opportunities Fund II',
            'date': '2022-12-20',
            'amount': -1750000,
            'type': 'CAPITAL_CALL',
            'notes': 'Additional capital call'
        },
        {
            'investment_name': 'Credit Opportunities Fund II',
            'date': '2023-03-31',
            'amount': 175000,
            'type': 'DISTRIBUTION',
            'notes': 'Quarterly interest distribution'
        },
        {
            'investment_name': 'Credit Opportunities Fund II',
            'date': '2023-06-30',
            'amount': 180000,
            'type': 'DISTRIBUTION',
            'notes': 'Q2 interest distribution'
        },
        {
            'investment_name': 'Credit Opportunities Fund II',
            'date': '2023-09-30',
            'amount': 185000,
            'type': 'DISTRIBUTION',
            'notes': 'Q3 interest distribution'
        },
        {
            'investment_name': 'Emerging Markets Infrastructure',
            'date': '2021-09-01',
            'amount': -2000000,
            'type': 'CAPITAL_CALL',
            'notes': 'Initial capital commitment'
        },
        {
            'investment_name': 'Emerging Markets Infrastructure',
            'date': '2022-01-15',
            'amount': -1600000,
            'type': 'CAPITAL_CALL',
            'notes': 'Deployment for renewable energy projects'
        },
        {
            'investment_name': 'Emerging Markets Infrastructure',
            'date': '2022-07-30',
            'amount': -1600000,
            'type': 'CAPITAL_CALL',
            'notes': 'Transportation infrastructure investment'
        },
        {
            'investment_name': 'Emerging Markets Infrastructure',
            'date': '2023-04-15',
            'amount': -1200000,
            'type': 'CAPITAL_CALL',
            'notes': 'Final deployment phase'
        }
    ]
    
    df = pd.DataFrame(cash_flows_data)
    
    # Create Excel file
    output_path = '/home/will/Tmux-Orchestrator/private-markets-tracker/sample_cashflows_data.xlsx'
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Cash Flow Data', index=False)
        
        # Auto-adjust column widths
        worksheet = writer.sheets['Cash Flow Data']
        for column in worksheet.columns:
            max_length = 0
            column_name = column[0].column_letter
            
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
                    
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_name].width = adjusted_width
    
    print(f"✅ Sample cash flows file created: {output_path}")
    return output_path

if __name__ == "__main__":
    print("Creating sample data files for testing...")
    holdings_file = create_sample_holdings()
    cashflows_file = create_sample_cash_flows()
    print(f"\n📁 Files created:")
    print(f"   Holdings: {holdings_file}")
    print(f"   Cash Flows: {cashflows_file}")
    print("\nYou can upload these files to quickly populate test data!")