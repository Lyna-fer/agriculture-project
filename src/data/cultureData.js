// export const CULTURE_GROUPS = [
//   {
//     id: 1,
//     name: "Cultures Maraîchères",
//     nameShort: "Maraîchères",
//     icon: "🥕",
//     examples: "Tomates, carottes, pommes de terre, légumes...",
//     color: "#4a7c2f",
//     colorLight: "rgba(74,124,47,0.1)",
//     pattern: "zigzag",
//     patternLabel: "Zigzag",
//     patternAlt: "grille",
//     patternAltLabel: "Grille",
//     // sampleFormula: (ha) => Math.max(8, Math.ceil(ha * 6)),
//     sampleFormula: (ha) => {
//       const calcul = Math.ceil(8 + 3 * Math.sqrt(ha));
//       return Math.min(25, calcul);
//     },
//     gear: [
//       "Tarière ou sonde pédologique",
//       "Sacs kraft numérotés",
//       "Étiquettes et marqueur",
//       "GPS (Smartphone)",
//       "Gants de protection",
//     ],
//     // sampleNote: '6 points / ha — suivi intensif',
//     sampleNote: "Précision renforcée — Max 25 points",
//     depths: [
//       {
//         label: "0 – 20 cm",
//         color: "#5C3D1E",
//         desc: "Horizon A — Zone racinaire principale",
//         priority: true,
//       },
//       {
//         label: "20 – 40 cm",
//         color: "#8B6045",
//         desc: "Horizon B — Réservoirs nutritifs",
//         priority: false,
//       },
//     ],
//     steps: [
//       {
//         title: "Matériel requis",
//         text: "Tarière ou sonde pédologique (Ø 3–5 cm), sacs kraft numérotés, étiquettes, GPS, gants de protection.",
//       },
//       {
//         title: "Nombre d'échantillons",
//         text: "Minimum <strong>8 prélèvements par hectare</strong> — fréquence élevée due à la forte variabilité des sols maraîchers.",
//       },
//       {
//         title: "Profondeur",
//         text: "Prélevez à <strong>0–20 cm</strong> (zone racinaire active). Pour sols profonds ou antécédents de problèmes, ajoutez l'horizon 20–40 cm.",
//       },
//       {
//         title: "Timing optimal",
//         text: "Effectuez le prélèvement <strong>2–4 semaines avant la plantation</strong>, sol ni trop sec ni saturé en eau.",
//       },
//       {
//         title: "Composition de l'échantillon",
//         text: "Mélangez <strong>20–25 sous-prélèvements</strong> pour former un échantillon composite représentatif d'environ 500 g.",
//       },
//       {
//         title: "Conservation & envoi",
//         text: "Séchez à l'air libre 24 h à l'ombre, conditionnez dans sac kraft hermétique, envoyez au laboratoire sous <strong>5 jours</strong>.",
//       },
//     ],
//     alerts: [
//       "Évitez de prélever après une fertilisation récente (< 3 semaines)",
//       "Ne pas prélever dans les zones anormales : bords, passages d'engins, zones inondées",
//     ],
//   },
//   {
//     id: 2,
//     name: "Cultures Céréalières",
//     nameShort: "Céréalières",
//     icon: "🌾",
//     examples: "Blé, orge, maïs, sorgho, avoine...",
//     color: "#c8a84b",
//     colorLight: "rgba(200,168,75,0.12)",
//     pattern: "x",
//     patternLabel: "Schéma X/W",
//     patternAlt: "diagonal",
//     patternAltLabel: "Diagonal",
//     // sampleFormula: (ha) => Math.max(5, Math.ceil(ha * 3)),
//     sampleFormula: (ha) => {
//       const calcul = Math.ceil(5 + 2 * Math.sqrt(ha));
//       return Math.min(20, calcul); // Les céréales demandent souvent moins de points
//     },
//     gear: [
//       "Tarière ou sonde pédologique",
//       "Sacs kraft numérotés",
//       "Étiquettes et marqueur",
//       "GPS (Smartphone)",
//       "Gants de protection",
//     ],
//     // sampleNote: '3 points / ha — gestion fertilisants',
//     sampleNote: "Gestion fertilisants — Max 20 points",
//     depths: [
//       {
//         label: "0 – 30 cm",
//         color: "#5C3A1E",
//         desc: "Horizon labouré — Fertilité globale",
//         priority: true,
//       },
//       {
//         label: "30 – 60 cm",
//         color: "#8B5E3A",
//         desc: "Horizon sous-labour — Réserves hydriques",
//         priority: false,
//       },
//     ],
//     steps: [
//       {
//         title: "Matériel requis",
//         text: "Tarière à main ou sonde articulée, sacs polyéthylène 1 L, marqueur indélébile, planche de terrain.",
//       },
//       {
//         title: "Nombre d'échantillons",
//         text: "<strong>3–5 points par hectare</strong> selon la variabilité pédologique. Augmenter en sol hétérogène ou parcelle irrégulière.",
//       },
//       {
//         title: "Profondeur",
//         text: "Horizon labouré <strong>0–30 cm</strong> en priorité. En agriculture de conservation (semis direct), ajouter l'horizon 0–10 cm.",
//       },
//       {
//         title: "Timing optimal",
//         text: "<strong>Après récolte ou en automne</strong> avant semis. Jamais après épandage d'engrais azotés.",
//       },
//       {
//         title: "Pattern de prélèvement",
//         text: "Parcourez la parcelle en <strong>schéma X ou W</strong>. Prélevez tous les 20–30 pas le long du trajet défini.",
//       },
//       {
//         title: "Conservation & envoi",
//         text: "Mélange homogène de tous les prélèvements. Réduire à 500 g par quartage. Étiqueter et envoyer sous <strong>48 h</strong>.",
//       },
//     ],
//     alerts: [
//       "Exclure les zones de stockage de paille ou de compost de l'année",
//       "Noter la date de la dernière fertilisation sur la fiche de prélèvement",
//     ],
//   },
//   {
//     id: 3,
//     name: "Cultures Permanentes",
//     nameShort: "Permanentes",
//     icon: "🫒",
//     examples: "Oliviers, agrumes, vignes, arbres fruitiers...",
//     color: "#2d5a8e",
//     colorLight: "rgba(45,90,142,0.1)",
//     pattern: "radial",
//     patternLabel: "Radial / Couronnes",
//     patternAlt: "transect",
//     patternAltLabel: "Transect",
//     // sampleFormula: (ha) => Math.max(4, Math.ceil(ha * 2.5)),
//     sampleFormula: (ha) => {
//       const calcul = Math.ceil(4 + 1.5 * Math.sqrt(ha));
//       return Math.min(15, calcul);
//     },
//     gear: [
//       "Tarière ou sonde pédologique",
//       "Sacs kraft numérotés",
//       "Étiquettes et marqueur",
//       "GPS (Smartphone)",
//       "Gants de protection",
//     ],
//     // sampleNote: '2–3 points / ha — suivi spatio-temporel',
//     sampleNote: "Suivi par zone — Max 15 points",
//     depths: [
//       {
//         label: "0 – 20 cm",
//         color: "#4A2E0E",
//         desc: "Surface — Activité biologique",
//         priority: true,
//       },
//       {
//         label: "20 – 40 cm",
//         color: "#7A5230",
//         desc: "Zone racinaire active",
//         priority: true,
//       },
//       {
//         label: "40 – 80 cm",
//         color: "#9E6A42",
//         desc: "Racines profondes — Réservoirs minéraux",
//         priority: false,
//       },
//     ],
//     steps: [
//       {
//         title: "Matériel requis",
//         text: "Tarière hélicoïdale (profondeur > 80 cm), sacs séparés par horizon, GPS submétrique, fiche de terrain.",
//       },
//       {
//         title: "Nombre d'échantillons",
//         text: "<strong>2–3 points par hectare minimum</strong>. Suivi spatio-temporel requis sur plusieurs saisons.",
//       },
//       {
//         title: "Position de prélèvement",
//         text: "Prélevez <strong>à la projection du feuillage</strong> (gouttière), mi-distance entre tronc et extrémité des branches. Éviter le pied de l'arbre.",
//       },
//       {
//         title: "Profondeur — 3 horizons",
//         text: "<strong>Trois horizons obligatoires</strong> : 0–20 cm, 20–40 cm, 40–80 cm. Chaque horizon constitue un échantillon séparé.",
//       },
//       {
//         title: "Fréquence de prélèvement",
//         text: "Tous les <strong>3–5 ans</strong> pour suivi général. Annuellement si problème nutritionnel détecté (chlorose, faible rendement).",
//       },
//       {
//         title: "Compléments recommandés",
//         text: "Coupler avec des <strong>analyses foliaires</strong> (feuilles de l'été) pour diagnostic complet de la nutrition minérale.",
//       },
//     ],
//     alerts: [
//       "Ne pas prélever sous irrigation localisée ni dans la zone fertilisée directement",
//       "Conserver séparément les horizons — ne jamais mélanger les profondeurs entre elles",
//     ],
//   },
// ];

