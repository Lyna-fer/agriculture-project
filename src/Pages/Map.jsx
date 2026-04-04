import React, { useState, useCallback, useRef, useEffect } from "react";
import "../styles/map.css";
// import Navbar from '../components/map/Navbar';
import LeftPanel from "../components/map/LeftPanel";
import MapView from "../components/map/MapView";
import ResultsPanel from "../components/map/ResultsPanel";
import Toast from "../components/map/Toast";
import { useMap } from "../hooks/useMap";
import { CULTURES } from "../data/cultures";

const FIELD_COLORS = [
  "#2ecc71",
  "#3b82f6",
  "#e6970a",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
];
let colorIdx = 0;
const nextColor = () => FIELD_COLORS[colorIdx++ % FIELD_COLORS.length];

export default function Map() {
  useEffect(() => {
    document.body.className = "page-map";
  }, []);

  const [parcelles, setParcelles] = useState([]);
  const [selectedParcelleId, setSelectedParcelleId] = useState(null);

  const [pendingParcelleInfo, setPendingParcelleInfo] = useState(null);
  const [pendingColor, setPendingColor] = useState("#2ecc71");

  const [parcelleInfo, setParcelleInfo] = useState(null);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [toast, setToast] = useState({ msg: "", visible: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      3200,
    );
  }, []);

  const handleParcelleChange = useCallback(
    (info) => {
      if (info.type === "marker") {
        showToast(
          "📍 Marqueur posé — dessinez un polygone pour calculer la surface",
        );
        return;
      }

      const color = nextColor();
      setActiveTool(null);
      setPendingParcelleInfo(info);
      setPendingColor(color);
      setParcelleInfo(info);

      const ha = info.area || 0;
      showToast(
        `✅ Parcelle tracée — ${ha < 0.1 ? info.areaM2?.toFixed(0) + " m²" : ha.toFixed(2) + " ha"} · Donnez-lui un nom`,
      );
    },
    [showToast],
  );

  const { mapRef, placeSamplePoints, activateDrawTool, clearAll, flyToWilaya } =
    useMap({
      onParcelleChange: handleParcelleChange,
    });

  const handleActivateTool = useCallback(
    (tool) => {
      setActiveTool(tool);
      if (tool) {
        activateDrawTool(tool);
        setPendingParcelleInfo(null);
      } else {
        activateDrawTool(null);
      }
    },
    [activateDrawTool],
  );

  const handleSaveParcelle = useCallback(
    ({ name, groupId }) => {
      if (!pendingParcelleInfo) return;

      const newP = {
        id: Date.now(),
        name,
        area: (pendingParcelleInfo.area || 0) * 10000, // ha → m²
        color: pendingColor,
        groupId,
        bounds: pendingParcelleInfo.bounds,
        latlngs: pendingParcelleInfo.latlngs,
      };

      setParcelles((prev) => [...prev, newP]);
      setSelectedParcelleId(newP.id);
      setSelectedGroupId(groupId);
      setPendingParcelleInfo(null);
      setResultsOpen(false);

      showToast(`✅ ${name} enregistrée`);
    },
    [pendingParcelleInfo, pendingColor, showToast],
  );

  const handleCancelDraw = useCallback(() => {
    setActiveTool(null);
    activateDrawTool(null);
    setPendingParcelleInfo(null);

    if (!parcelles.length) {
      clearAll();
      setParcelleInfo(null);
    }
    showToast("✕ Dessin annulé");
  }, [activateDrawTool, clearAll, parcelles.length, showToast]);

  const handleClearAll = useCallback(() => {
    clearAll();
    setParcelles([]);
    setSelectedParcelleId(null);
    setParcelleInfo(null);
    setPendingParcelleInfo(null);
    setSelectedGroupId(null);
    setActiveTool(null);
    setResultsOpen(false);
    showToast("🗑 Tout effacé");
  }, [clearAll, showToast]);

  const handleSelectParcelle = useCallback(
    (id) => {
      setSelectedParcelleId(id);
      const p = parcelles.find((x) => x.id === id);

      if (p) setSelectedGroupId(p.groupId || selectedGroupId);
      setResultsOpen(false);
    },
    [parcelles, selectedGroupId],
  );

  const handleDeleteParcelle = useCallback(
    (id) => {
      setParcelles((prev) => prev.filter((p) => p.id !== id));
      if (selectedParcelleId === id) {
        setSelectedParcelleId(null);
        setParcelleInfo(null);
        setResultsOpen(false);
      }
      showToast("🗑 Parcelle supprimée");
    },
    [selectedParcelleId, showToast],
  );

  const handleGroupChange = useCallback(
    (groupId) => {
      setSelectedGroupId(groupId);
      setResultsOpen(false);
      // const c = CULTURE_SHIM[groupId];
      const c = CULTURES.find((c) => c.id === groupId);
      if (c) showToast(`${c.icon} ${c.nameShort} sélectionné`);
    },
    [showToast],
  );

  const handleAnalyze = useCallback(() => {
    if (!parcelleInfo || !selectedGroupId) return;

    const culture = CULTURES.find((c) => c.id === selectedGroupId);
    if (!culture) return;

    const n = culture.sampleFormula(parcelleInfo.area || 0);

    if (parcelleInfo.bounds) {
      placeSamplePoints(n, culture.pattern, culture.color, parcelleInfo.bounds);
    }

    setResultsOpen(true);
    showToast(`🔬 ${n} points d'échantillonnage générés`);
  }, [parcelleInfo, selectedGroupId, placeSamplePoints, showToast]);

  const handleSelectWilaya = useCallback(
    (wilaya) => {
      setSelectedWilaya(wilaya);
      flyToWilaya(wilaya);
      showToast(`📍 Wilaya de ${wilaya.name} · Zone ${wilaya.zone}`);
    },
    [flyToWilaya, showToast],
  );

  const selectedCulture = CULTURES.find((c) => c.id === selectedGroupId);

  return (
    <>
      <div style={{ display: "flex", height: "100vh" }}>
        <LeftPanel
          parcelles={parcelles}
          selectedParcelle={selectedParcelleId}
          selectedGroup={selectedGroupId}
          activeTool={activeTool}
          pendingParcelleInfo={pendingParcelleInfo}
          pendingColor={pendingColor}
          onToolClick={handleActivateTool}
          onSelectParcelle={handleSelectParcelle}
          onDeleteParcelle={handleDeleteParcelle}
          onGroupChange={handleGroupChange}
          onGenerate={handleAnalyze}
          onClearAll={handleClearAll}
          onSaveParcelle={handleSaveParcelle}
          onCancelDraw={handleCancelDraw}
        />

        <MapView
          mapRef={mapRef}
          parcelleInfo={parcelleInfo}
          selectedCulture={selectedCulture}
          onSelectWilaya={handleSelectWilaya}
          selectedWilaya={selectedWilaya}
          onCloseWilaya={() => setSelectedWilaya(null)}
        />
      </div>

      <ResultsPanel
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        cultureId={selectedGroupId}
        parcelleHa={parcelleInfo?.area}
        region={selectedWilaya?.name}
      />

      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}
