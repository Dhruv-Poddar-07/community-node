import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

// Add global Leaflet type declaration
declare global {
  interface Window {
    L: any;
  }
}

interface Need {
  id: string;
  title: string;
  description: string;
  city: string;
  requiredSkill: string;
  urgency: string;
  lat: number;
  lng: number;
}

const InteractiveMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Load Leaflet dynamically
    const L = window.L;
    if (!L || !mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Fetch needs from Firestore and add markers
    const q = query(collection(db, 'needs'), where('status', 'in', ['open', 'assigned']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Clear existing markers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });
      
      // Add markers for each need
      snapshot.docs.forEach((doc) => {
        const need = { id: doc.id, ...doc.data() } as Need;
        if (need.lat && need.lng) {
          const marker = L.marker([need.lat, need.lng]).addTo(map);
          marker.bindPopup(`
            <b>${need.title}</b><br/>
            ${need.description}<br/>
            City: ${need.city}<br/>
            Skill: ${need.requiredSkill}<br/>
            Urgency: ${need.urgency}
          `);
        }
      });
    });

    return () => {
      unsubscribe();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return <div ref={mapRef} style={{ height: '500px', width: '100%' }} />;
};

export default InteractiveMap;
