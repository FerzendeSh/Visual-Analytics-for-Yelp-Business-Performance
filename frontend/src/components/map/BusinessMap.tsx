import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  photo_count?: number;
}

interface BusinessMapProps {
  businesses: Business[];
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  onBusinessSelect?: (business: Business) => void;
  selectedCity?: string;
  selectedCategory?: string;
  selectedRating?: number | null;
  selectedStatus?: number | null;
  selectedBusiness?: Business | null;
}

type PointFeature = GeoJSON.Feature<GeoJSON.Point, Business>;

const BusinessMap: React.FC<BusinessMapProps> = ({
  businesses,
  initialViewState = {
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 3.5,},
  onBusinessSelect,
  selectedCity = "",
  selectedCategory = "",
  selectedRating = null,
  selectedStatus = null,
  selectedBusiness = null,
}) => {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<Business | null>(null);
  const [viewport, setViewport] = useState({ ...initialViewState });
  const previousCityRef = useRef<string>("");
  const viewportRef = useRef({ ...initialViewState });
  const isMapClickRef = useRef(false); // Track if selection came from map click

  //Filtered businesses based on dropdowns
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      const cityMatch = selectedCity ? b.city === selectedCity : true;
      const categoryMatch = selectedCategory
        ? b.categories?.toLowerCase().includes(selectedCategory.toLowerCase())
        : true;
      const ratingMatch = selectedRating ? b.stars == selectedRating : true;
      const statusMatch = selectedStatus !== null ? b.is_open === selectedStatus : true;

      return cityMatch && categoryMatch && ratingMatch && statusMatch;
    });
  }, [businesses, selectedCity, selectedCategory, selectedRating, selectedStatus]);

  //Supercluster built from filtered businesses
  const supercluster = useMemo(() => {
    const validBusinesses = filteredBusinesses.filter(
      (b) =>
        b.latitude &&
        b.longitude &&
        !isNaN(b.latitude) &&
        !isNaN(b.longitude)
    );

    const points: PointFeature[] = validBusinesses.map((b) => ({
      type: "Feature",
      properties: b,
      geometry: { type: "Point", coordinates: [b.longitude, b.latitude] },
    }));

    const cluster = new Supercluster<Business>({ radius: 75, maxZoom: 20 });
    cluster.load(points);
    return cluster;
  }, [filteredBusinesses]);

  // ✅ Get visible clusters
  const clusters = useMemo(() => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) {
      return supercluster.getClusters([-180, -85, 180, 85], Math.floor(viewport.zoom));
    }
    return supercluster.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      Math.floor(viewport.zoom)
    );
  }, [supercluster, viewport]);

  useEffect(() => {
    const previousCity = previousCityRef.current;

    if (previousCity === selectedCity) return;
    if (selectedCity !== "") {
      const cityBusinesses = businesses.filter(b => b.city === selectedCity);
      if (cityBusinesses.length > 0) {

        const lats = cityBusinesses.map(b => b.latitude).filter(lat => !isNaN(lat));
        const lngs = cityBusinesses.map(b => b.longitude).filter(lng => !isNaN(lng));

        if (lats.length > 0 && lngs.length > 0) {
          const avgLat = lats.reduce((a, b) => a + b) / lats.length;
          const avgLng = lngs.reduce((a, b) => a + b) / lngs.length;

          mapRef.current?.flyTo({
            center: [avgLng, avgLat],
            zoom: 11,
            duration: 700,
          });
        }
      }
    } else if (selectedCity === "" && previousCity !== "") {
      mapRef.current?.flyTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        duration: 700,
      });
    }
    previousCityRef.current = selectedCity;
  }, [selectedCity, businesses, initialViewState]);

 // Zoom to selected business when it changes
