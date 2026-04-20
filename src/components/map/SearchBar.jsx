import React, { useState, useRef, useEffect } from 'react';
import { WILAYAS, ZONE_COLORS } from '../../data/wilayas';
import './SearchBar.css';
import { Search } from 'lucide-react';
export default function SearchBar({ onSelectWilaya }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim().length < 2) { setResults([]); setOpen(false); return; }
    const q = val.toLowerCase().trim();
    const filtered = WILAYAS.filter(
      (w) => w.name.toLowerCase().includes(q) || w.code.includes(q)
    ).slice(0, 6);
    setResults(filtered);
    setOpen(filtered.length > 0);
  };

  const handleSelect = (wilaya) => {
    setQuery(wilaya.name);
    setOpen(false);
    setResults([]);
    onSelectWilaya(wilaya);
  };

  return (
    <div className="search-bar" ref={ref}>
      <div className="search-input-wrap">
        <span className="search-icon"><Search size={18} /></span>
        <input
          type="text"
          className="search-input"
          placeholder="Search a province"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query && (
          <button className="search-clear" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}>✕</button>
        )}
      </div>

      {open && (
        <div className="search-dropdown">
          {results.map((w) => {
            const zone = ZONE_COLORS[w.zone];
            return (
              <button key={w.code} className="search-result" onClick={() => handleSelect(w)}>
                <div className="result-left">
                  <div>
                    <div className="result-name">{w.name}</div>
                    <div className="result-meta">
                      <span>Province {w.code}</span>
                    </div>
                  </div>
                </div>
                <span
                  className="result-zone"
                  style={{ background: zone.bg, color: zone.text }}
                >
                  {zone.label}
                </span>
              </button>
            );
          })}
          <div className="search-footer">
            Data · 58 Algerian provinces
          </div>
        </div>
      )}
    </div>
  );
}
