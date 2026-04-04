import React, { useEffect, useState } from 'react';
import './Toast.css';

export default function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? 'visible' : ''}`}>
      {message}
    </div>
  );
}