// export const getPatternPoints = (type, n, bounds) => {
//   const { minLat, maxLat, minLng, maxLng } = bounds;
//   const latRange = maxLat - minLat;
//   const lngRange = maxLng - minLng;
//   const cLat = (minLat + maxLat) / 2;
//   const cLng = (minLng + maxLng) / 2;
//   const points = [];

//   if (type === "zigzag") {
//     const rows = Math.ceil(Math.sqrt(n));
//     const cols = Math.ceil(n / rows);
//     for (let r = 0; r < rows && points.length < n; r++) {
//       const lat = minLat + ((r + 0.5) * latRange) / rows;
//       for (let c = 0; c < cols && points.length < n; c++) {
//         const ci = r % 2 === 0 ? c : cols - 1 - c;
//         const lng = minLng + ((ci + 0.5) * lngRange) / cols;
//         points.push([lat, lng]);
//       }
//     }
//   } else if (type === "x") {
//     const d1 = Math.ceil(n / 2);
//     const d2 = n - d1;
//     for (let i = 0; i < d1; i++) {
//       const t = (i + 0.5) / d1;
//       points.push([minLat + t * latRange, minLng + t * lngRange]);
//     }
//     for (let i = 0; i < d2; i++) {
//       const t = (i + 0.5) / d2;
//       points.push([maxLat - t * latRange, minLng + t * lngRange]);
//     }
//   } else if (type === "radial") {
//     points.push([cLat, cLng]);
//     const rings = Math.max(1, Math.ceil((n - 1) / 6));
//     let placed = 1;
//     for (let r = 1; r <= rings && placed < n; r++) {
//       const perRing = Math.min(6, n - placed);
//       for (let i = 0; i < perRing && placed < n; i++) {
//         const angle = (2 * Math.PI * i) / perRing;
//         const rl = (r / (rings + 1)) * 0.4;
//         points.push([
//           cLat + rl * latRange * Math.sin(angle),
//           cLng + rl * lngRange * Math.cos(angle),
//         ]);
//         placed++;
//       }
//     }
//   } else if (type === "grille") {
//     const cols = Math.ceil(Math.sqrt(n));
//     const rows = Math.ceil(n / cols);
//     for (let r = 0; r < rows && points.length < n; r++) {
//       for (let c = 0; c < cols && points.length < n; c++) {
//         points.push([
//           minLat + ((r + 0.5) * latRange) / rows,
//           minLng + ((c + 0.5) * lngRange) / cols,
//         ]);
//       }
//     }
//   } else if (type === "diagonal") {
//     for (let i = 0; i < n; i++) {
//       const t = (i + 0.5) / n;
//       points.push([minLat + t * latRange, minLng + t * lngRange]);
//     }
//   } else if (type === "transect") {
//     const half = Math.ceil(n / 2);
//     for (let i = 0; i < half; i++) {
//       points.push([cLat, minLng + ((i + 0.5) * lngRange) / half]);
//     }
//     for (let i = 0; i < n - half; i++) {
//       points.push([minLat + ((i + 0.5) * latRange) / (n - half), cLng]);
//     }
//   }

//   return points.slice(0, n);
// };
