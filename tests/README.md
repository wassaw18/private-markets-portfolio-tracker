# Tests Directory

Test suite for the Private Markets Tracker application.

## Test Files

### Authentication Tests
- `test_authentication.py` - Authentication system tests
- `final_login_test.py` - Login flow integration tests

## Running Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_authentication.py

# Run with verbose output
pytest tests/ -v
```

## Test Coverage

Current test coverage includes:
- Authentication and JWT token handling
- Login/logout flows
- User creation and management

## TODO

Expand test coverage for:
- [ ] Investment CRUD operations
- [ ] Entity management
- [ ] Document upload/download
- [ ] Benchmark data endpoints
- [ ] Performance calculations
- [ ] Multi-tenant isolation

## Best Practices

1. **Write tests first** for new features (TDD)
2. **Mock external dependencies** (database, APIs)
3. **Test edge cases** and error conditions
4. **Maintain test data** separate from production
5. **Run tests before commits** to catch regressions
