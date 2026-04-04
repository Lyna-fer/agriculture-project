// import React from 'react';
// import './Navbar.css';

// export default function Navbar({ step }) {
//   const steps = [
//     { id: 1, label: 'Délimiter' },
//     { id: 2, label: 'Culture' },
//     { id: 3, label: 'Résultats' },
//   ];

//   return (
//     <nav className="navbar">
//       <div className="nav-logo">
//         <span className="nav-logo-leaf">🌱</span>
//         SolGuide<span className="nav-logo-dot">.</span>
//       </div>

//       <div className="nav-steps">
//         {steps.map((s, i) => (
//           <React.Fragment key={s.id}>
//             <div
//               className={`step-pill ${step === s.id ? 'active' : ''} ${step > s.id ? 'done' : ''}`}
//             >
//               <span className="step-pill-num">
//                 {step > s.id ? '✓' : s.id}
//               </span>
//               {s.label}
//             </div>
//             {i < steps.length - 1 && <span className="step-divider">›</span>}
//           </React.Fragment>
//         ))}
//       </div>

//       <div className="nav-badge">🇩🇿 Algérie</div>
//     </nav>
//   );
// }
