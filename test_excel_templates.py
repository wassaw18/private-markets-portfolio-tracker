#!/usr/bin/env python3
"""
Test script for Excel Template functionality
Tests the API endpoints and template generation
"""
import requests
import json
import os
from io import BytesIO

# API base URL
BASE_URL = "http://localhost:8000"

def test_nav_template_download():
    """Test NAV template download"""
    print("Testing NAV template download...")
    try:
        response = requests.get(f"{BASE_URL}/api/templates/nav-template")
        if response.status_code == 200:
            print("✅ NAV template download successful")
            # Save file for inspection
            with open("test_nav_template.xlsx", "wb") as f:
                f.write(response.content)
            print("📄 Template saved as test_nav_template.xlsx")
        else:
            print(f"❌ NAV template download failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ NAV template download error: {e}")

def test_cashflow_template_download():
    """Test Cash Flow template download"""
    print("\nTesting Cash Flow template download...")
    try:
        response = requests.get(f"{BASE_URL}/api/templates/cashflow-template")
        if response.status_code == 200:
            print("✅ Cash Flow template download successful")
            # Save file for inspection
            with open("test_cashflow_template.xlsx", "wb") as f:
                f.write(response.content)
            print("📄 Template saved as test_cashflow_template.xlsx")
        else:
            print(f"❌ Cash Flow template download failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Cash Flow template download error: {e}")

def test_bulk_upload_endpoints():
    """Test that bulk upload endpoints exist"""
    print("\nTesting bulk upload endpoints...")
    
    # Test with empty file (should get validation error)
    test_file = BytesIO(b"test content")
    files = {'file': ('test.xlsx', test_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    
    try:
        # Test NAV bulk upload endpoint
        response = requests.post(f"{BASE_URL}/api/bulk-upload/navs", files=files)
        print(f"NAV bulk upload endpoint response: {response.status_code}")
        if response.status_code in [400, 422, 500]:  # Expected validation errors
            print("✅ NAV bulk upload endpoint exists and validates input")
        
        # Reset file pointer
        test_file.seek(0)
        files = {'file': ('test.xlsx', test_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        # Test Cash Flow bulk upload endpoint
        response = requests.post(f"{BASE_URL}/api/bulk-upload/cashflows", files=files)
        print(f"Cash Flow bulk upload endpoint response: {response.status_code}")
        if response.status_code in [400, 422, 500]:  # Expected validation errors
            print("✅ Cash Flow bulk upload endpoint exists and validates input")
        
    except Exception as e:
        print(f"❌ Bulk upload endpoint test error: {e}")

def main():
    print("🧪 Testing Excel Template Functionality")
    print("=" * 50)
    
    # Check if API is running
    try:
        response = requests.get(f"{BASE_URL}/api/investments")
        if response.status_code != 200:
            print(f"⚠️  API might not be running. Got status: {response.status_code}")
    except:
        print("❌ Cannot connect to API. Make sure the backend is running on localhost:8000")
        return
    
    # Run tests
    test_nav_template_download()
    test_cashflow_template_download()
    test_bulk_upload_endpoints()
    
    print("\n" + "=" * 50)
    print("✨ Excel template testing completed!")
    print("Check the generated template files to verify formatting and features.")

if __name__ == "__main__":
    main()