"""
Script to update analytics service to use metrics repository.
This updates all timeline methods to use pre-computed metrics.
"""
import sys
from pathlib import Path

# Read the service file
service_file = Path(__file__).parent.parent / "services" / "analytics_service.py"
content = service_file.read_text()

# Define replacements for city ratings timeline
content = content.replace(
    """        # Get timeline data from repository
        timeline_data = await self.review_repository.get_city_ratings_over_time(
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )""",
    """        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        timeline_data = await self.metrics_repo.get_city_ratings_timeline(
            db=self.db,
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )"""
)

# City sentiment timeline
content = content.replace(
    """        # Get timeline data from repository
        timeline_data = await self.review_repository.get_city_sentiment_over_time(
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )""",
    """        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        timeline_data = await self.metrics_repo.get_city_sentiment_timeline(
            db=self.db,
            city=city,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )"""
)

# Category ratings timeline
content = content.replace(
    """        # Get timeline data from repository
        timeline_data = await self.review_repository.get_category_ratings_over_time(
            category=category,
            period=period,
            start_date=start_date,
            end_date=end_date
        )""",
    """        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        # Note: Category metrics are city-specific in pre-computed tables
        timeline_data = await self.metrics_repo.get_category_ratings_timeline(
            db=self.db,
            category=category,
            period=period,
            start_date=start_date,
            end_date=end_date
        )"""
)

# Category sentiment timeline
content = content.replace(
    """        # Get timeline data from repository
        timeline_data = await self.review_repository.get_category_sentiment_over_time(
            category=category,
            period=period,
            start_date=start_date,
            end_date=end_date
        )""",
    """        # Get timeline data from PRE-COMPUTED metrics (FAST!)
        timeline_data = await self.metrics_repo.get_category_sentiment_timeline(
            db=self.db,
            category=category,
            period=period,
            start_date=start_date,
            end_date=end_date
        )"""
)

# State timeline methods
content = content.replace(
    """        timeline_data = await self.review_repository.get_state_ratings_over_time(
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )""",
    """        timeline_data = await self.metrics_repo.get_state_ratings_timeline(
            db=self.db,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )"""
)

content = content.replace(
    """        timeline_data = await self.review_repository.get_state_sentiment_over_time(
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )""",
    """        timeline_data = await self.metrics_repo.get_state_sentiment_timeline(
            db=self.db,
            state=state,
            period=period,
            start_date=start_date,
            end_date=end_date
        )"""
)

# Write the updated content
service_file.write_text(content)

print("✅ Updated analytics_service.py to use metrics repository")
print("All timeline methods now use pre-computed metrics!")
