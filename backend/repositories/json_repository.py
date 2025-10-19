"""
JSON-based repository for mock database access.
This provides a simple interface to read JSON files as a database.
"""
import json
from pathlib import Path
from typing import List, Dict, Any, Optional


class JSONRepository:
    """Base repository class for reading JSON data files."""

    def __init__(self, json_file_path: Path):
        """
        Initialize the repository with a JSON file path.

        Args:
            json_file_path: Path to the JSON file
        """
        self.json_file_path = json_file_path
        self._data: Optional[List[Dict[str, Any]]] = None

    def _load_data(self) -> List[Dict[str, Any]]:
        """
        Load data from JSON file into memory.
        Supports both regular JSON arrays and NDJSON (newline-delimited JSON).

        Returns:
            List of dictionaries from the JSON file
        """
        if self._data is None:
            if not self.json_file_path.exists():
                raise FileNotFoundError(f"JSON file not found: {self.json_file_path}")

            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                try:
                    # Try loading as regular JSON array first
                    self._data = json.load(f)
                except json.JSONDecodeError:
                    # If that fails, try loading as NDJSON (newline-delimited)
                    f.seek(0)  # Reset file pointer
                    self._data = []
                    for line in f:
                        line = line.strip()
                        if line:  # Skip empty lines
                            self._data.append(json.loads(line))

        return self._data

    def get_all(self) -> List[Dict[str, Any]]:
        """
        Get all records from the JSON file.

        Returns:
            List of all records
        """
        return self._load_data()

    def get_by_id(self, id_field: str, id_value: Any) -> Optional[Dict[str, Any]]:
        """
        Get a single record by ID field.

        Args:
            id_field: The field name to search (e.g., 'business_id')
            id_value: The value to match

        Returns:
            The matching record or None if not found
        """
        data = self._load_data()
        for record in data:
            if record.get(id_field) == id_value:
                return record
        return None

    def filter_by(self, **kwargs) -> List[Dict[str, Any]]:
        """
        Filter records by field values.

        Args:
            **kwargs: Field-value pairs to filter by

        Returns:
            List of matching records
        """
        data = self._load_data()
        results = data

        for field, value in kwargs.items():
            results = [
                record for record in results
                if record.get(field) == value
            ]

        return results

    def count(self) -> int:
        """
        Get the total count of records.

        Returns:
            Number of records
        """
        return len(self._load_data())


class BusinessRepository(JSONRepository):
    """Repository for business data."""

    def get_by_business_id(self, business_id: str) -> Optional[Dict[str, Any]]:
        """Get business by business_id."""
        return self.get_by_id('business_id', business_id)

    def get_by_city(self, city: str) -> List[Dict[str, Any]]:
        """Get all businesses in a city."""
        return self.filter_by(city=city)

    def get_by_state(self, state: str) -> List[Dict[str, Any]]:
        """Get all businesses in a state."""
        return self.filter_by(state=state)


class PhotoRepository(JSONRepository):
    """Repository for photo data."""

    def get_by_photo_id(self, photo_id: str) -> Optional[Dict[str, Any]]:
        """Get photo by photo_id."""
        return self.get_by_id('photo_id', photo_id)

    def get_by_business_id(self, business_id: str) -> List[Dict[str, Any]]:
        """Get all photos for a business."""
        return self.filter_by(business_id=business_id)


class ReviewRepository(JSONRepository):
    """Repository for review data."""

    def get_by_review_id(self, review_id: str) -> Optional[Dict[str, Any]]:
        """Get review by review_id."""
        return self.get_by_id('review_id', review_id)

    def get_by_business_id(self, business_id: str) -> List[Dict[str, Any]]:
        """Get all reviews for a business."""
        return self.filter_by(business_id=business_id)

    def get_by_user_id(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all reviews by a user."""
        return self.filter_by(user_id=user_id)