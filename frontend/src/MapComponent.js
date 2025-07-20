import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

// Fix for default marker icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom icons for different severity levels
const severityIcons = {
  Low: new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [20, 32],
    iconAnchor: [10, 32],
    popupAnchor: [0, -32],
    className: 'severity-low'
  }),
  Medium: new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    className: 'severity-medium'
  }),
  Severe: new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [30, 50],
    iconAnchor: [15, 50],
    popupAnchor: [0, -50],
    className: 'severity-severe'
  })
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_URL = `${BACKEND_URL}/api/reports`;

function LocationMarker({ setReports, reports }) {
  const [isReporting, setIsReporting] = useState(false);

  useMapEvents({
    click(e) {
      if (isReporting) return; // Prevent multiple clicks
      
      const { lat, lng } = e.latlng;
      
      // Show severity selection modal
      const severity = window.prompt(
        "Select severity level:\n• Low - Minor puddles, passable\n• Medium - Significant water, slow traffic\n• Severe - Deep water, avoid area\n\nEnter: Low, Medium, or Severe", 
        "Medium"
      );
      
      if (severity && ['Low', 'Medium', 'Severe'].includes(severity)) {
        setIsReporting(true);
        
        axios.post(API_URL, { lat, lng, severity })
          .then(response => {
            // Add new report to the map instantly
            setReports(prevReports => [...prevReports, response.data]);
            alert(`✅ Waterlogging report submitted successfully!\nLocation: ${lat.toFixed(4)}, ${lng.toFixed(4)}\nSeverity: ${severity}`);
          })
          .catch(error => {
            console.error("Error posting report:", error);
            alert("❌ Failed to submit report. Please try again.");
          })
          .finally(() => {
            setIsReporting(false);
          });
      }
    }
  });
  
  return null;
}

const MapComponent = () => {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Default position centered on India
  const position = [20.5937, 78.9629];

  const fetchReports = async () => {
    try {
      const response = await axios.get(API_URL);
      setReports(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    
    // Refresh reports every 30 seconds
    const interval = setInterval(fetchReports, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Low': return '#28a745'; // Green
      case 'Medium': return '#ffc107'; // Yellow
      case 'Severe': return '#dc3545'; // Red
      default: return '#007bff'; // Blue
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading waterlogging reports...</p>
      </div>
    );
  }

  return (
    <div className="map-wrapper">
      <div className="map-info">
        <div className="report-count">
          📍 {reports.length} active reports
          {lastUpdated && (
            <span className="last-updated">
              • Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="severity-legend">
          <span className="legend-title">Severity:</span>
          <span className="legend-item" style={{color: getSeverityColor('Low')}}>
            🟢 Low
          </span>
          <span className="legend-item" style={{color: getSeverityColor('Medium')}}>
            🟡 Medium
          </span>
          <span className="legend-item" style={{color: getSeverityColor('Severe')}}>
            🔴 Severe
          </span>
        </div>
        <button 
          className="refresh-btn"
          onClick={fetchReports}
          title="Refresh reports"
        >
          🔄 Refresh
        </button>
      </div>
      
      <MapContainer 
        center={position} 
        zoom={6} 
        className="leaflet-map"
        style={{ height: '70vh', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {reports.map(report => (
          <Marker 
            key={report.id} 
            position={[report.lat, report.lng]}
            icon={severityIcons[report.severity] || severityIcons.Medium}
          >
            <Popup>
              <div className="popup-content">
                <h3 style={{color: getSeverityColor(report.severity), margin: '0 0 8px 0'}}>
                  {report.severity === 'Low' && '🟢'} 
                  {report.severity === 'Medium' && '🟡'} 
                  {report.severity === 'Severe' && '🔴'} 
                  {report.severity} Waterlogging
                </h3>
                <p className="popup-details">
                  📍 <strong>Location:</strong><br/>
                  {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                </p>
                <p className="popup-details">
                  🕒 <strong>Reported:</strong><br/>
                  {formatTime(report.created_at)}
                </p>
                <p className="popup-warning">
                  {report.severity === 'Severe' && '⚠️ Avoid this area - deep water reported'}
                  {report.severity === 'Medium' && '⚡ Use caution - significant waterlogging'}
                  {report.severity === 'Low' && '✓ Passable with care - minor waterlogging'}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        <LocationMarker setReports={setReports} reports={reports} />
      </MapContainer>
      
      <div className="map-instructions">
        <p>
          💡 <strong>How to use:</strong> Click anywhere on the map to report waterlogging. 
          Choose severity level to help others navigate safely. Reports auto-expire after 24 hours.
        </p>
      </div>
    </div>
  );
};

export default MapComponent;