"""
features.py — Feature Engineering for Equipment Degradation ML
Antarctic Digital Twin — SIH26060
"""

from typing import Dict, Any, List, Tuple
import numpy as np

FEATURE_NAMES = [
    'health',
    'temperature',
    'vibration',
    'efficiency',
    'load_percent',
    'operating_hours',
    'maintenance_age_days',
    'temp_deviation',
    'vib_deviation',
]

NORMAL_THRESHOLDS: Dict[str, Dict[str, float]] = {
    'generator': {'temp_max': 90.0, 'vib_max': 30.0, 'eff_min': 0.85},
    'heating': {'temp_max': 75.0, 'vib_max': 15.0, 'eff_min': 0.85},
    'water': {'temp_max': 50.0, 'vib_max': 12.0, 'eff_min': 0.90},
    'solar': {'temp_max': 40.0, 'vib_max': 5.0, 'eff_min': 0.75},
    'comms': {'temp_max': 35.0, 'vib_max': 8.0, 'eff_min': 0.90},
    'default': {'temp_max': 80.0, 'vib_max': 25.0, 'eff_min': 0.85},
}


def extract_features_from_equipment(eq_data: Dict[str, Any]) -> np.ndarray:
    """
    Extracts numerical feature vector from equipment dict or object.
    Returns 1D numpy array of length len(FEATURE_NAMES).
    """
    category = eq_data.get('category', 'generator').lower()
    normals = NORMAL_THRESHOLDS.get(category, NORMAL_THRESHOLDS['default'])

    health = float(eq_data.get('health', 100.0))
    temperature = float(eq_data.get('temperature', 60.0))
    vibration = float(eq_data.get('vibration', 10.0))
    efficiency = float(eq_data.get('efficiency', 0.92))
    load_percent = float(eq_data.get('load_percent', eq_data.get('load', 70.0)))
    operating_hours = float(eq_data.get('operating_hours', 5000.0))
    maintenance_age_days = float(eq_data.get('maintenance_age_days', 45.0))

    temp_dev = max(0.0, temperature - normals['temp_max'])
    vib_dev = max(0.0, vibration - normals['vib_max'])

    return np.array([
        health,
        temperature,
        vibration,
        efficiency,
        load_percent,
        operating_hours,
        maintenance_age_days,
        temp_dev,
        vib_dev,
    ], dtype=np.float32)


class FeatureScaler:
    """Standard Z-score scaler implemented with pure NumPy (avoiding external sklearn dependency)."""

    def __init__(self):
        self.mean: Optional[np.ndarray] = None
        self.scale: Optional[np.ndarray] = None

    def fit(self, X: np.ndarray):
        self.mean = np.mean(X, axis=0)
        self.scale = np.std(X, axis=0)
        # Avoid division by zero
        self.scale[self.scale == 0.0] = 1.0

    def transform(self, X: np.ndarray) -> np.ndarray:
        if self.mean is None or self.scale is None:
            raise ValueError("Scaler has not been fitted.")
        return (X - self.mean) / self.scale

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        self.fit(X)
        return self.transform(X)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'mean': self.mean.tolist() if self.mean is not None else [],
            'scale': self.scale.tolist() if self.scale is not None else [],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FeatureScaler':
        scaler = cls()
        if data.get('mean') and data.get('scale'):
            scaler.mean = np.array(data['mean'], dtype=np.float32)
            scaler.scale = np.array(data['scale'], dtype=np.float32)
        return scaler
