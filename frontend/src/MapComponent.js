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

// Custom icons for different severity levels with photo indicator
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

// Photo Upload Modal Component
function PhotoUploadModal({ isOpen, onClose, onPhotoSelect }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
        setUseCamera(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setUseCamera(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        handlePhotoSelect(file);
      }, 'image/jpeg', 0.8);
    }
  };

  const handlePhotoSelect = (file) => {
    setSelectedPhoto(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    
    stopCamera();
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!selectedPhoto) return;

    setIsUploading(true);
    try {
      const base64 = await convertToBase64(selectedPhoto);
      onPhotoSelect(base64);
      onClose();
    } catch (error) {
      console.error('Error converting photo:', error);
      alert('Failed to process photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setSelectedPhoto(null);
    setPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="photo-modal">
      <div className="photo-modal-content">
        <div className="photo-modal-header">
          <h3>📸 Add Visual Proof</h3>
          <button onClick={handleClose} className="close-btn">✕</button>
        </div>

        <div className="photo-options">
          {!useCamera && !selectedPhoto && (
            <>
              <button onClick={startCamera} className="camera-btn">
                📷 Use Camera
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="file-btn">
                🖼️ Select Photo
              </button>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files[0] && handlePhotoSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />
        </div>

        {useCamera && (
          <div className="camera-section">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              className="camera-video"
            />
            <div className="camera-controls">
              <button onClick={capturePhoto} className="capture-btn">📷 Capture</button>
              <button onClick={stopCamera} className="cancel-camera-btn">Cancel</button>
            </div>
          </div>
        )}

        {preview && (
          <div className="photo-preview">
            <img src={preview} alt="Selected" className="preview-image" />
            <div className="preview-controls">
              <button 
                onClick={handleUpload} 
                disabled={isUploading}
                className="upload-photo-btn"
              >
                {isUploading ? 'Processing...' : 'Use This Photo'}
              </button>
              <button onClick={() => {setSelectedPhoto(null); setPreview(null);}} className="retake-btn">
                🔄 Choose Different Photo
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

// Enhanced Report Modal Component with Clear Options
function ReportModal({ isOpen, position, onClose, onSubmit }) {
  const [severity, setSeverity] = useState('Medium');
  const [photo, setPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportType, setReportType] = useState('quick'); // 'quick' or 'detailed'

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const reportData = {
        lat: position.lat,
        lng: position.lng,
        severity: severity,
        image_base64: photo
      };
      
      await onSubmit(reportData);
      
      // Reset form
      setSeverity('Medium');
      setPhoto(null);
      setReportType('quick');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSubmit = async () => {
    setIsSubmitting(true);
    try {
      const reportData = {
        lat: position.lat,
        lng: position.lng,
        severity: severity
        // No photo for quick submit
      };
      
      await onSubmit(reportData);
      
      // Reset form
      setSeverity('Medium');
      setPhoto(null);
      setReportType('quick');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="report-modal">
        <div className="report-modal-content">
          <div className="report-modal-header">
            <h3>🌊 Report Waterlogging</h3>
            <button onClick={onClose} className="close-btn">✕</button>
          </div>

          <div className="report-form">
            <div className="location-info">
              <p><strong>📍 Location:</strong></p>
              <p>{position?.lat.toFixed(4)}, {position?.lng.toFixed(4)}</p>
            </div>

            {/* Report Type Selection */}
            <div className="report-type-section">
              <label><strong>🚀 Choose Report Type:</strong></label>
              <div className="report-type-options">
                <button
                  className={`report-type-btn ${reportType === 'quick' ? 'active' : ''}`}
                  onClick={() => setReportType('quick')}
                >
                  ⚡ Quick Report
                  <span className="report-type-desc">Just mark the location</span>
                </button>
                <button
                  className={`report-type-btn ${reportType === 'detailed' ? 'active' : ''}`}
                  onClick={() => setReportType('detailed')}
                >
                  📸 Detailed Report
                  <span className="report-type-desc">Add photo evidence</span>
                </button>
              </div>
            </div>

            <div className="severity-section">
              <label><strong>⚡ Severity Level:</strong></label>
              <div className="severity-options">
                {['Low', 'Medium', 'Severe'].map(level => (
                  <button
                    key={level}
                    className={`severity-btn ${severity === level ? 'active' : ''} ${level.toLowerCase()}`}
                    onClick={() => setSeverity(level)}
                  >
                    {level === 'Low' && '🟢'} 
                    {level === 'Medium' && '🟡'} 
                    {level === 'Severe' && '🔴'} 
                    {level}
                  </button>
                ))}
              </div>
              <div className="severity-description">
                {severity === 'Low' && '💧 Minor puddles, vehicles can pass with care'}
                {severity === 'Medium' && '🌊 Significant water, slow down traffic'}
                {severity === 'Severe' && '🚫 Deep water, dangerous to cross'}
              </div>
            </div>

            {/* Photo Section - Only show for detailed reports */}
            {reportType === 'detailed' && (
              <div className="photo-section">
                <label><strong>📸 Add Visual Evidence:</strong></label>
                {photo ? (
                  <div className="photo-attached">
                    <img src={photo} alt="Attached" className="attached-preview" />
                    <button 
                      onClick={() => setPhoto(null)} 
                      className="remove-photo-btn"
                    >
                      ❌ Remove Photo
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowPhotoModal(true)} 
                    className="add-photo-btn"
                  >
                    📷 Take or Select Photo
                  </button>
                )}
                <p className="photo-hint">
                  📸 Visual proof helps other users better understand the situation
                </p>
              </div>
            )}

            <div className="report-actions">
              {reportType === 'quick' ? (
                <button 
                  onClick={handleQuickSubmit}
                  disabled={isSubmitting}
                  className="submit-report-btn quick"
                >
                  {isSubmitting ? '⚡ Submitting...' : '⚡ Quick Submit'}
                </button>
              ) : (
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="submit-report-btn detailed"
                >
                  {isSubmitting ? '📸 Submitting...' : '📸 Submit with Evidence'}
                </button>
              )}
              <button onClick={onClose} className="cancel-report-btn">
                Cancel
              </button>
            </div>

            {/* Help Text */}
            <div className="report-help">
              {reportType === 'quick' ? (
                <p className="help-text">
                  ⚡ <strong>Quick Report:</strong> Fast way to mark waterlogged areas. 
                  Other users will see your location and severity rating.
                </p>
              ) : (
                <p className="help-text">
                  📸 <strong>Detailed Report:</strong> Add photo evidence to help others 
                  see actual conditions. More credible and helpful!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <PhotoUploadModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onPhotoSelect={setPhoto}
      />
    </>
  );
}

// Component for handling location centering and reporting
function LocationMarker({ setReports, reports, userLocation }) {
  const map = useMap();
  const [showReportModal, setShowReportModal] = useState(false);
  const [clickedPosition, setClickedPosition] = useState(null);

  // Center map on user location when available
  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 12);
    }
  }, [userLocation, map]);

  const handleReportSubmit = async (reportData) => {
    try {
      const response = await axios.post(API_URL, reportData, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      setReports(prevReports => [...prevReports, response.data]);
      alert(`✅ Waterlogging report submitted successfully!${reportData.image_base64 ? ' 📸 Photo included!' : ''}`);
    } catch (error) {
      console.error("Error posting report:", error);
      throw error;
    }
  };

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setClickedPosition({ lat, lng });
      setShowReportModal(true);
    }
  });
  
  return (
    <>
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={new L.Icon({
          iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iOCIgZmlsbD0iIzAwN2JmZiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxjaXJjbGUgY3g9IjEwIiBjeT0iMTAiIHI9IjMiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })}>
          <Popup>📍 Your Location</Popup>
        </Marker>
      )}
      
      <ReportModal
        isOpen={showReportModal}
        position={clickedPosition}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
      />
    </>
  );
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
  const [viewMode, setViewMode] = useState('markers');
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
      case 'Low': return '#28a745';
      case 'Medium': return '#ffc107';
      case 'Severe': return '#dc3545';
      default: return '#007bff';
    }
  };

  const hasPhoto = (report) => {
    return report.image_url || report.image_base64;
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
      <div className="map-controls">
        <div className="map-info">
          <div className="report-count">
            📍 {reports.length} active reports
            <span className="photo-count">
              • 📸 {reports.filter(hasPhoto).length} with photos
            </span>
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
                disabled
                title="Heatmap view - coming soon!"
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
                  {hasPhoto(report) && <span className="photo-indicator"> 📸</span>}
                </h3>
                
                {hasPhoto(report) && (
                  <div className="popup-photo">
                    <img 
                      src={report.image_url || report.image_base64} 
                      alt="Waterlogging evidence" 
                      className="popup-image"
                    />
                  </div>
                )}
                
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
          💡 <strong>How to use:</strong> Click anywhere on the map to report waterlogging with optional photo proof. 
          Filter by time, vote on accuracy, and add comments for context. Reports auto-expire after 24 hours.
          📸 <strong>New:</strong> Add photos as visual evidence when reporting!
        </p>
      </div>
    </div>
  );
};

export default MapComponent;