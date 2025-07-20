#!/usr/bin/env python3
"""
Backend API Testing for AquaRoute - Waterlogging Report System
Tests all backend endpoints and functionality as specified in requirements.
"""

import requests
import json
import time
from datetime import datetime, timedelta
import sys

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading backend URL: {e}")
        return None

BASE_URL = get_backend_url()
if not BASE_URL:
    print("ERROR: Could not get backend URL from frontend/.env")
    sys.exit(1)

API_URL = f"{BASE_URL}/api"
print(f"Testing backend at: {API_URL}")

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def pass_test(self, test_name):
        self.passed += 1
        print(f"✅ PASS: {test_name}")
    
    def fail_test(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ FAIL: {test_name} - {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")
        return self.failed == 0

def test_api_root():
    """Test GET /api/ endpoint"""
    results = TestResults()
    
    try:
        response = requests.get(f"{API_URL}/", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "AquaRoute" in data["message"]:
                results.pass_test("GET /api/ returns AquaRoute welcome message")
            else:
                results.fail_test("GET /api/ message content", f"Expected AquaRoute message, got: {data}")
        else:
            results.fail_test("GET /api/ status code", f"Expected 200, got {response.status_code}")
            
    except Exception as e:
        results.fail_test("GET /api/ connection", str(e))
    
    return results

def test_get_reports_empty():
    """Test GET /api/reports when no reports exist"""
    results = TestResults()
    
    try:
        response = requests.get(f"{API_URL}/reports", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                results.pass_test("GET /api/reports returns list format")
            else:
                results.fail_test("GET /api/reports format", f"Expected list, got: {type(data)}")
        else:
            results.fail_test("GET /api/reports status code", f"Expected 200, got {response.status_code}")
            
    except Exception as e:
        results.fail_test("GET /api/reports connection", str(e))
    
    return results

def test_create_report_valid():
    """Test POST /api/reports with valid data"""
    results = TestResults()
    
    # Test data with Indian coordinates (Mumbai area)
    test_data = {
        "lat": 19.0760,
        "lng": 72.8777,
        "severity": "Medium"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/reports", 
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["id", "lat", "lng", "severity", "created_at", "expires_at"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                results.pass_test("POST /api/reports creates report with all required fields")
                
                # Verify data integrity
                if data["lat"] == test_data["lat"] and data["lng"] == test_data["lng"]:
                    results.pass_test("POST /api/reports preserves lat/lng coordinates")
                else:
                    results.fail_test("POST /api/reports data integrity", "Coordinates don't match input")
                
                if data["severity"] == test_data["severity"]:
                    results.pass_test("POST /api/reports preserves severity level")
                else:
                    results.fail_test("POST /api/reports severity", f"Expected {test_data['severity']}, got {data['severity']}")
                
                # Check timestamps
                try:
                    created_at = datetime.fromisoformat(data["created_at"].replace('Z', '+00:00'))
                    expires_at = datetime.fromisoformat(data["expires_at"].replace('Z', '+00:00'))
                    
                    time_diff = expires_at - created_at
                    if abs(time_diff.total_seconds() - 86400) < 60:  # 24 hours ± 1 minute
                        results.pass_test("POST /api/reports sets 24-hour expiry")
                    else:
                        results.fail_test("POST /api/reports expiry time", f"Expected ~24 hours, got {time_diff}")
                        
                except Exception as e:
                    results.fail_test("POST /api/reports timestamp parsing", str(e))
                
                return results, data  # Return created report for further testing
                
            else:
                results.fail_test("POST /api/reports missing fields", f"Missing: {missing_fields}")
                
        else:
            results.fail_test("POST /api/reports status code", f"Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        results.fail_test("POST /api/reports connection", str(e))
    
    return results, None

def test_severity_levels():
    """Test POST /api/reports with different severity levels"""
    results = TestResults()
    
    valid_severities = ["Low", "Medium", "Severe"]
    
    for severity in valid_severities:
        test_data = {
            "lat": 20.5937,
            "lng": 78.9629,
            "severity": severity
        }
        
        try:
            response = requests.post(
                f"{API_URL}/reports", 
                json=test_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data["severity"] == severity:
                    results.pass_test(f"POST /api/reports accepts severity '{severity}'")
                else:
                    results.fail_test(f"POST /api/reports severity '{severity}'", f"Got {data['severity']}")
            else:
                results.fail_test(f"POST /api/reports severity '{severity}' status", f"Got {response.status_code}")
                
        except Exception as e:
            results.fail_test(f"POST /api/reports severity '{severity}' connection", str(e))
    
    return results

def test_invalid_severity():
    """Test POST /api/reports with invalid severity level"""
    results = TestResults()
    
    test_data = {
        "lat": 20.5937,
        "lng": 78.9629,
        "severity": "Invalid"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/reports", 
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            results.pass_test("POST /api/reports rejects invalid severity with 400 error")
        else:
            results.fail_test("POST /api/reports invalid severity", f"Expected 400, got {response.status_code}")
            
    except Exception as e:
        results.fail_test("POST /api/reports invalid severity connection", str(e))
    
    return results

def test_missing_required_fields():
    """Test POST /api/reports with missing required fields"""
    results = TestResults()
    
    # Test missing lat
    test_data = {"lng": 78.9629, "severity": "Medium"}
    
    try:
        response = requests.post(
            f"{API_URL}/reports", 
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 422:  # FastAPI validation error
            results.pass_test("POST /api/reports rejects missing lat field")
        else:
            results.fail_test("POST /api/reports missing lat", f"Expected 422, got {response.status_code}")
            
    except Exception as e:
        results.fail_test("POST /api/reports missing lat connection", str(e))
    
    # Test missing lng
    test_data = {"lat": 20.5937, "severity": "Medium"}
    
    try:
        response = requests.post(
            f"{API_URL}/reports", 
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 422:  # FastAPI validation error
            results.pass_test("POST /api/reports rejects missing lng field")
        else:
            results.fail_test("POST /api/reports missing lng", f"Expected 422, got {response.status_code}")
            
    except Exception as e:
        results.fail_test("POST /api/reports missing lng connection", str(e))
    
    return results

def test_data_persistence():
    """Test that created reports appear in GET /api/reports"""
    results = TestResults()
    
    # Create a report
    test_data = {
        "lat": 18.5204,
        "lng": 73.8567,
        "severity": "Severe"
    }
    
    try:
        # Create report
        create_response = requests.post(
            f"{API_URL}/reports", 
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if create_response.status_code == 200:
            created_report = create_response.json()
            report_id = created_report["id"]
            
            # Fetch all reports
            get_response = requests.get(f"{API_URL}/reports", timeout=10)
            
            if get_response.status_code == 200:
                reports = get_response.json()
                
                # Find our report
                found_report = None
                for report in reports:
                    if report["id"] == report_id:
                        found_report = report
                        break
                
                if found_report:
                    results.pass_test("Created report appears in GET /api/reports")
                    
                    # Verify data integrity
                    if (found_report["lat"] == test_data["lat"] and 
                        found_report["lng"] == test_data["lng"] and
                        found_report["severity"] == test_data["severity"]):
                        results.pass_test("Report data integrity maintained in database")
                    else:
                        results.fail_test("Report data integrity", "Data doesn't match between create and fetch")
                else:
                    results.fail_test("Data persistence", f"Created report with ID {report_id} not found in GET response")
            else:
                results.fail_test("Data persistence GET", f"GET /api/reports failed with {get_response.status_code}")
        else:
            results.fail_test("Data persistence CREATE", f"POST /api/reports failed with {create_response.status_code}")
            
    except Exception as e:
        results.fail_test("Data persistence connection", str(e))
    
    return results

def test_malformed_json():
    """Test POST /api/reports with malformed JSON"""
    results = TestResults()
    
    try:
        response = requests.post(
            f"{API_URL}/reports", 
            data="invalid json",
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 422:  # FastAPI validation error
            results.pass_test("POST /api/reports rejects malformed JSON")
        else:
            results.fail_test("POST /api/reports malformed JSON", f"Expected 422, got {response.status_code}")
            
    except Exception as e:
        results.fail_test("POST /api/reports malformed JSON connection", str(e))
    
    return results

def test_comments_system():
    """Test Comments System - GET and POST /api/reports/{report_id}/comments"""
    results = TestResults()
    
    # First create a report to comment on
    test_report = {
        "lat": 19.0760,
        "lng": 72.8777,
        "severity": "Medium"
    }
    
    try:
        # Create report
        create_response = requests.post(
            f"{API_URL}/reports", 
            json=test_report,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if create_response.status_code != 200:
            results.fail_test("Comments test setup", f"Failed to create test report: {create_response.status_code}")
            return results
            
        report_id = create_response.json()["id"]
        
        # Test 1: GET comments for report (should be empty initially)
        get_response = requests.get(f"{API_URL}/reports/{report_id}/comments", timeout=10)
        
        if get_response.status_code == 200:
            comments = get_response.json()
            if isinstance(comments, list) and len(comments) == 0:
                results.pass_test("GET /api/reports/{report_id}/comments returns empty list initially")
            else:
                results.fail_test("GET comments initial state", f"Expected empty list, got: {comments}")
        else:
            results.fail_test("GET comments status", f"Expected 200, got {get_response.status_code}")
        
        # Test 2: POST comment with valid data
        comment_data = {
            "text": "This waterlogging is quite severe, avoid this area during heavy rains!",
            "author": "LocalResident"
        }
        
        post_response = requests.post(
            f"{API_URL}/reports/{report_id}/comments",
            json=comment_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if post_response.status_code == 200:
            comment = post_response.json()
            required_fields = ["id", "report_id", "text", "author", "created_at"]
            missing_fields = [field for field in required_fields if field not in comment]
            
            if not missing_fields:
                results.pass_test("POST /api/reports/{report_id}/comments creates comment with all required fields")
                
                if comment["text"] == comment_data["text"] and comment["author"] == comment_data["author"]:
                    results.pass_test("POST comment preserves text and author")
                else:
                    results.fail_test("POST comment data integrity", "Text or author doesn't match")
                    
                if comment["report_id"] == report_id:
                    results.pass_test("POST comment links to correct report")
                else:
                    results.fail_test("POST comment report_id", f"Expected {report_id}, got {comment['report_id']}")
            else:
                results.fail_test("POST comment missing fields", f"Missing: {missing_fields}")
        else:
            results.fail_test("POST comment status", f"Expected 200, got {post_response.status_code}")
        
        # Test 3: GET comments after posting (should return the comment)
        get_after_response = requests.get(f"{API_URL}/reports/{report_id}/comments", timeout=10)
        
        if get_after_response.status_code == 200:
            comments = get_after_response.json()
            if isinstance(comments, list) and len(comments) == 1:
                results.pass_test("GET comments returns posted comment")
                
                if comments[0]["text"] == comment_data["text"]:
                    results.pass_test("GET comments data persistence")
                else:
                    results.fail_test("GET comments persistence", "Comment text doesn't match")
            else:
                results.fail_test("GET comments after post", f"Expected list with 1 comment, got: {len(comments) if isinstance(comments, list) else 'not a list'}")
        else:
            results.fail_test("GET comments after post status", f"Expected 200, got {get_after_response.status_code}")
        
        # Test 4: POST comment with long text (200 char limit)
        long_comment = {
            "text": "A" * 201,  # 201 characters - should fail
            "author": "TestUser"
        }
        
        long_response = requests.post(
            f"{API_URL}/reports/{report_id}/comments",
            json=long_comment,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if long_response.status_code == 422:  # Validation error
            results.pass_test("POST comment rejects text longer than 200 characters")
        else:
            results.fail_test("POST comment text limit", f"Expected 422 for long text, got {long_response.status_code}")
        
        # Test 5: POST comment to non-existent report
        fake_report_id = "non-existent-report-id"
        fake_comment = {
            "text": "This should fail",
            "author": "TestUser"
        }
        
        fake_response = requests.post(
            f"{API_URL}/reports/{fake_report_id}/comments",
            json=fake_comment,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if fake_response.status_code == 404:
            results.pass_test("POST comment to non-existent report returns 404")
        else:
            results.fail_test("POST comment invalid report", f"Expected 404, got {fake_response.status_code}")
            
    except Exception as e:
        results.fail_test("Comments system connection", str(e))
    
    return results

def test_voting_system():
    """Test Voting System - POST /api/reports/{report_id}/vote"""
    results = TestResults()
    
    # First create a report to vote on
    test_report = {
        "lat": 19.0760,
        "lng": 72.8777,
        "severity": "High"
    }
    
    try:
        # Create report
        create_response = requests.post(
            f"{API_URL}/reports", 
            json=test_report,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if create_response.status_code != 200:
            results.fail_test("Voting test setup", f"Failed to create test report: {create_response.status_code}")
            return results
            
        report_data = create_response.json()
        report_id = report_data["id"]
        
        # Verify initial vote counts
        if "accuracy_score" in report_data and "total_votes" in report_data:
            if report_data["accuracy_score"] == 0 and report_data["total_votes"] == 0:
                results.pass_test("New report has initial vote counts (accuracy_score=0, total_votes=0)")
            else:
                results.fail_test("Initial vote counts", f"Expected 0,0 got {report_data['accuracy_score']},{report_data['total_votes']}")
        else:
            results.fail_test("Vote fields missing", "accuracy_score or total_votes not in report")
        
        # Test 1: Vote UP on report
        up_vote = {"vote_type": "up"}
        
        up_response = requests.post(
            f"{API_URL}/reports/{report_id}/vote",
            json=up_vote,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if up_response.status_code == 200:
            vote_result = up_response.json()
            if "accuracy_score" in vote_result and "total_votes" in vote_result:
                if vote_result["accuracy_score"] == 1 and vote_result["total_votes"] == 1:
                    results.pass_test("POST vote 'up' increases accuracy_score and total_votes")
                else:
                    results.fail_test("Vote up counts", f"Expected 1,1 got {vote_result['accuracy_score']},{vote_result['total_votes']}")
            else:
                results.fail_test("Vote up response", "Missing accuracy_score or total_votes in response")
        else:
            results.fail_test("Vote up status", f"Expected 200, got {up_response.status_code}")
        
        # Test 2: Vote DOWN on report
        down_vote = {"vote_type": "down"}
        
        down_response = requests.post(
            f"{API_URL}/reports/{report_id}/vote",
            json=down_vote,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if down_response.status_code == 200:
            vote_result = down_response.json()
            if "accuracy_score" in vote_result and "total_votes" in vote_result:
                if vote_result["accuracy_score"] == 0 and vote_result["total_votes"] == 2:
                    results.pass_test("POST vote 'down' decreases accuracy_score and increases total_votes")
                else:
                    results.fail_test("Vote down counts", f"Expected 0,2 got {vote_result['accuracy_score']},{vote_result['total_votes']}")
            else:
                results.fail_test("Vote down response", "Missing accuracy_score or total_votes in response")
        else:
            results.fail_test("Vote down status", f"Expected 200, got {down_response.status_code}")
        
        # Test 3: Invalid vote type
        invalid_vote = {"vote_type": "invalid"}
        
        invalid_response = requests.post(
            f"{API_URL}/reports/{report_id}/vote",
            json=invalid_vote,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if invalid_response.status_code == 400:
            results.pass_test("POST vote with invalid vote_type returns 400")
        else:
            results.fail_test("Invalid vote type", f"Expected 400, got {invalid_response.status_code}")
        
        # Test 4: Vote on non-existent report
        fake_report_id = "non-existent-report-id"
        fake_vote = {"vote_type": "up"}
        
        fake_response = requests.post(
            f"{API_URL}/reports/{fake_report_id}/vote",
            json=fake_vote,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if fake_response.status_code == 404:
            results.pass_test("POST vote on non-existent report returns 404")
        else:
            results.fail_test("Vote invalid report", f"Expected 404, got {fake_response.status_code}")
            
    except Exception as e:
        results.fail_test("Voting system connection", str(e))
    
    return results

def test_time_filtering():
    """Test Time-Based Filtering - GET /api/reports?time_filter=1h|6h|24h"""
    results = TestResults()
    
    try:
        # Test 1: Time filter 1h
        response_1h = requests.get(f"{API_URL}/reports?time_filter=1h", timeout=10)
        
        if response_1h.status_code == 200:
            reports_1h = response_1h.json()
            if isinstance(reports_1h, list):
                results.pass_test("GET /api/reports?time_filter=1h returns list")
            else:
                results.fail_test("Time filter 1h format", f"Expected list, got {type(reports_1h)}")
        else:
            results.fail_test("Time filter 1h status", f"Expected 200, got {response_1h.status_code}")
        
        # Test 2: Time filter 6h
        response_6h = requests.get(f"{API_URL}/reports?time_filter=6h", timeout=10)
        
        if response_6h.status_code == 200:
            reports_6h = response_6h.json()
            if isinstance(reports_6h, list):
                results.pass_test("GET /api/reports?time_filter=6h returns list")
            else:
                results.fail_test("Time filter 6h format", f"Expected list, got {type(reports_6h)}")
        else:
            results.fail_test("Time filter 6h status", f"Expected 200, got {response_6h.status_code}")
        
        # Test 3: Time filter 24h
        response_24h = requests.get(f"{API_URL}/reports?time_filter=24h", timeout=10)
        
        if response_24h.status_code == 200:
            reports_24h = response_24h.json()
            if isinstance(reports_24h, list):
                results.pass_test("GET /api/reports?time_filter=24h returns list")
            else:
                results.fail_test("Time filter 24h format", f"Expected list, got {type(reports_24h)}")
        else:
            results.fail_test("Time filter 24h status", f"Expected 200, got {response_24h.status_code}")
        
        # Test 4: Invalid time filter (should default to 24h)
        response_invalid = requests.get(f"{API_URL}/reports?time_filter=invalid", timeout=10)
        
        if response_invalid.status_code == 200:
            reports_invalid = response_invalid.json()
            if isinstance(reports_invalid, list):
                results.pass_test("GET /api/reports?time_filter=invalid returns list (defaults to 24h)")
            else:
                results.fail_test("Invalid time filter format", f"Expected list, got {type(reports_invalid)}")
        else:
            results.fail_test("Invalid time filter status", f"Expected 200, got {response_invalid.status_code}")
        
        # Test 5: Create a fresh report and verify it appears in all time filters
        fresh_report = {
            "lat": 18.5204,
            "lng": 73.8567,
            "severity": "Medium"
        }
        
        create_response = requests.post(
            f"{API_URL}/reports", 
            json=fresh_report,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if create_response.status_code == 200:
            fresh_report_id = create_response.json()["id"]
            
            # Check if fresh report appears in 1h filter
            fresh_1h_response = requests.get(f"{API_URL}/reports?time_filter=1h", timeout=10)
            if fresh_1h_response.status_code == 200:
                fresh_reports_1h = fresh_1h_response.json()
                found_in_1h = any(report["id"] == fresh_report_id for report in fresh_reports_1h)
                
                if found_in_1h:
                    results.pass_test("Fresh report appears in 1h time filter")
                else:
                    results.fail_test("Fresh report 1h filter", "Fresh report not found in 1h filter")
            else:
                results.fail_test("Fresh report 1h check", f"Failed to get 1h filtered reports: {fresh_1h_response.status_code}")
        else:
            results.fail_test("Time filter test setup", f"Failed to create fresh report: {create_response.status_code}")
            
    except Exception as e:
        results.fail_test("Time filtering connection", str(e))
    
    return results

def main():
    """Run all backend tests"""
    print("🧪 Starting AquaRoute Backend API Tests")
    print(f"Backend URL: {API_URL}")
    print("="*60)
    
    all_results = TestResults()
    
    # Test 1: API Root endpoint
    print("\n📍 Testing API Root Endpoint")
    result = test_api_root()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Test 2: GET reports (empty state)
    print("\n📍 Testing GET Reports (Empty State)")
    result = test_get_reports_empty()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Test 3: Create valid report
    print("\n📍 Testing POST Reports (Valid Data)")
    result, created_report = test_create_report_valid()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Test 4: Different severity levels
    print("\n📍 Testing Different Severity Levels")
    result = test_severity_levels()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Test 5: Invalid severity
    print("\n📍 Testing Invalid Severity Validation")
    result = test_invalid_severity()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Test 6: Missing required fields
    print("\n📍 Testing Missing Required Fields")
    result = test_missing_required_fields()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Test 7: Data persistence
    print("\n📍 Testing Data Persistence")
    result = test_data_persistence()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Test 8: Malformed JSON
    print("\n📍 Testing Malformed JSON Handling")
    result = test_malformed_json()
    all_results.passed += result.passed
    all_results.failed += result.failed
    all_results.errors.extend(result.errors)
    
    # Final summary
    success = all_results.summary()
    
    if success:
        print("\n🎉 All backend tests passed! AquaRoute API is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {all_results.failed} backend tests failed. See details above.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)