import React from "react";
import "./App.css";
import MapComponent from "./MapComponent";

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="water-icon">💧</span>
            AquaRoute
          </h1>
          <p className="app-subtitle">Real-Time Waterlogging Map</p>
          <p className="app-description">
            Click anywhere on the map to report waterlogged areas. Help your community navigate safely during monsoons.
          </p>
        </div>
      </header>
      <div className="map-container">
        <MapComponent />
      </div>
      <footer className="app-footer">
        <p>🌧️ Stay safe, travel smart during monsoon season</p>
      </footer>
    </div>
  );
}

export default App;