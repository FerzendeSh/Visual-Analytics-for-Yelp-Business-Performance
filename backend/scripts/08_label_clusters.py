"""
Local LLM cluster labeling for competitive analysis.

Generates labels and insights for business clusters based on:
- Business attributes (price, parking, ambience, etc.)
- Review embeddings patterns
- Competitive metrics (stars, review counts)
- Geographic concentration

Focuses on competitive intelligence and business insights, not marketing.

Requirements:
    pip install transformers torch sentencepiece accelerate

Usage:
    python -m scripts.clustering.label_clusters_local --run-id 1
    python -m scripts.clustering.label_clusters_local --run-id 1 --device cuda
"""

import argparse
import json
import logging
import sys
import re
from pathlib import Path
from typing import List, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from configs.database import get_db
from models.business import Business
from models.cluster import Cluster, BusinessCluster

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# LOCAL LLM CLUSTER LABELING
# ============================================================================

class LocalClusterLabeler:
    """Uses local LLM (TinyLlama or Phi-2) to generate semantic labels for clusters."""

    def __init__(
        self,
        model_name: str = "microsoft/phi-2",
        device: str = "auto"
    ):
        """
        Initialize the labeler with specified model.

        Args:
            model_name: HuggingFace model name
            device: Device to run on ('auto', 'cuda', 'cpu')
        """
        logger.info(f"Loading model: {model_name}")
        logger.info(f"Device: {device}")

        # Load tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)

        # Set pad token if not set (prevents warnings)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.model_name = model_name

        # Check if model supports chat template
        self.use_chat_template = 'TinyLlama' in model_name or 'Llama' in model_name

        # Determine device
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"

        self.device = device
        logger.info(f"Using device: {self.device}")

        # Load model with appropriate settings
        if self.device == "cuda":
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto"
            )
        else:
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float32
            )
            self.model = self.model.to(self.device)

        self.model.eval()
        logger.info("Model loaded successfully")
        logger.info(f"Chat template: {'enabled' if self.use_chat_template else 'disabled'}")

    def generate_cluster_label(
        self,
        cluster: Cluster,
        sample_businesses: List[Business],
        max_samples: int = 15
    ) -> Dict[str, any]:
        # Handle noise clusters
        if cluster.cluster_label == -1:
            noise_insights = self._analyze_noise_cluster(sample_businesses)
            attributes_summary = self._extract_attribute_patterns(sample_businesses)
            return {
                'label': 'Outliers/Unique Businesses',
                'description': noise_insights['description'],
                'key_characteristics': noise_insights['characteristics'],
                'attribute_patterns': attributes_summary
            }

        # Handle empty clusters
        if cluster.size == 0:
            return {
                'label': 'Empty Cluster',
                'description': 'No businesses assigned.',
                'key_characteristics': [],
                'attribute_patterns': {}
            }

        # Handle very small clusters (2-4 businesses) - use simple rule-based approach
        if cluster.size <= 4 and len(sample_businesses) <= 4:
            logger.info(f"Small cluster ({cluster.size} businesses) - using simplified labeling")
            return self._generate_small_cluster_label(cluster, sample_businesses)

        location = f"{cluster.neighborhood}, {cluster.city}" if cluster.neighborhood else cluster.city

        cluster_stats = {
            'location': location,
            'size': cluster.size,
            'avg_stars': round(cluster.avg_stars, 2) if cluster.avg_stars else None,
            'avg_review_count': round(cluster.avg_review_count, 1) if cluster.avg_review_count else None,
            'top_categories': cluster.top_categories[:5] if cluster.top_categories else []
        }

        sample_businesses = sample_businesses[:max_samples]

        attributes_summary = self._extract_attribute_patterns(sample_businesses)
        cluster_stats['attributes'] = attributes_summary

        business_samples = []
        for biz in sample_businesses[:8]:
            biz_data = {
                'name': biz.name,
                'categories': biz.categories.split(',')[:2] if biz.categories else [],
                'stars': biz.stars,
                'review_count': biz.review_count
            }

            if biz.attributes:
                attrs = biz.attributes if isinstance(biz.attributes, dict) else {}
                biz_data['price_range'] = attrs.get('RestaurantsPriceRange2')
                biz_data['parking'] = attrs.get('BusinessParking')
                biz_data['ambience'] = attrs.get('Ambience')

            business_samples.append(biz_data)

        prompt = self._create_labeling_prompt(cluster_stats, business_samples)

        # Generate response
        try:
            logger.debug(f"Generating label for cluster {cluster.cluster_id}...")

            # Format prompt based on model type
            if self.use_chat_template:
                # TinyLlama uses chat template
                messages = [
                    {"role": "system", "content": "You are a business analyst specializing in competitive market segmentation."},
                    {"role": "user", "content": prompt}
                ]
                formatted_prompt = self.tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True
                )
            else:
                # Phi-2 and others use direct prompt
                formatted_prompt = prompt

            # Tokenize
            inputs = self.tokenizer(
                formatted_prompt,
                return_tensors="pt",
                truncation=True,
                max_length=1024
            ).to(self.device)

            # Generate with better settings for structured output
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=300,
                    temperature=0.6,  # Lower temp for more consistent structured output
                    top_p=0.85,
                    do_sample=True,
                    pad_token_id=self.tokenizer.pad_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                    repetition_penalty=1.1  # Reduce repetition
                )

            # Decode
            response_text = self.tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:],
                skip_special_tokens=True
            )

            # Parse response
            result = self._parse_response(response_text, cluster_stats)
            result['attribute_patterns'] = attributes_summary

            logger.info(f"Generated label: {result.get('label')}")
            return result

        except Exception as e:
            logger.error(f"Error generating label: {e}")
            fallback = self._generate_fallback_label(cluster_stats)
            fallback['attribute_patterns'] = attributes_summary
            return fallback

    def _extract_attribute_patterns(self, businesses: List[Business]) -> Dict:
        patterns = {
            'price_ranges': [],
            'parking_available': 0,
            'delivery_available': 0,
            'takeout_available': 0,
            'outdoor_seating': 0,
            'accepts_credit_cards': 0,
            'good_for_groups': 0,
            'reservations': 0,
            'ambience_types': [],
            'wifi_available': 0,
            'alcohol_served': 0
        }

        for biz in businesses:
            if not biz.attributes or not isinstance(biz.attributes, dict):
                continue

            attrs = biz.attributes

            if 'RestaurantsPriceRange2' in attrs:
                patterns['price_ranges'].append(attrs['RestaurantsPriceRange2'])

            if attrs.get('BusinessParking') and 'true' in str(attrs.get('BusinessParking')).lower():
                patterns['parking_available'] += 1

            if attrs.get('RestaurantsDelivery') == 'True':
                patterns['delivery_available'] += 1

            if attrs.get('RestaurantsTakeOut') == 'True':
                patterns['takeout_available'] += 1

            if attrs.get('OutdoorSeating') == 'True':
                patterns['outdoor_seating'] += 1

            if attrs.get('BusinessAcceptsCreditCards') == 'True':
                patterns['accepts_credit_cards'] += 1

            if attrs.get('RestaurantsGoodForGroups') == 'True':
                patterns['good_for_groups'] += 1

            if attrs.get('RestaurantsReservations') == 'True':
                patterns['reservations'] += 1

            if attrs.get('WiFi') and attrs.get('WiFi') != 'no':
                patterns['wifi_available'] += 1

            if attrs.get('Alcohol') and attrs.get('Alcohol') != 'none':
                patterns['alcohol_served'] += 1

        total = len(businesses)
        if total > 0:
            for key in ['parking_available', 'delivery_available', 'takeout_available',
                       'outdoor_seating', 'accepts_credit_cards', 'good_for_groups',
                       'reservations', 'wifi_available', 'alcohol_served']:
                patterns[key] = round((patterns[key] / total) * 100)

        if patterns['price_ranges']:
            from statistics import mode, StatisticsError
            try:
                patterns['dominant_price'] = mode(patterns['price_ranges'])
            except StatisticsError:
                patterns['dominant_price'] = None

        return patterns

    def _generate_small_cluster_label(self, cluster: Cluster, businesses: List[Business]) -> Dict:
        """Generate simple rule-based labels for very small clusters (2-4 businesses)."""
        attributes_summary = self._extract_attribute_patterns(businesses)

        # Extract common characteristics
        categories = []
        for biz in businesses:
            if biz.categories:
                cats = [c.strip() for c in biz.categories.split(',')]
                categories.extend(cats[:2])

        # Find most common category
        if categories:
            from collections import Counter
            category_counts = Counter(categories)
            top_category = category_counts.most_common(1)[0][0]
        else:
            top_category = "Mixed Businesses"

        # Determine price tier
        avg_price = attributes_summary.get('dominant_price')
        price_tier = {1: '$', 2: '$$', 3: '$$$', 4: '$$$$'}.get(avg_price, '$$')

        # Determine edge based on attributes
        edges = []
        if attributes_summary.get('delivery_available', 0) > 50:
            edges.append('Delivery')
        if cluster.avg_stars and cluster.avg_stars >= 4.0:
            edges.append('Quality-Focused')
        if attributes_summary.get('outdoor_seating', 0) > 50:
            edges.append('Outdoor Seating')
        if not edges:
            edges.append('Local')

        edge = edges[0] if edges else 'Local'

        # Build label
        label = f"{top_category} | {price_tier} | {edge}"

        # Build description
        biz_names = [b.name for b in businesses[:3]]
        location = f"{cluster.neighborhood}, {cluster.city}" if cluster.neighborhood else cluster.city
        description = f"Small cluster of {cluster.size} businesses in {location}: {', '.join(biz_names)}."

        # Build characteristics
        characteristics = [top_category]
        if cluster.avg_stars:
            characteristics.append(f"{cluster.avg_stars:.1f}★ Average")
        characteristics.extend(edges[:2])

        return {
            'label': label,
            'description': description,
            'key_characteristics': characteristics,
            'attribute_patterns': attributes_summary
        }

    def _analyze_noise_cluster(self, businesses: List[Business]) -> Dict:
        if not businesses:
            return {
                'description': 'Outlier businesses that do not fit standard patterns.',
                'characteristics': ['Diverse', 'Unique']
            }

        categories = set()
        for biz in businesses:
            if biz.categories:
                cats = [c.strip() for c in biz.categories.split(',')]
                categories.update(cats[:3])

        diversity_score = len(categories) / len(businesses) if businesses else 0

        if diversity_score > 0.8:
            reason = 'High diversity - businesses span many unrelated categories'
        elif len(businesses) < 3:
            reason = 'Too few similar businesses to form meaningful cluster'
        else:
            reason = 'Unique business characteristics not shared with other clusters'

        return {
            'description': f'Noise cluster: {reason}. Diversity: {diversity_score:.1%}',
            'characteristics': ['Outliers', 'High Diversity', 'Unique Attributes']
        }

    def _create_labeling_prompt(
        self,
        cluster_stats: Dict,
        business_samples: List[Dict]
    ) -> str:
        categories_str = ", ".join([
            f"{cat['category']} ({cat['count']})"
            for cat in cluster_stats['top_categories']
        ]) if cluster_stats['top_categories'] else "Mixed"

        attrs = cluster_stats.get('attributes', {})
        attr_summary = []
        if attrs.get('dominant_price'):
            price_labels = {1: 'Budget', 2: 'Moderate', 3: 'Upscale', 4: 'High-End'}
            attr_summary.append(f"Price: {price_labels.get(attrs['dominant_price'], 'Mixed')}")

        if attrs.get('parking_available', 0) > 60:
            attr_summary.append(f"Parking: {attrs['parking_available']}%")
        if attrs.get('delivery_available', 0) > 60:
            attr_summary.append("Delivery common")
        if attrs.get('outdoor_seating', 0) > 50:
            attr_summary.append("Outdoor seating")
        if attrs.get('alcohol_served', 0) > 70:
            attr_summary.append("Alcohol served")
        if attrs.get('reservations', 0) > 60:
            attr_summary.append("Reservations typical")

        attr_str = ", ".join(attr_summary) if attr_summary else "Mixed attributes"

        businesses_str = "\n".join([
            f"- {b['name']}: {', '.join(b['categories']) if b['categories'] else 'N/A'}, {b['stars']}★, {b['review_count']} reviews"
            for b in business_samples[:6]
        ])

        prompt = f"""You are a business analyst. Analyze this cluster of {cluster_stats['size']} businesses in {cluster_stats['location']}.

DATA:
Categories: {categories_str}
Avg Rating: {cluster_stats['avg_stars']}★ | Avg Reviews: {cluster_stats['avg_review_count']}
Attributes: {attr_str}

BUSINESSES:
{businesses_str}

Create a competitive segment label using this EXACT format:
[Business Type] | [Price] | [Edge]

Price: $ (Budget), $$ (Moderate), $$$ (Upscale), $$$$ (Luxury)
Edge: High-Volume, Quality-Focused, Delivery, Dine-In, Local, Chain, Neighborhood, Tourist

EXAMPLES:
LABEL: Pizza & Italian | $$ | High-Volume Delivery
DESCRIPTION: Mid-priced Italian restaurants competing on delivery speed, targeting busy families.
CHARACTERISTICS: Delivery-Focused, Moderate Pricing, Family-Friendly, Quick Service

LABEL: Coffee Shops | $ | Local Favorites
DESCRIPTION: Independent coffee shops competing on quality and community atmosphere.
CHARACTERISTICS: High Satisfaction, Local Ownership, Community-Oriented, Quality-Driven

LABEL: Asian Fusion | $$$ | Upscale Dine-In
DESCRIPTION: Premium Asian restaurants with creative fusion menus for special occasions.
CHARACTERISTICS: Upscale Atmosphere, Creative Menu, Special Occasions, Premium Pricing

Now analyze the cluster above. Output EXACTLY this structure:
LABEL: [your label here]
DESCRIPTION: [your description here]
CHARACTERISTICS: [char1, char2, char3, char4]"""

        return prompt

    def _parse_response(self, response_text: str, cluster_stats: Dict) -> Dict[str, any]:
        """Parse the LLM response and extract structured data."""

        # Try to extract structured fields
        label = None
        description = None
        characteristics = []

        # Extract LABEL
        label_match = re.search(r'LABEL:\s*(.+?)(?:\n|$)', response_text, re.IGNORECASE)
        if label_match:
            label = label_match.group(1).strip()
            # Clean up label
            label = re.sub(r'^["\'`]|["\'`]$', '', label)  # Remove quotes
            label = label[:100]  # Limit length

        # Extract DESCRIPTION
        desc_match = re.search(r'DESCRIPTION:\s*(.+?)(?:\n|CHARACTERISTICS|$)', response_text, re.IGNORECASE | re.DOTALL)
        if desc_match:
            description = desc_match.group(1).strip()
            description = re.sub(r'^["\'`]|["\'`]$', '', description)
            description = description[:500]

        # Extract CHARACTERISTICS
        char_match = re.search(r'CHARACTERISTICS:\s*(.+?)(?:\n|$)', response_text, re.IGNORECASE)
        if char_match:
            char_text = char_match.group(1).strip()
            characteristics = [c.strip() for c in char_text.split(',') if c.strip()]
            characteristics = characteristics[:5]

        # Fallback if parsing failed
        if not label:
            logger.warning("Failed to parse label from response, using fallback")
            return self._generate_fallback_label(cluster_stats)

        # Clean up description if missing
        if not description:
            description = f"A cluster of {cluster.size} businesses in {cluster_stats['location']}."

        # Ensure we have characteristics
        if not characteristics:
            if cluster_stats['top_categories']:
                characteristics = [cat['category'] for cat in cluster_stats['top_categories'][:3]]
            else:
                characteristics = ['Mixed', 'Local']

        return {
            'label': label,
            'description': description,
            'key_characteristics': characteristics
        }

    def _generate_fallback_label(self, cluster_stats: Dict) -> Dict[str, any]:
        """Generate a simple fallback label when LLM fails."""
        top_categories = cluster_stats.get('top_categories', [])

        if top_categories:
            top_cat = top_categories[0]['category']
            label = f"{top_cat} Cluster"
            description = f"A cluster of businesses primarily in the {top_cat} category."
            characteristics = [cat['category'] for cat in top_categories[:3]]
        else:
            label = "Mixed Businesses"
            description = "A diverse cluster of local businesses."
            characteristics = ["Mixed", "Local", "Diverse"]

        return {
            'label': label,
            'description': description,
            'key_characteristics': characteristics
        }


