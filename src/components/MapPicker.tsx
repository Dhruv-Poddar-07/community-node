import React, { useEffect, useRef, useState } from 'react';

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number, locationName?: string) => void;
  initialLat?: number;
  initialLng?: number;
}

const MapPicker: React.FC<MapPickerProps> = ({ 
  onLocationSelect, 
  initialLat = 20.5937, 
  initialLng = 78.9629 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Initialize map
    const map = window.L.map(mapRef.current).setView([initialLat, initialLng], 5);
    
    // Add OpenStreetMap tile layer
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Handle map click
    map.on('click', async (e: any) => {
      const { lat, lng } = e.latlng;
      
      // Remove existing marker
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      // Add new marker
      const marker = window.L.marker([lat, lng]).addTo(map);
      markerRef.current = marker;

      // Get location name via reverse geocoding
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`
        );
        const data = await response.json();
        
        let locationName = 'Location selected ✓';
        if (data && data.display_name) {
          // Extract city, state from the full address
          const parts = data.display_name.split(',');
          if (parts.length >= 2) {
            locationName = `${parts[parts.length - 3]?.trim()}, ${parts[parts.length - 2]?.trim()}`;
          } else {
            locationName = data.display_name;
          }
        }
        
        const location = { lat, lng, name: locationName };
        setSelectedLocation(location);
        onLocationSelect(lat, lng, locationName);
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
        const location = { lat, lng, name: 'Location selected ✓' };
        setSelectedLocation(location);
        onLocationSelect(lat, lng, location.name);
      } finally {
        setIsLoading(false);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, [initialLat, initialLng, onLocationSelect]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        <p className="font-medium">Click on the map to set the exact location</p>
      </div>
      
      <div 
        ref={mapRef} 
        className="w-full h-64 rounded-lg border border-gray-300"
        style={{ cursor: 'crosshair' }}
      />
      
      {selectedLocation && (
        <div className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg border border-green-200">
          {isLoading ? (
            <p className="text-green-600">Getting location details...</p>
          ) : (
            <div>
              <p className="font-medium text-green-800">Selected location: {selectedLocation.name}</p>
              <p className="text-xs text-gray-600 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
          )}
        </div>
      )}
      
      {!selectedLocation && (
        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <p>Click anywhere on the map to select the location</p>
        </div>
      )}
    </div>
  );
};

export default MapPicker;
