import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
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

// Component for handling location centering
function LocationMarker({ setReports, reports, userLocation }) {
  const map = useMap();
  const [isReporting, setIsReporting] = useState(false);

  // Center map on user location when available
  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 12);
    }
  }, [userLocation, map]);

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
  
  return userLocation ? (
    <Marker position={[userLocation.lat, userLocation.lng]} icon={new L.Icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iOCIgZmlsbD0iIzAwN2JmZiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjMiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })}>
      <Popup>📍 Your Location</Popup>
    </Marker>
  ) : null;
}

// Comments Component
function CommentsSection({ reportId, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [author, setAuthor] = useState('Anonymous');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [reportId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/${reportId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_URL}/${reportId}/comments`, {
        text: newComment.trim(),
        author: author.trim() || 'Anonymous'
      });
      setComments([...comments, response.data]);
      setNewComment('');
      setAuthor('Anonymous');
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="comments-modal">
      <div className="comments-content">
        <div className="comments-header">
          <h3>💬 Comments & Updates</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        
        <div className="comments-list">
          {isLoading ? (
            <div className="loading">Loading comments...</div>
          ) : comments.length > 0 ? (
            comments.map(comment => (
              <div key={comment.id} className="comment">
                <div className="comment-author">{comment.author}</div>
                <div className="comment-text">{comment.text}</div>
                <div className="comment-time">
                  {new Date(comment.created_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="no-comments">No comments yet. Be the first to add context!</div>
          )}
        </div>

        <form onSubmit={submitComment} className="comment-form">
          <input
            type="text"
            placeholder="Your name (optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="author-input"
            maxLength="50"
          />
          <textarea
            placeholder="Add context: water depth, road conditions, traffic status..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="comment-input"
            maxLength="200"
            rows="3"
            required
          />
          <div className="comment-form-footer">
            <span className="char-count">{newComment.length}/200</span>
            <button 
              type="submit" 
              disabled={isSubmitting || !newComment.trim()}
              className="submit-comment-btn"
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const MapComponent = () => {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeFilter, setTimeFilter] = useState('24h');
  const [viewMode, setViewMode] = useState('markers'); // 'markers' or 'heatmap'
  const [userLocation, setUserLocation] = useState(null);
  const [showComments, setShowComments] = useState(null);
  
  // Default position centered on India
  const position = [20.5937, 78.9629];

  const fetchReports = async (filter = timeFilter) => {
    try {
      const response = await axios.get(`${API_URL}?time_filter=${filter}`);
      setReports(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Unable to get your location. Please enable location services.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const voteOnReport = async (reportId, voteType) => {
    try {
      await axios.post(`${API_URL}/${reportId}/vote`, { vote_type: voteType });
      // Refresh reports to show updated votes
      fetchReports();
    } catch (error) {
      console.error("Error voting:", error);
      alert("Failed to record vote. Please try again.");
    }
  };

  useEffect(() => {
    fetchReports();
    
    // Refresh reports every 30 seconds
    const interval = setInterval(() => fetchReports(), 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchReports(timeFilter);
  }, [timeFilter]);

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

  const getSeverityWeight = (severity) => {
    switch (severity) {
      case 'Low': return 0.3;
      case 'Medium': return 0.6;
      case 'Severe': return 1.0;
      default: return 0.5;
    }
  };

  // Prepare heatmap data
  const heatmapData = reports.map(report => ({
    lat: report.lat,
    lng: report.lng,
    intensity: getSeverityWeight(report.severity)
  }));

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
      <div className="map-controls">
        <div className="map-info">
          <div className="report-count">
            📍 {reports.length} active reports
            {lastUpdated && (
              <span className="last-updated">
                • Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          <div className="control-group">
            <select 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="time-filter"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
            </select>
            
            <div className="view-toggle">
              <button 
                className={viewMode === 'markers' ? 'active' : ''}
                onClick={() => setViewMode('markers')}
              >
                📍 Markers
              </button>
              <button 
                className={viewMode === 'heatmap' ? 'active' : ''}
                onClick={() => setViewMode('heatmap')}
              >
                🔥 Heatmap
              </button>
            </div>
          </div>

          <div className="action-buttons">
            <button 
              className="location-btn"
              onClick={getUserLocation}
              title="Center on my location"
            >
              📍 My Location
            </button>
            <button 
              className="refresh-btn"
              onClick={() => fetchReports()}
              title="Refresh reports"
            >
              🔄 Refresh
            </button>
          </div>
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
        
        {/*viewMode === 'heatmap' && heatmapData.length > 0 && (
          <HeatmapLayer
            fitBoundsOnLoad
            fitBoundsOnUpdate
            points={heatmapData}
            longitudeExtractor={m => m.lng}
            latitudeExtractor={m => m.lat}
            intensityExtractor={m => m.intensity}
            radius={20}
            max={1}
          />
        )*/}
        
        {viewMode === 'markers' && reports.map(report => (
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
                
                <div className="accuracy-section">
                  <div className="accuracy-score">
                    <strong>Accuracy:</strong> {report.accuracy_score || 0} 
                    <span className="vote-count">({report.total_votes || 0} votes)</span>
                  </div>
                  <div className="vote-buttons">
                    <button 
                      onClick={() => voteOnReport(report.id, 'up')}
                      className="vote-btn up"
                      title="Accurate report"
                    >
                      👍
                    </button>
                    <button 
                      onClick={() => voteOnReport(report.id, 'down')}
                      className="vote-btn down"
                      title="Inaccurate report"
                    >
                      👎
                    </button>
                  </div>
                </div>
                
                <div className="popup-actions">
                  <button 
                    onClick={() => setShowComments(report.id)}
                    className="comments-btn"
                  >
                    💬 View Comments
                  </button>
                </div>
                
                <p className="popup-warning">
                  {report.severity === 'Severe' && '⚠️ Avoid this area - deep water reported'}
                  {report.severity === 'Medium' && '⚡ Use caution - significant waterlogging'}
                  {report.severity === 'Low' && '✓ Passable with care - minor waterlogging'}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        <LocationMarker 
          setReports={setReports} 
          reports={reports} 
          userLocation={userLocation}
        />
      </MapContainer>
      
      {showComments && (
        <CommentsSection 
          reportId={showComments}
          onClose={() => setShowComments(null)}
        />
      )}
      
      <div className="map-instructions">
        <p>
          💡 <strong>How to use:</strong> Click anywhere on the map to report waterlogging. 
          Toggle between marker and heatmap views. Filter by time, vote on accuracy, and add comments for context. 
          Reports auto-expire after 24 hours.
        </p>
      </div>
    </div>
  );
};

export default MapComponent;