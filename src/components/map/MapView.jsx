import React from "react";
import "./MapView.css";
import SearchBar from "./SearchBar";
import WilayaInfoPanel from "./WilayaInfoPanel";
// import ExportButton from "./ExportButton";

export default function MapView({
  mapRef,
  parcelleInfo,
  selectedCulture,
  onSelectWilaya,
  selectedWilaya,
  onCloseWilaya,
}) {
  const showHint = !parcelleInfo;
  const Icon = selectedCulture?.icon;
  return (
    <div className="map-area">
      <div ref={mapRef} id="map" />

      <SearchBar onSelectWilaya={onSelectWilaya} />

      {showHint && (
        <div className="map-hint">
          <span>🖱</span>
          Choisissez un outil et cliquez sur la carte pour dessiner votre
          parcelle
        </div>
      )}
      {/*
      {selectedCulture && parcelleInfo && (
        <div
          className="map-culture-badge"
          style={{ borderColor: selectedCulture.color }}
        >
          <span>
            {Icon && <Icon size={18} color={selectedCulture.color} />}
          </span>
          <span style={{ color: selectedCulture.color }}>
            {selectedCulture.nameShort}
          </span>
        </div>
      )} */}

      {selectedWilaya && (
        <WilayaInfoPanel
          wilaya={selectedWilaya}
          selectedCultureId={selectedCulture?.id}
          onClose={onCloseWilaya}
        />
      )}
    </div>
  );
}