import React, { useState, useMemo, useRef } from 'react';
import Map, { Marker, Popup, MapRef } from 'react-map-gl/maplibre';
import Supercluster from 'supercluster';
import 'maplibre-gl/dist/maplibre-gl.css';
import './BusinessMap.css';

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

interface BusinessMapProps {
  businesses: Business[];
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
}

type PointFeature = GeoJSON.Feature<GeoJSON.Point, Business>;

const BusinessMap: React.FC<BusinessMapProps> = ({
  businesses,
  initialViewState = {
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 3.5
  }
}) => {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<Business | null>(null);
  const [viewport, setViewport] = useState({
    ...initialViewState
  });

  // Create supercluster index
  const supercluster = useMemo(() => {
    const validBusinesses = businesses.filter(
      business =>
        business.latitude &&
        business.longitude &&
        !isNaN(business.latitude) &&
        !isNaN(business.longitude)
    );

    const points: PointFeature[] = validBusinesses.map(business => ({
      type: 'Feature',
      properties: business,
      geometry: {
        type: 'Point',
        coordinates: [business.longitude, business.latitude]
      }
    }));

    const cluster = new Supercluster<Business>({
      radius: 75,
      maxZoom: 20
    });

    cluster.load(points);
    return cluster;
  }, [businesses]);

  // Get clusters for current viewport
  const clusters = useMemo(() => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) {
      return supercluster.getClusters([-180, -85, 180, 85], Math.floor(viewport.zoom));
    }

    return supercluster.getClusters(
      [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ],
      Math.floor(viewport.zoom)
    );
  }, [supercluster, viewport]);

  const totalBusinesses = useMemo(() => {
    return businesses.filter(
      business =>
        business.latitude &&
        business.longitude &&
        !isNaN(business.latitude) &&
        !isNaN(business.longitude)
    ).length;
  }, [businesses]);

  return (
    <div className="business-map-container">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        onMove={(evt) => setViewport(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
      >
        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = cluster.properties as any;

          if (isCluster) {
            // Render cluster marker
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={longitude}
                latitude={latitude}
                anchor="center"
                onClick={() => {
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(cluster.id as number),
                    20
                  );
                  mapRef.current?.flyTo({
                    center: [longitude, latitude],
                    zoom: expansionZoom,
                    duration: 500
                  });
                }}
              >
                <div className="cluster-marker" style={{
                  width: `${30 + (pointCount / totalBusinesses) * 50}px`,
                  height: `${30 + (pointCount / totalBusinesses) * 50}px`,
                }}>
                  {pointCount}
                </div>
              </Marker>
            );
          }

          // Render individual business marker
          const business = cluster.properties as Business;
          return (
            <Marker
              key={`business-${business.business_id}`}
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupInfo(business);
              }}
            >
              <div className="marker">
                <div
                  className={`marker-pin ${business.is_open ? 'open' : 'closed'}`}
                  title={business.name}
                >
                  <span className="marker-star">{business.stars}</span>
                </div>
              </div>
            </Marker>
          );
        })}

        {popupInfo && (
          <Popup
            anchor="top"
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
          >
            <div className="business-popup">
              <h3>{popupInfo.name}</h3>
              <div className="popup-details">
                <p className="popup-location">
                  {popupInfo.city}, {popupInfo.state}
                </p>
                <p className="popup-rating">
                  Rating: <strong>{popupInfo.stars}</strong> ({popupInfo.review_count} reviews)
                </p>
                <p className="popup-status">
                  Status: <span className={popupInfo.is_open ? 'status-open' : 'status-closed'}>
                    {popupInfo.is_open ? 'Open' : 'Closed'}
                  </span>
                </p>
                {popupInfo.categories && (
                  <p className="popup-categories">
                    {popupInfo.categories.split(',').slice(0, 3).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      <div className="map-info">
        <p>Showing {totalBusinesses} businesses</p>
      </div>
    </div>
  );
};

export default BusinessMap;