useEffect(() => {
  // Close popup and clear selection when selectedBusiness becomes null
  if (selectedBusiness === null) {
    setPopupInfo(null);
    isMapClickRef.current = false;
    return;
  }

  if (
    !selectedBusiness ||
    !selectedBusiness.latitude ||
    !selectedBusiness.longitude
  ) {
    return;
  }

  // Show popup when business is selected
  setPopupInfo(selectedBusiness);

  const map = mapRef.current;
  if (!map) return;

  // Skip zoom animation if user clicked directly on map marker
  // Map click selections don't need zoom animation
  if (isMapClickRef.current) {
    isMapClickRef.current = false;
    return;
  }

  const currentZoom = map.getZoom();

  // If we're already zoomed in close to the target location, don't animate zoom-out
  if (currentZoom > 11) {
    map.easeTo({
      center: [selectedBusiness.longitude, selectedBusiness.latitude],
      zoom: 16,
      duration: 300,
    });
  } else {
    // Zoom out slightly for movement then zoom in
    map.easeTo({
      zoom: 7,
      duration: 150,
    });

    setTimeout(() => {
      map.easeTo({
        center: [selectedBusiness.longitude, selectedBusiness.latitude],
        zoom: 17,
        duration: 300,
      });
    }, 160);
  }
}, [selectedBusiness]); // <- IMPORTANT: remove viewport.zoom

  const totalBusinesses = filteredBusinesses.length;

  const handleZoomIn = () => {
    mapRef.current?.easeTo({
      zoom: Math.min(viewportRef.current.zoom + 1, 20),
      duration: 300,
    });
  };

  const handleZoomOut = () => {
    mapRef.current?.easeTo({
      zoom: Math.max(viewportRef.current.zoom - 1, 0),
      duration: 300,
    });
  };

  const handleResetOrientation = () => {
    mapRef.current?.easeTo({
      bearing: 0,
      pitch: 0,
      duration: 500,
    });
  };

  // Keyboard controls for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow zoom with + and - keys
      if (e.key === '+' || e.key === '=' || e.key === 'Add') {
        e.preventDefault();
        mapRef.current?.easeTo({
          zoom: Math.min(viewportRef.current.zoom + 1, 20),
          duration: 300,
        });
      } else if (e.key === '-' || e.key === 'Subtract') {
        e.preventDefault();
        mapRef.current?.easeTo({
          zoom: Math.max(viewportRef.current.zoom - 1, 0),
          duration: 300,
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="business-map-container">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        onMove={(evt) => {
          setViewport(evt.viewState);
          viewportRef.current = evt.viewState;
        }}
        onClick={() => {
          setPopupInfo(null);
          onBusinessSelect?.(null as any);
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
      >
        {clusters.map((cluster: any) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = cluster.properties;

          if (isCluster) {
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
                    duration: 250,
                  });
                }}
              >
                <div
                  className="cluster-marker"
                  style={{
                    width: `${30 + (pointCount / totalBusinesses) * 50}px`,
                    height: `${30 + (pointCount / totalBusinesses) * 50}px`,
                  }}
                >
                  {pointCount}
                </div>
              </Marker>
            );
          }

          const business = cluster.properties as Business;
          return (
            <Marker
              key={`business-${business.business_id}`}
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                // Flag that this selection came from a map click (skip zoom animation)
                isMapClickRef.current = true;
                // Show popup IMMEDIATELY without waiting for parent state update
                setPopupInfo(business);
                // Update parent state asynchronously so popup appears instantly
                setTimeout(() => onBusinessSelect?.(business), 0);
              }}
            >
              <div className="marker">
                <div
                  className={`marker-pin ${business.is_open ? "open" : "closed"}`}
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
                  Status:{" "}
                  <span className={popupInfo.is_open ? "status-open" : "status-closed"}>
                    {popupInfo.is_open ? "Open" : "Closed"}
                  </span>
                </p>
                {popupInfo.categories && (
                  <p className="popup-categories">
                    {popupInfo.categories.split(",").slice(0, 3).join(", ")}
                  </p>
                )}
              </div>
            </div>
          </Popup>
        )}

        <div className="map-info">
          <p>{totalBusinesses} businesses</p>
        </div>

        <div className="map-controls">
          <button
            className="map-control-btn zoom-in-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <span className="control-icon">+</span>
          </button>
          <button
            className="map-control-btn zoom-out-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <span className="control-icon">−</span>
          </button>
          <button
            className="map-control-btn reset-orientation-btn"
            onClick={handleResetOrientation}
            title="Reset Orientation"
            aria-label="Reset Orientation"
          >
            <img src="/direction.png" alt="Reset Orientation" className="orientation-icon" />
          </button>
          <div className="zoom-level-display">
            <span className="zoom-level-label">Zoom:</span>
            <span className="zoom-level-value">{viewport.zoom.toFixed(1)}</span>
          </div>
        </div>
      </Map>
    </div>
  );
};

export default BusinessMap;