# ============================================================================
# MAIN LABELING PIPELINE
# ============================================================================

def label_cluster_run(
    run_id: int,
    db: Session,
    model_name: str = "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    device: str = "auto",
    batch_size: int = 10
) -> None:
    """
    Label all clusters in a run using local LLM.

    Args:
        run_id: ClusterRun ID
        db: Database session
        model_name: HuggingFace model name
        device: Device to use ('auto', 'cuda', 'cpu')
        batch_size: Number of clusters to commit at once
    """
    logger.info(f"\n{'='*80}")
    logger.info(f"LABELING CLUSTERS FOR RUN ID: {run_id}")
    logger.info(f"Model: {model_name}")
    logger.info(f"{'='*80}\n")

    # Load clusters
    stmt = select(Cluster).where(Cluster.run_id == run_id)
    result = db.execute(stmt)
    clusters = result.scalars().all()

    if not clusters:
        logger.error(f"No clusters found for run_id={run_id}")
        return

    logger.info(f"Found {len(clusters)} clusters to label")

    # Initialize labeler (loads model once)
    labeler = LocalClusterLabeler(model_name=model_name, device=device)

    # Process clusters
    labeled_count = 0
    skipped_count = 0

    for i, cluster in enumerate(clusters):
        try:
            # Skip if already labeled
            if cluster.ai_label is not None:
                logger.info(f"Skipping cluster {cluster.cluster_id} (already labeled)")
                skipped_count += 1
                continue

            logger.info(f"\n[{i+1}/{len(clusters)}] Labeling cluster {cluster.cluster_id}...")
            logger.info(f"  Location: {cluster.neighborhood or ''} {cluster.city}")
            logger.info(f"  Size: {cluster.size} businesses")
            logger.info(f"  Label: {cluster.cluster_label}")

            # Load businesses in this cluster
            stmt = (
                select(Business)
                .join(BusinessCluster)
                .where(BusinessCluster.cluster_id == cluster.cluster_id)
                .limit(10)  # Limit samples for faster processing
            )
            result = db.execute(stmt)
            businesses = result.scalars().all()

            if not businesses:
                logger.warning(f"No businesses found for cluster {cluster.cluster_id}")
                continue

            # Generate label
            label_result = labeler.generate_cluster_label(cluster, businesses)

            # Update cluster
            cluster.ai_label = label_result.get('label')
            cluster.ai_description = label_result.get('description')
            cluster.ai_key_characteristics = label_result.get('key_characteristics')
            cluster.attribute_patterns = label_result.get('attribute_patterns')

            labeled_count += 1

            # Commit in batches
            if labeled_count % batch_size == 0:
                logger.info(f"\nCommitting batch ({labeled_count} clusters labeled)...")
                db.commit()

        except Exception as e:
            logger.error(f"Error labeling cluster {cluster.cluster_id}: {e}", exc_info=True)
            continue

    # Final commit
    logger.info("\nCommitting final batch...")
    db.commit()

    logger.info(f"\n{'='*80}")
    logger.info(f"LABELING COMPLETE")
    logger.info(f"  Labeled: {labeled_count} clusters")
    logger.info(f"  Skipped: {skipped_count} clusters")
    logger.info(f"  Total: {len(clusters)} clusters")
    logger.info(f"{'='*80}\n")


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Generate labels for business clusters using local TinyLlama'
    )
    parser.add_argument(
        '--run-id',
        type=int,
        required=True,
        help='ClusterRun ID to label'
    )
    parser.add_argument(
        '--model',
        type=str,
        default='microsoft/phi-2',
        help='HuggingFace model name (default: microsoft/phi-2)'
    )
    parser.add_argument(
        '--device',
        type=str,
        default='auto',
        choices=['auto', 'cuda', 'cpu'],
        help='Device to run on (default: auto)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=10,
        help='Number of clusters to label before committing (default: 10)'
    )

    args = parser.parse_args()

    # Check if CUDA is available if requested
    if args.device == 'cuda' and not torch.cuda.is_available():
        logger.warning("CUDA requested but not available, falling back to CPU")
        args.device = 'cpu'

    # Get database session
    db = next(get_db())

    try:
        label_cluster_run(
            args.run_id,
            db,
            model_name=args.model,
            device=args.device,
            batch_size=args.batch_size
        )

        logger.info("\n✓ Labeling complete!")

    except Exception as e:
        logger.error(f"Labeling failed: {e}", exc_info=True)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == '__main__':
    main()
