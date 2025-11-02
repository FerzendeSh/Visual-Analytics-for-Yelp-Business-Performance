import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout';
import { BusinessMap } from '../components/map';

interface Business {
  business_id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  review_count: number;
  stars: number;
  categories: string;
  is_open: number;
}

const Home: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        setLoading(true);
        // Fetch from public directory
        const response = await fetch('/subset_businesses.json');

        if (!response.ok) {
          throw new Error('Failed to load business data');
        }

        const text = await response.text();
        const lines = text.trim().split('\n');
        const parsedBusinesses = lines.map(line => JSON.parse(line));

        setBusinesses(parsedBusinesses);
        setError(null);
      } catch (err) {
        console.error('Error loading businesses:', err);
        setError(err instanceof Error ? err.message : 'Failed to load businesses');
      } finally {
        setLoading(false);
      }
    };

    loadBusinesses();
  }, []);

  return (
    <Layout
      title="Yelp Business Analytics Dashboard"
      subtitle="Explore businesses across the United States"
      showSidebar={true}
    >
      <div style={{ padding: '1rem' }}>
        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Business Locations Map</h3>

          {loading && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#718096',
              background: '#f7fafc',
              borderRadius: '8px'
            }}>
              Loading business data...
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '8px',
              color: '#c53030'
            }}>
              Error: {error}
            </div>
          )}

          {!loading && !error && (
            <BusinessMap businesses={businesses} />
          )}
        </section>

        <nav style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Quick Navigation</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '1rem' }}>
              <Link
                to="/dashboard"
                style={{
                  fontSize: '1.1rem',
                  color: '#667eea',
                  textDecoration: 'none',
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  backgroundColor: 'rgba(102, 126, 234, 0.2)',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
              >
                Go to Dashboard →
              </Link>
            </li>
            <li>
              <Link
                to="/analytics"
                style={{
                  fontSize: '1.1rem',
                  color: '#667eea',
                  textDecoration: 'none',
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  backgroundColor: 'rgba(102, 126, 234, 0.2)',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
              >
                View Analytics →
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </Layout>
  );
};

export default Home;
