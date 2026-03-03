import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import type { Provider } from "@/data/mockData";

// Custom marker icon
const createCustomIcon = (name: string) => {
  const safeName = name.replace(/"/g, '&quot;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" fill="none" role="img" aria-label="${safeName}">
    <title>${safeName}</title>
    <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 26 16 26s16-16 16-26C32 7.163 24.837 0 16 0z" fill="hsl(143, 25%, 45%)"/>
    <circle cx="16" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "custom-map-marker",
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
};

interface DirectoryMapProps {
  locations: Provider[];
}

export function DirectoryMap({ locations }: DirectoryMapProps) {
  if (locations.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30 text-center p-8">
        <p className="text-lg font-medium text-muted-foreground">No GPS coordinates available</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Map pins will appear here once listings have GPS coordinates. Use the list view to browse all listings.
        </p>
      </div>
    );
  }

  return (
    <MapContainer
      center={[19.8968, -155.5828]}
      zoom={9}
      className="h-full w-full"
      scrollWheelZoom={true}
      style={{ minHeight: "400px" }}
      aria-label="Interactive map of wellness providers"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/" target="_blank" rel="noopener noreferrer">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={createCustomIcon(loc.name)}
          aria-label={`Map pin for ${loc.name}`}
        >
          <Popup>
            <div
              className="flex items-center gap-3 py-1 pr-2"
              style={{ minWidth: 200 }}
              role="dialog"
              aria-label={`Details for ${loc.name}`}
            >
              <img
                src={loc.image}
                alt={`Photo of ${loc.name}`}
                className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{loc.name}</p>
                <p className="text-xs text-gray-500">{loc.modality}</p>
                <p className="text-xs text-gray-400">{loc.location}</p>
                <Link
                  to={`/profile/${loc.id}`}
                  className="mt-1 inline-block text-xs font-medium"
                  style={{ color: "hsl(200, 70%, 25%)" }}
                  aria-label={`View profile for ${loc.name}`}
                >
                  View Profile →
                </Link>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
