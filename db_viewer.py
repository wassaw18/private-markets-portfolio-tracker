#!/usr/bin/env python3
"""
Simple web-based database viewer for Private Markets Tracker
Run this script and open http://localhost:5001 in your browser
"""

from flask import Flask, render_template_string, request
import psycopg2
from psycopg2.extras import RealDictCursor
import os

app = Flask(__name__)

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'database': 'portfolio_tracker_db',
    'user': 'portfolio_user',
    'password': 'monkeys'
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def get_tables():
    """Get list of all tables in the database"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return tables

def get_table_data(table_name, limit=100):
    """Get data from a specific table"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get column names
    cur.execute(f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    columns = cur.fetchall()

    # Get data
    cur.execute(f"SELECT * FROM {table_name} LIMIT %s", (limit,))
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return columns, rows

def execute_query(query):
    """Execute a custom SQL query (supports SELECT, INSERT, UPDATE, DELETE)"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(query)

        # Check if it's a SELECT query (has results to fetch)
        if cur.description:
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            conn.commit()
            return columns, rows, None
        else:
            # For INSERT, UPDATE, DELETE queries
            affected_rows = cur.rowcount
            conn.commit()
            return [], [], f"Query executed successfully. {affected_rows} row(s) affected."
    except Exception as e:
        conn.rollback()
        return [], [], f"Error: {str(e)}"
    finally:
        cur.close()
        conn.close()

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Database Viewer - Private Markets Tracker</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 5px;
        }
        .header p {
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px;
        }
        .sidebar {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        .sidebar h3 {
            margin-bottom: 15px;
            color: #2c3e50;
            font-size: 16px;
        }
        .table-list {
            list-style: none;
        }
        .table-list li {
            margin-bottom: 8px;
        }
        .table-list a {
            display: block;
            padding: 10px 15px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            color: #2c3e50;
            text-decoration: none;
            transition: all 0.2s;
        }
        .table-list a:hover {
            background: #3498db;
            color: white;
            border-color: #3498db;
        }
        .table-list a.active {
            background: #2c3e50;
            color: white;
            border-color: #2c3e50;
        }
        .query-box {
            margin-bottom: 20px;
        }
        .query-box textarea {
            width: 100%;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            resize: vertical;
            min-height: 100px;
        }
        .query-box button {
            margin-top: 10px;
            padding: 12px 24px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .query-box button:hover {
            background: #2980b9;
            transform: translateY(-1px);
        }
        .examples {
            margin-top: 10px;
            padding: 15px;
            background: #fff9e6;
            border-left: 4px solid #f39c12;
            border-radius: 4px;
        }
        .examples h4 {
            margin-bottom: 10px;
            color: #f39c12;
            font-size: 14px;
        }
        .examples code {
            display: block;
            padding: 8px;
            background: white;
            border-radius: 3px;
            margin-bottom: 5px;
            font-size: 12px;
            color: #2c3e50;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th {
            background: #2c3e50;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e8e8e8;
            font-size: 14px;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .error {
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .success {
            background: #efe;
            border: 1px solid #cfc;
            color: #363;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .info {
            background: #e8f4f8;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            background: #3498db;
            color: white;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗄️ Database Viewer</h1>
            <p>Private Markets Portfolio Tracker - PostgreSQL Database</p>
        </div>

        <div class="content">
            <div class="sidebar">
                <h3>📊 Available Tables</h3>
                <ul class="table-list">
                    {% for table in tables %}
                    <li>
                        <a href="?table={{ table }}"
                           class="{% if current_table == table %}active{% endif %}">
                            {{ table }}
                        </a>
                    </li>
                    {% endfor %}
                </ul>
            </div>

            <div class="query-box">
                <h3 style="margin-bottom: 15px; color: #2c3e50;">🔍 Custom SQL Query</h3>
                <form method="POST" action="/">
                    <textarea name="query" placeholder="Enter SQL query here...">{{ query or '' }}</textarea>
                    <button type="submit">Execute Query</button>
                </form>

                <div class="examples">
                    <h4>💡 Example Queries:</h4>
                    <strong>SELECT (Read):</strong>
                    <code>SELECT username, email, role FROM users;</code>
                    <code>SELECT * FROM users WHERE username = 'testuser';</code>
                    <strong>DELETE (Remove):</strong>
                    <code>DELETE FROM users WHERE username = 'testuser' AND id = 123;</code>
                    <strong>UPDATE (Modify):</strong>
                    <code>UPDATE users SET email = 'newemail@example.com' WHERE username = 'testuser';</code>
                    <strong>INSERT (Add):</strong>
                    <code>INSERT INTO users (username, email, tenant_id) VALUES ('newuser', 'new@example.com', 1);</code>
                    <p style="color: #e74c3c; margin-top: 10px; font-weight: 600;">⚠️ Warning: DELETE/UPDATE operations are permanent!</p>
                </div>
            </div>

            {% if error %}
            <div class="error">
                <strong>Error:</strong> {{ error }}
            </div>
            {% endif %}

            {% if success %}
            <div class="success">
                {{ success }}
            </div>
            {% endif %}

            {% if current_table %}
            <div class="info">
                <strong>Table:</strong> <span class="badge">{{ current_table }}</span> |
                <strong>Rows shown:</strong> {{ rows|length }} |
                <strong>Columns:</strong> {{ columns|length }}
            </div>
            {% endif %}

            {% if columns and rows %}
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            {% for col in columns %}
                            <th>{{ col if col is string else col.column_name }}</th>
                            {% endfor %}
                        </tr>
                    </thead>
                    <tbody>
                        {% for row in rows %}
                        <tr>
                            {% for col in columns %}
                            <td>{{ row[col if col is string else col.column_name] }}</td>
                            {% endfor %}
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
            {% elif current_table and not rows %}
            <div class="info">
                No data found in table "{{ current_table }}"
            </div>
            {% endif %}
        </div>
    </div>
</body>
</html>
"""

@app.route('/', methods=['GET', 'POST'])
def index():
    tables = get_tables()
    current_table = request.args.get('table')
    query = request.form.get('query')
    columns = []
    rows = []
    error = None
    success = None

    if request.method == 'POST' and query:
        # Execute custom query
        cols, data, err = execute_query(query)
        if err:
            error = err
        else:
            columns = cols
            rows = data
            if not columns:
                success = err  # Success message
    elif current_table:
        # Show table data
        try:
            columns, rows = get_table_data(current_table)
        except Exception as e:
            error = str(e)

    return render_template_string(
        HTML_TEMPLATE,
        tables=tables,
        current_table=current_table,
        columns=columns,
        rows=rows,
        query=query,
        error=error,
        success=success
    )

if __name__ == '__main__':
    print("=" * 60)
    print("🗄️  Database Viewer Starting...")
    print("=" * 60)
    print(f"📊 Database: {DB_CONFIG['database']}")
    print(f"🌐 URL: http://localhost:5001")
    print(f"🌐 Network URL: http://172.23.5.82:5001")
    print("=" * 60)
    print("\nPress Ctrl+C to stop the server")
    print()
    app.run(host='0.0.0.0', port=5001, debug=True)
