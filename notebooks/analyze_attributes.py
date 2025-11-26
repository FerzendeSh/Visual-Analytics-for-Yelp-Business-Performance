"""
Business Attributes Analysis Script
Goal: Identify which attributes to keep for clustering analysis
"""
import json
import pandas as pd
from collections import Counter
import ast

# Load all businesses from JSONL file
print("Loading businesses...")
businesses = []
with open('subset_businesses.json', 'r') as f:
    for line in f:
        businesses.append(json.loads(line))

total_businesses = len(businesses)
print(f"Total businesses loaded: {total_businesses}\n")

# Count attribute occurrences
print("="*80)
print("PHASE 1: ATTRIBUTE COVERAGE ANALYSIS")
print("="*80)

attribute_counts = Counter()
for business in businesses:
    if business.get('attributes'):
        for attr_name in business['attributes'].keys():
            attribute_counts[attr_name] += 1

# Convert to DataFrame for analysis
attr_df = pd.DataFrame([
    {
        'attribute': attr,
        'count': count,
        'coverage_pct': (count / total_businesses) * 100
    }
    for attr, count in attribute_counts.items()
]).sort_values('coverage_pct', ascending=False)

print(f"\nTotal unique attributes: {len(attr_df)}")
print(f"\nAttribute Coverage Summary:")
print(attr_df.to_string(index=False))

print(f"\nAttributes with >=80% coverage: {len(attr_df[attr_df['coverage_pct'] >= 80])}")
print(f"Attributes with 50-80% coverage: {len(attr_df[(attr_df['coverage_pct'] >= 50) & (attr_df['coverage_pct'] < 80)])}")
print(f"Attributes with <50% coverage: {len(attr_df[attr_df['coverage_pct'] < 50])}")

# Analyze attribute values
print("\n" + "="*80)
print("PHASE 2: ATTRIBUTE DATA TYPES AND VALUES")
print("="*80)

def analyze_attribute_values(businesses, attr_name):
    """Analyze the values of a specific attribute"""
    values = []
    value_types = Counter()

    for business in businesses:
        if business.get('attributes') and attr_name in business['attributes']:
            value = business['attributes'][attr_name]
            values.append(value)

            # Determine type
            if isinstance(value, str):
                if value.startswith('{') or value.startswith('['):
                    value_types['nested_structure'] += 1
                elif value in ['True', 'False']:
                    value_types['boolean_string'] += 1
                elif value.startswith("u'") or value.startswith("'"):
                    value_types['quoted_string'] += 1
                else:
                    value_types['string'] += 1
            else:
                value_types[type(value).__name__] += 1

    return {
        'total_count': len(values),
        'value_types': dict(value_types),
        'unique_values': len(set(str(v) for v in values)),
        'sample_values': list(set(str(v) for v in values[:100]))[:10]
    }

# Analyze top 20 attributes
top_attributes = attr_df.head(20)['attribute'].tolist()
attribute_analysis = {}

for attr in top_attributes:
    attribute_analysis[attr] = analyze_attribute_values(businesses, attr)

for attr, analysis in attribute_analysis.items():
    print(f"\n{'='*60}")
    print(f"Attribute: {attr}")
    print(f"Total Count: {analysis['total_count']}")
    print(f"Unique Values: {analysis['unique_values']}")
    print(f"Value Types: {analysis['value_types']}")
    print(f"Sample Values: {analysis['sample_values'][:5]}")

# Identify nested attributes
print("\n" + "="*80)
print("PHASE 3: NESTED ATTRIBUTES ANALYSIS")
print("="*80)

nested_attributes = []
for attr, analysis in attribute_analysis.items():
    if 'nested_structure' in analysis['value_types']:
        nested_attributes.append(attr)

print(f"\nAttributes with nested structures: {nested_attributes}")

# Analyze nested structures in detail
for attr in nested_attributes:
    print(f"\n\n{attr} - Nested Structure Analysis:")
    print("="*60)

    # Get sample values
    samples = []
    for business in businesses[:200]:
        if business.get('attributes') and attr in business['attributes']:
            value = business['attributes'][attr]
            if isinstance(value, str) and (value.startswith('{') or value.startswith('[')):
                try:
                    parsed = ast.literal_eval(value)
                    samples.append(parsed)
                except:
                    pass

    if samples:
        print(f"Sample parsed values (first 5):")
        for i, sample in enumerate(samples[:5], 1):
            print(f"{i}. {sample}")

        # If it's a dict, show all keys
        if isinstance(samples[0], dict):
            all_keys = set()
            for s in samples:
                if isinstance(s, dict):
                    all_keys.update(s.keys())
            print(f"\nAll sub-keys found: {sorted(all_keys)}")

# Recommendations
print("\n" + "="*80)
print("PHASE 4: ATTRIBUTE SELECTION RECOMMENDATIONS")
print("="*80)

print("\n[HIGH PRIORITY] - Include (>=80% coverage):")
high_priority = attr_df[attr_df['coverage_pct'] >= 80]
for _, row in high_priority.iterrows():
    attr = row['attribute']
    analysis = attribute_analysis.get(attr, {})
    value_types = analysis.get('value_types', {})
    print(f"  - {attr} ({row['coverage_pct']:.1f}%) - Types: {value_types}")

print("\n[MEDIUM PRIORITY] - Consider (50-80% coverage):")
medium_priority = attr_df[(attr_df['coverage_pct'] >= 50) & (attr_df['coverage_pct'] < 80)]
for _, row in medium_priority.iterrows():
    attr = row['attribute']
    analysis = attribute_analysis.get(attr, {})
    value_types = analysis.get('value_types', {})
    print(f"  - {attr} ({row['coverage_pct']:.1f}%) - Types: {value_types}")

print("\n[LOW PRIORITY] - Likely Exclude (<50% coverage):")
low_priority = attr_df[attr_df['coverage_pct'] < 50]
for _, row in low_priority.iterrows():
    print(f"  - {row['attribute']} ({row['coverage_pct']:.1f}%)")

print("\n\n[NESTED ATTRIBUTES] REQUIRING FLATTENING:")
for attr in nested_attributes:
    coverage = attr_df[attr_df['attribute'] == attr]['coverage_pct'].values[0]
    print(f"  - {attr} ({coverage:.1f}%) - Needs sub-attribute extraction")

# Save results
print("\n" + "="*80)
print("Saving results...")
attr_df.to_csv('attribute_coverage_analysis.csv', index=False)
print("[SAVED] Attribute coverage saved to 'attribute_coverage_analysis.csv'")

with open('attribute_detailed_analysis.json', 'w') as f:
    json.dump(attribute_analysis, f, indent=2)
print("[SAVED] Detailed analysis saved to 'attribute_detailed_analysis.json'")

print("\n" + "="*80)
print("ANALYSIS COMPLETE!")
print("="*80)
