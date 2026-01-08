"""
Export database using Docker's pg_dump (doesn't require local PostgreSQL installation).
This is the easiest way to export your database if you're running it in Docker.

Usage:
    docker exec yelp-analytics-db pg_dump -U yelp_user yelp_analytics > backend/database_dump.sql
    
Or run this script:
    python -m scripts.export_database_docker
"""
import subprocess
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
dump_file = backend_dir / "database_dump.sql"

print("Exporting database from Docker container...")
print(f"Output: {dump_file}\n")

try:
    # Use Docker exec to run pg_dump inside the container
    cmd = [
        "docker", "exec",
        "yelp-analytics-db",
        "pg_dump",
        "-U", "yelp_user",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        "yelp_analytics"
    ]
    
    print(f"Running: {' '.join(cmd)}\n")
    
    # Run command and save output to file
    with open(dump_file, 'w', encoding='utf-8') as f:
        result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
    
    if result.returncode == 0:
        size_mb = dump_file.stat().st_size / (1024 * 1024)
        print(f"✓ Database exported successfully!")
        print(f"  File: {dump_file}")
        print(f"  Size: {size_mb:.2f} MB\n")
        print("Next steps:")
        print("  1. Review the dump file")
        print("  2. git add backend/database_dump.sql")
        print("  3. git commit -m 'Add database dump for Docker'")
        print("  4. git push")
        print("\nNow anyone who clones your repo can run:")
        print("  docker-compose up")
        print("And have a fully populated database!")
    else:
        print(f"✗ Error exporting database:")
        print(result.stderr)
        print("\nMake sure:")
        print("  1. Docker is running")
        print("  2. Database container is running: docker ps")
        print("  3. Container is named 'yelp-analytics-db'")
        exit(1)
        
except FileNotFoundError:
    print("✗ Error: Docker not found!")
    print("Please install Docker Desktop:")
    print("  https://www.docker.com/products/docker-desktop/")
    exit(1)
