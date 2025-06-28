import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPinIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  LocationMarkerIcon
} from '@heroicons/react/outline';

interface Location {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  type: 'station' | 'signal' | 'maintenance' | 'emergency';
  status: 'active' | 'inactive' | 'warning' | 'critical';
  lastUpdate: Date;
  description?: string;
}

interface Operator {
  id: string;
  name: string;
  role: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  status: 'online' | 'offline' | 'busy' | 'emergency';
  lastSeen: Date;
  currentTask?: string;
}

interface GeolocationComponentProps {
  locations: Location[];
  operators: Operator[];
  onLocationSelect: (location: Location) => void;
  onOperatorSelect: (operator: Operator) => void;
}

const GeolocationComponent: React.FC<GeolocationComponentProps> = ({
  locations,
  operators,
  onLocationSelect,
  onOperatorSelect
}) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 48.8566, lng: 2.3522 }); // Paris par défaut
  const [zoom, setZoom] = useState(10);
  const [showOperators, setShowOperators] = useState(true);
  const [showLocations, setShowLocations] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const mapRef = useRef<HTMLDivElement>(null);

  // Obtenir la position de l'utilisateur
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setMapCenter({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('Erreur de géolocalisation:', error);
        }
      );
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'online':
        return 'bg-green-500';
      case 'inactive':
      case 'offline':
        return 'bg-gray-500';
      case 'warning':
      case 'busy':
        return 'bg-yellow-500';
      case 'critical':
      case 'emergency':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'station':
        return '🏢';
      case 'signal':
        return '🚦';
      case 'maintenance':
        return '🔧';
      case 'emergency':
        return '🚨';
      default:
        return '📍';
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location);
    setSelectedOperator(null);
    onLocationSelect(location);
  };

  const handleOperatorClick = (operator: Operator) => {
    setSelectedOperator(operator);
    setSelectedLocation(null);
    onOperatorSelect(operator);
  };

  const filteredLocations = locations.filter(location => 
    filterType === 'all' || location.type === filterType
  );

  const filteredOperators = operators.filter(operator => 
    filterType === 'all' || operator.status === filterType
  );

  return (
    <div className="h-full flex flex-col">
      {/* En-tête avec contrôles */}
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Géolocalisation
          </h2>
          
          <div className="flex items-center space-x-4">
            {/* Filtres */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Tous</option>
              <option value="station">Stations</option>
              <option value="signal">Signaux</option>
              <option value="maintenance">Maintenance</option>
              <option value="emergency">Urgences</option>
            </select>

            {/* Boutons de visibilité */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowLocations(!showLocations)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showLocations
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <LocationMarkerIcon className="w-4 h-4 inline mr-1" />
                Lieux
              </button>
              
              <button
                onClick={() => setShowOperators(!showOperators)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showOperators
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <UserIcon className="w-4 h-4 inline mr-1" />
                Opérateurs
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {locations.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Lieux</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {operators.filter(op => op.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">En ligne</div>
          </div>
          
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {locations.filter(loc => loc.status === 'warning').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Alertes</div>
          </div>
          
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {locations.filter(loc => loc.status === 'critical').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Critiques</div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex">
        {/* Carte */}
        <div className="flex-1 relative">
          <div
            ref={mapRef}
            className="w-full h-full bg-gray-100 dark:bg-gray-900 relative overflow-hidden"
          >
            {/* Carte de base (simulation) */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 dark:from-gray-800 dark:to-gray-900">
              {/* Grille de fond */}
              <div className="absolute inset-0 opacity-20">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute border border-gray-300 dark:border-gray-600"
                    style={{
                      left: `${i * 5}%`,
                      top: 0,
                      width: '1px',
                      height: '100%'
                    }}
                  />
                ))}
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute border border-gray-300 dark:border-gray-600"
                    style={{
                      top: `${i * 5}%`,
                      left: 0,
                      height: '1px',
                      width: '100%'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Marqueurs des lieux */}
            {showLocations && filteredLocations.map((location) => (
              <div
                key={location.id}
                onClick={() => handleLocationClick(location)}
                className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110 ${
                  selectedLocation?.id === location.id ? 'z-20' : 'z-10'
                }`}
                style={{
                  left: `${((location.coordinates.lng + 180) / 360) * 100}%`,
                  top: `${((90 - location.coordinates.lat) / 180) * 100}%`
                }}
              >
                <div className={`relative ${selectedLocation?.id === location.id ? 'animate-pulse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 shadow-lg flex items-center justify-center text-lg ${getStatusColor(location.status)}`}>
                    {getTypeIcon(location.type)}
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                    {location.name}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            ))}

            {/* Marqueurs des opérateurs */}
            {showOperators && filteredOperators.map((operator) => (
              <div
                key={operator.id}
                onClick={() => handleOperatorClick(operator)}
                className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110 ${
                  selectedOperator?.id === operator.id ? 'z-20' : 'z-10'
                }`}
                style={{
                  left: `${((operator.coordinates.lng + 180) / 360) * 100}%`,
                  top: `${((90 - operator.coordinates.lat) / 180) * 100}%`
                }}
              >
                <div className={`relative ${selectedOperator?.id === operator.id ? 'animate-pulse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 shadow-lg flex items-center justify-center text-xs font-bold ${getStatusColor(operator.status)}`}>
                    👤
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                    {operator.name}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            ))}

            {/* Position de l'utilisateur */}
            {userLocation && (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30"
                style={{
                  left: `${((userLocation.lng + 180) / 360) * 100}%`,
                  top: `${((90 - userLocation.lat) / 180) * 100}%`
                }}
              >
                <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-ping"></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg absolute top-0 left-0"></div>
              </div>
            )}
          </div>

          {/* Contrôles de la carte */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            <button
              onClick={() => setZoom(Math.min(zoom + 1, 20))}
              className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              +
            </button>
            <button
              onClick={() => setZoom(Math.max(zoom - 1, 1))}
              className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              −
            </button>
            {userLocation && (
              <button
                onClick={() => setMapCenter(userLocation)}
                className="w-10 h-10 bg-blue-600 rounded-lg shadow-lg flex items-center justify-center text-white hover:bg-blue-700"
              >
                <MapPinIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Panneau latéral */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          {selectedLocation ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedLocation.name}
                </h3>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(selectedLocation.status)}`}></span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {selectedLocation.status}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{getTypeIcon(selectedLocation.type)}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {selectedLocation.type}
                  </span>
                </div>

                {selectedLocation.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedLocation.description}
                  </p>
                )}

                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <ClockIcon className="w-4 h-4" />
                  <span>
                    Dernière mise à jour: {selectedLocation.lastUpdate.toLocaleTimeString('fr-FR')}
                  </span>
                </div>

                {userLocation && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Distance: {calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      selectedLocation.coordinates.lat,
                      selectedLocation.coordinates.lng
                    ).toFixed(1)} km
                  </div>
                )}
              </div>
            </div>
          ) : selectedOperator ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedOperator.name}
                </h3>
                <button
                  onClick={() => setSelectedOperator(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(selectedOperator.status)}`}></span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {selectedOperator.status}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Rôle: {selectedOperator.role}
                </div>

                {selectedOperator.currentTask && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Tâche actuelle: {selectedOperator.currentTask}
                  </div>
                )}

                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <ClockIcon className="w-4 h-4" />
                  <span>
                    Dernière activité: {selectedOperator.lastSeen.toLocaleTimeString('fr-FR')}
                  </span>
                </div>

                {userLocation && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Distance: {calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      selectedOperator.coordinates.lat,
                      selectedOperator.coordinates.lng
                    ).toFixed(1)} km
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Informations
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cliquez sur un marqueur pour voir les détails
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeolocationComponent; 